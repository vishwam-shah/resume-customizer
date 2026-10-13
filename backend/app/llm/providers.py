"""LLM providers behind one small interface.

Each provider can return JSON constrained to a schema and stream plain text.
Errors are normalized to `ProviderError` with a `retryable` flag and an
optional bench duration so the router can decide whether to wait, retry, or
move on to the next provider.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any, Protocol

import httpx
from google import genai
from google.genai import errors as genai_errors
from google.genai import types as genai_types

from app.core.config import settings


class ProviderError(Exception):
    def __init__(self, message: str, *, retryable: bool = False, bench_seconds: float = 0) -> None:
        super().__init__(message)
        self.retryable = retryable
        self.bench_seconds = bench_seconds


class Provider(Protocol):
    name: str
    model: str

    async def generate_json(
        self, system: str, user: str, schema: dict[str, Any], *, temperature: float, max_tokens: int
    ) -> str: ...

    def stream_text(
        self, system: str, user: str, *, temperature: float, max_tokens: int
    ) -> AsyncIterator[str]: ...


def _status_error(name: str, status: int, detail: str, retry_after: float = 0) -> ProviderError:
    if status in (401, 403):
        return ProviderError(f"{name} auth failed ({status})", bench_seconds=6 * 3600)
    if status == 404:
        return ProviderError(f"{name} model not found: {detail}", bench_seconds=6 * 3600)
    if status == 429:
        # Don't sleep on a rate limit inside a user-facing request: bench this
        # provider until its window resets and let the router try the next one.
        return ProviderError(f"{name} rate limited", bench_seconds=retry_after or 30)
    if status == 503:
        # "Model is experiencing high demand": other models are usually fine.
        return ProviderError(f"{name} overloaded", bench_seconds=30)
    if status >= 500:
        return ProviderError(f"{name} server error {status}", retryable=True)
    return ProviderError(f"{name} rejected request ({status}): {detail[:300]}")


def _gemini_error(name: str, error: Exception) -> ProviderError:
    """Map any google-genai exception to a ProviderError.

    The SDK raises different hierarchies depending on the API surface (the
    Interactions API has its own, e.g. RateLimitError). They all expose an
    HTTP status as `code` or `status_code`; anything without one is treated
    as a transient network failure.
    """
    status = getattr(error, "status_code", None) or getattr(error, "code", None)
    if isinstance(status, int):
        return _status_error(name, status, str(error))
    if isinstance(error, genai_errors.APIError):
        return _status_error(name, 500, str(error))
    if isinstance(error, TimeoutError) or "Timeout" in type(error).__name__:
        # A model that just timed out will likely time out again: move on.
        return ProviderError(f"{name} timed out", bench_seconds=60)
    return ProviderError(f"{name} network error: {type(error).__name__}", retryable=True)


class GeminiProvider:
    """Google Gemini via the Interactions API (google-genai SDK)."""

    def __init__(self, api_key: str, model: str) -> None:
        # Each model is its own provider: one being overloaded shouldn't sink the rest.
        self.name = f"gemini/{model.removeprefix('gemini-')}"
        self.model = model
        # A hard timeout and no SDK-internal retries: on an overloaded model the
        # SDK would otherwise back off for minutes instead of letting the router
        # fail over to the next model.
        self._client = genai.Client(
            api_key=api_key,
            http_options=genai_types.HttpOptions(
                timeout=int(settings.llm_timeout_seconds * 1000),
                retry_options=genai_types.HttpRetryOptions(attempts=1),
            ),
        ).aio

    def _config(self, temperature: float, max_tokens: int) -> dict[str, Any]:
        # Thinking can't be turned off on Gemini 3; "low" keeps it from
        # spending the output budget on a writing task.
        return {
            "temperature": temperature,
            "max_output_tokens": max_tokens,
            "thinking_level": "low",
        }

    async def generate_json(
        self, system: str, user: str, schema: dict[str, Any], *, temperature: float, max_tokens: int
    ) -> str:
        try:
            interaction = await self._client.interactions.create(
                model=self.model,
                system_instruction=system,
                input=user,
                response_format={"type": "text", "mime_type": "application/json", "schema": schema},
                generation_config=self._config(temperature, max_tokens),
                store=False,
            )
        except ProviderError:
            raise
        except Exception as e:
            raise _gemini_error(self.name, e) from e
        text = interaction.output_text or ""
        if not text.strip():
            raise ProviderError(f"{self.name} returned an empty body", retryable=True)
        return text

    async def stream_text(
        self, system: str, user: str, *, temperature: float, max_tokens: int
    ) -> AsyncIterator[str]:
        try:
            stream = await self._client.interactions.create(
                model=self.model,
                system_instruction=system,
                input=user,
                generation_config=self._config(temperature, max_tokens),
                store=False,
                stream=True,
            )
            async for event in stream:
                if event.event_type != "step.delta":
                    continue
                text = getattr(event.delta, "text", None)
                if event.delta.type == "text" and text:
                    yield text
        except ProviderError:
            raise
        except Exception as e:
            raise _gemini_error(self.name, e) from e


class GroqProvider:
    """Groq's OpenAI-compatible endpoint. Strict JSON schema on gpt-oss/qwen."""

    def __init__(self, model: str, client: httpx.AsyncClient) -> None:
        # Groq's free tier limits tokens per minute per model, so each model is
        # its own provider and gets benched independently.
        self.name = f"groq/{model.rsplit('/', 1)[-1]}"
        self.model = model
        self._client = client

    def _payload(self, system: str, user: str, temperature: float, max_tokens: int) -> dict:
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "temperature": temperature,
            "max_completion_tokens": max_tokens,
        }
        if "gpt-oss" in self.model:
            payload["reasoning_effort"] = "low"
        elif self.model.startswith("qwen/"):
            payload["reasoning_format"] = "hidden"
        return payload

    @staticmethod
    def _error_detail(response: httpx.Response) -> str:
        try:
            return response.json().get("error", {}).get("message", response.text)
        except ValueError:
            return response.text

    async def generate_json(
        self, system: str, user: str, schema: dict[str, Any], *, temperature: float, max_tokens: int
    ) -> str:
        payload = self._payload(system, user, temperature, max_tokens)
        payload["response_format"] = {
            "type": "json_schema",
            "json_schema": {"name": "result", "strict": True, "schema": schema},
        }
        try:
            r = await self._client.post("/chat/completions", json=payload)
        except httpx.TransportError as e:
            raise ProviderError(f"{self.name} network error: {e}", retryable=True) from e
        if r.status_code >= 400:
            retry_after = float(r.headers.get("retry-after", 0) or 0)
            raise _status_error(self.name, r.status_code, self._error_detail(r), retry_after)
        try:
            text = r.json()["choices"][0]["message"]["content"] or ""
        except (KeyError, IndexError, ValueError) as e:
            raise ProviderError(f"{self.name} malformed response", retryable=True) from e
        if not text.strip():
            raise ProviderError(f"{self.name} returned an empty body", retryable=True)
        return text

    async def stream_text(
        self, system: str, user: str, *, temperature: float, max_tokens: int
    ) -> AsyncIterator[str]:
        payload = self._payload(system, user, temperature, max_tokens) | {"stream": True}
        try:
            async with self._client.stream("POST", "/chat/completions", json=payload) as r:
                if r.status_code >= 400:
                    await r.aread()
                    retry_after = float(r.headers.get("retry-after", 0) or 0)
                    raise _status_error(
                        self.name, r.status_code, self._error_detail(r), retry_after
                    )
                async for line in r.aiter_lines():
                    if not line.startswith("data: ") or line == "data: [DONE]":
                        continue
                    chunk = json.loads(line[6:])
                    choices = chunk.get("choices") or [{}]
                    if delta := choices[0].get("delta", {}).get("content"):
                        yield delta
        except httpx.TransportError as e:
            raise ProviderError(f"{self.name} network error: {e}", retryable=True) from e


def build_providers() -> list[Provider]:
    """Providers from LLM_CHAIN ("provider/model,..."); ones without a key are skipped."""
    groq_client: httpx.AsyncClient | None = None
    chain: list[Provider] = []
    for entry in (e.strip() for e in settings.llm_chain.split(",")):
        provider, _, model = entry.partition("/")
        if not model:
            continue
        if provider == "gemini" and settings.gemini_api_key:
            chain.append(GeminiProvider(settings.gemini_api_key, model))
        elif provider == "groq" and settings.groq_api_key:
            groq_client = groq_client or httpx.AsyncClient(
                base_url=settings.groq_base_url.rstrip("/"),
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                timeout=settings.llm_timeout_seconds,
            )
            chain.append(GroqProvider(model, groq_client))
    return chain

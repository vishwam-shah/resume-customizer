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
    if status >= 500:
        return ProviderError(f"{name} server error {status}", retryable=True)
    return ProviderError(f"{name} rejected request ({status}): {detail[:300]}")


class GeminiProvider:
    """Google Gemini via the Interactions API (google-genai SDK)."""

    name = "gemini"

    def __init__(self, api_key: str, model: str) -> None:
        self.model = model
        self._client = genai.Client(api_key=api_key).aio

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
        except genai_errors.APIError as e:
            raise _status_error(self.name, e.code or 500, str(e.message)) from e
        except httpx.TransportError as e:
            raise ProviderError(f"{self.name} network error: {e}", retryable=True) from e
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
        except genai_errors.APIError as e:
            raise _status_error(self.name, e.code or 500, str(e.message)) from e
        except httpx.TransportError as e:
            raise ProviderError(f"{self.name} network error: {e}", retryable=True) from e


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
    """Configured providers in chain order; ones without a key are skipped."""
    order = [n.strip() for n in settings.llm_chain.split(",") if n.strip()]
    chain: list[Provider] = []
    for name in order:
        if name == "gemini" and settings.gemini_api_key:
            chain.append(GeminiProvider(settings.gemini_api_key, settings.gemini_model))
        elif name == "groq" and settings.groq_api_key:
            client = httpx.AsyncClient(
                base_url=settings.groq_base_url.rstrip("/"),
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                timeout=settings.llm_timeout_seconds,
            )
            models = [m.strip() for m in settings.groq_models.split(",") if m.strip()]
            chain += [GroqProvider(m, client) for m in models]
    return chain

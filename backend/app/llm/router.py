"""Failover across providers, with validation of every structured answer.

For structured calls the reply must parse into the requested Pydantic model.
A reply that doesn't is retried once on the same provider with the
validation error fed back, then the next provider is tried. Providers that
hit a quota are benched so later requests skip them instantly.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import AsyncIterator

from pydantic import BaseModel, ValidationError

from app.core.errors import LlmUnavailableError
from app.llm.providers import Provider, ProviderError, build_providers
from app.llm.strict_schema import strict_schema

logger = logging.getLogger("app.llm")

_benched_until: dict[str, float] = {}
_providers: list[Provider] | None = None


# Typographic look-alikes models like to emit. A non-breaking hyphen in
# "retrieval\u2011augmented" defeats keyword matching and some ATS parsers.
_lookalikes = str.maketrans(
    {
        "\u2010": "-",
        "\u2011": "-",
        "\u00a0": " ",
        "\u202f": " ",
        "\u200b": "",
    }
)


def normalize(text: str) -> str:
    return text.translate(_lookalikes)


def providers() -> list[Provider]:
    global _providers
    if _providers is None:
        _providers = build_providers()
    return _providers


def _is_benched(p: Provider) -> bool:
    return _benched_until.get(p.name, 0.0) > time.monotonic()


def _bench(p: Provider, seconds: float) -> None:
    _benched_until[p.name] = time.monotonic() + max(seconds, 5.0)
    logger.warning("benched %s for %.0fs", p.name, seconds)


def active_model() -> str:
    """The provider and model that will answer next, for display."""
    for p in providers():
        if not _is_benched(p):
            return f"{p.name}:{p.model}"
    return ""


async def _with_retries(p: Provider, call):
    """Run `call` with short backoff on transient provider errors."""
    for attempt in range(3):
        try:
            return await call()
        except ProviderError as e:
            if e.bench_seconds:
                _bench(p, e.bench_seconds)
            if not e.retryable or attempt == 2:
                raise
            await asyncio.sleep(1.5 * (attempt + 1))
    raise AssertionError("unreachable")


async def generate[ModelT: BaseModel](
    model: type[ModelT], *, system: str, user: str, temperature: float = 0.3, max_tokens: int = 8000
) -> tuple[ModelT, str]:
    """Return (validated model, "provider:model" that produced it)."""
    schema = strict_schema(model)
    errors: list[str] = []
    for p in providers():
        if _is_benched(p):
            errors.append(f"{p.name} benched")
            continue
        prompt = user
        for attempt in range(2):
            try:
                raw = await _with_retries(
                    p,
                    lambda p=p, prompt=prompt: p.generate_json(
                        system, prompt, schema, temperature=temperature, max_tokens=max_tokens
                    ),
                )
            except ProviderError as e:
                logger.warning("%s failed for %s: %s", p.name, model.__name__, e)
                errors.append(str(e))
                break
            try:
                return model.model_validate_json(normalize(raw)), f"{p.name}:{p.model}"
            except ValidationError as e:
                logger.warning("%s invalid %s: %s", p.name, model.__name__, e.errors()[:3])
                errors.append(f"{p.name} invalid output (attempt {attempt + 1})")
                prompt = (
                    f"{user}\n\nYour previous answer did not match the schema: "
                    f"{e.errors()[:3]}. Return valid JSON only."
                )
    logger.error("all providers failed for %s: %s", model.__name__, errors)
    raise LlmUnavailableError(" | ".join(errors) or "no LLM provider configured")


async def stream(
    *, system: str, user: str, temperature: float = 0.5, max_tokens: int = 1500
) -> AsyncIterator[str]:
    """Stream text from the first provider that starts answering.

    Failover only happens before the first token; once text has reached the
    client, switching providers would produce a spliced, incoherent result.
    """
    errors: list[str] = []
    for p in providers():
        if _is_benched(p):
            continue
        started = False
        try:
            async for chunk in p.stream_text(
                system, user, temperature=temperature, max_tokens=max_tokens
            ):
                started = True
                yield normalize(chunk)
            return
        except ProviderError as e:
            if e.bench_seconds:
                _bench(p, e.bench_seconds)
            if started:
                raise LlmUnavailableError(str(e)) from e
            errors.append(str(e))
    raise LlmUnavailableError(" | ".join(errors) or "no LLM provider configured")

"""Keep a free-tier instance awake by pinging its own public URL.

Render's free plan sleeps a service after 15 minutes without inbound
traffic, and the next visitor waits ~30 s for it to wake. While the
service is up, this task requests its own /health through the public URL
every few minutes, which counts as inbound traffic. Requests to localhost
would not, because they never leave the container.

Enabled only when a public URL is known: SELF_PING_URL, or the
RENDER_EXTERNAL_URL that Render sets automatically.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator

import httpx
from fastapi import FastAPI

from app.core.config import settings

logger = logging.getLogger("app.keep_awake")


async def _ping_forever(url: str, interval: float) -> None:
    async with httpx.AsyncClient(timeout=20) as client:
        while True:
            await asyncio.sleep(interval)
            try:
                response = await client.get(url)
                logger.info("self-ping %s -> %s", url, response.status_code)
            except httpx.HTTPError as e:
                # A missed ping is harmless; the next one may succeed.
                logger.warning("self-ping failed: %s", e)


@contextlib.asynccontextmanager
async def keep_awake(_: FastAPI) -> AsyncIterator[None]:
    base = settings.self_ping_url or settings.render_external_url
    task: asyncio.Task[None] | None = None
    if base and settings.self_ping_minutes > 0:
        url = f"{base.rstrip('/')}/api/v1/health"
        task = asyncio.create_task(_ping_forever(url, settings.self_ping_minutes * 60))
        logger.info("self-ping enabled: %s every %s min", url, settings.self_ping_minutes)
    try:
        yield
    finally:
        if task:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task

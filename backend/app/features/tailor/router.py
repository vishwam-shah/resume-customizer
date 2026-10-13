from __future__ import annotations

from collections.abc import AsyncIterator

from fastapi import APIRouter, Request
from fastapi.sse import EventSourceResponse, ServerSentEvent

from app.core.config import settings
from app.core.errors import AppError
from app.core.rate_limit import limiter
from app.features.tailor.models import TailorRequest
from app.features.tailor.service import run_pipeline

router = APIRouter(tags=["tailor"])


def validate_job_description(text: str) -> str:
    text = text.strip()
    if len(text) < settings.min_job_description_chars:
        raise AppError(
            "jobDescriptionTooShort",
            f"The job description is too short ({len(text)} characters).",
            hint=f"Paste the full posting, at least {settings.min_job_description_chars} "
            "characters, including requirements and responsibilities.",
            status=422,
        )
    return text


@router.post("/tailor", response_class=EventSourceResponse)
@limiter.limit(settings.rate_limit_tailor)
async def tailor(request: Request, body: TailorRequest) -> AsyncIterator[ServerSentEvent]:
    """Tailor a resume to a job. Streams `stage`, `resume`, `analysis`,
    `scoresBefore`, `result`, `done` and `error` events."""
    # Inside a stream, failures travel as `error` events, not HTTP statuses:
    # the client handles one error path whichever stage fails.
    try:
        body.job_description = validate_job_description(body.job_description)
    except AppError as e:
        yield ServerSentEvent(data=e.to_dict(), event="error")
        return
    async for event in run_pipeline(body):
        if await request.is_disconnected():
            return
        yield event

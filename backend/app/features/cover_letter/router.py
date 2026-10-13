"""Cover letter, streamed token by token."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Literal

from fastapi import APIRouter, Request
from fastapi.sse import EventSourceResponse, ServerSentEvent
from pydantic import Field

from app.core.config import settings
from app.core.errors import AppError
from app.core.rate_limit import limiter
from app.core.schemas import CamelModel
from app.features.job.models import JobAnalysis
from app.features.resume.models import ResumeDoc
from app.llm import router as llm

router = APIRouter(tags=["coverLetter"])

Length = Literal["short", "standard"]

system_prompt = """You write cover letters that hiring managers actually read to the end.

Rules:
1. Use only facts from the candidate's resume. Never invent experience, numbers or skills.
2. Structure: a direct opening naming the role and the single strongest reason the candidate \
fits; one or two paragraphs connecting 2 or 3 specific achievements from the resume to the \
job's most important requirements; a short closing with a clear, confident call to action.
3. Specific over generic. Mention the company by name if it is known; never guess facts about it.
4. No clichés ("I am writing to express my interest", "passionate", "dynamic", "team player", \
"I believe I would be a great fit"). No flattery. No em dashes or en dashes.
5. Plain text only. No markdown, no placeholders like [Company] or [Date], no address block.
6. Start with "Dear Hiring Manager," (or "Dear <Company> team," if the company is known) and \
end with "Sincerely," followed by the candidate's name on its own line."""

length_guide: dict[Length, str] = {
    "short": "Keep it to about 150 words in 3 short paragraphs.",
    "standard": "Keep it to about 250 to 320 words in 4 paragraphs.",
}


class CoverLetterRequest(CamelModel):
    job_description: str = Field(min_length=1, max_length=20_000)
    resume: ResumeDoc
    analysis: JobAnalysis
    length: Length = "standard"


@router.post("/cover-letter", response_class=EventSourceResponse)
@limiter.limit(settings.rate_limit_tailor)
async def cover_letter(
    request: Request, body: CoverLetterRequest
) -> AsyncIterator[ServerSentEvent]:
    """Streams `token` events with text chunks, then `done` (or `error`)."""
    user = (
        f"TARGET JOB:\n{json.dumps(body.analysis.model_dump(by_alias=True))}\n\n"
        f"JOB DESCRIPTION:\n<<<\n{body.job_description[:8000]}\n>>>\n\n"
        f"CANDIDATE RESUME (the only source of facts):\n"
        f"{json.dumps(body.resume.model_dump(by_alias=True), ensure_ascii=False)}\n\n"
        f"{length_guide[body.length]}\nWrite the cover letter now."
    )
    try:
        async for chunk in llm.stream(
            system=system_prompt, user=user, temperature=0.6, max_tokens=2000
        ):
            if await request.is_disconnected():
                return
            text = chunk.replace("\u2014", ", ").replace("\u2013", "-")
            yield ServerSentEvent(data=text, event="token")
        yield ServerSentEvent(data={"model": llm.active_model()}, event="done")
    except AppError as e:
        yield ServerSentEvent(data=e.to_dict(), event="error")

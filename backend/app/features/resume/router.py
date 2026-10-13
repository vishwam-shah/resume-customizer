from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, File, Request, UploadFile
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.errors import AppError
from app.core.rate_limit import limiter
from app.features.resume.models import ParsedFile
from app.features.resume.parser import parse_resume

router = APIRouter(tags=["resume"])


@router.post("/resumes/parse")
@limiter.limit(settings.rate_limit_default)
async def parse(request: Request, file: Annotated[UploadFile, File()]) -> ParsedFile:
    """Validate an uploaded PDF/DOCX and extract its text. Nothing is stored."""
    # Read one byte past the limit so an oversized upload is caught without
    # buffering the whole thing.
    data = await file.read(settings.max_upload_bytes + 1)
    if len(data) > settings.max_upload_bytes:
        raise AppError(
            "fileTooLarge",
            f"This file is over the {settings.max_upload_bytes // (1024 * 1024)} MB limit.",
            hint="Resumes are usually under 1 MB. Remove embedded images or re-export the PDF.",
            status=413,
        )
    return await run_in_threadpool(parse_resume, file.filename or "resume", data)

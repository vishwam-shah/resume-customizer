from __future__ import annotations

import re
from typing import Literal

from fastapi import APIRouter, Request, Response
from pydantic import Field
from starlette.concurrency import run_in_threadpool

from app.core.errors import AppError
from app.core.rate_limit import limiter
from app.core.schemas import CamelModel
from app.features.export import docx_writer, pdf
from app.features.resume.models import ResumeDoc
from app.features.resume.render_text import resume_to_text

router = APIRouter(tags=["export"])

Format = Literal["pdf", "docx", "txt"]
media_types: dict[Format, str] = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "txt": "text/plain; charset=utf-8",
}


class ExportRequest(CamelModel):
    kind: Literal["resume", "coverLetter"] = "resume"
    format: Format
    resume: ResumeDoc
    cover_letter: str | None = Field(default=None, max_length=10_000)


def _file_stem(name: str, kind: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9]+", "-", name).strip("-") or "resume"
    return f"{slug}-{'Resume' if kind == 'resume' else 'Cover-Letter'}"


def _render(body: ExportRequest) -> bytes:
    author = body.resume.contact.name
    if body.kind == "coverLetter":
        text = (body.cover_letter or "").strip()
        if not text:
            raise AppError(
                "emptyCoverLetter",
                "There's no cover letter to download yet.",
                hint="Generate the cover letter first.",
            )
        if body.format == "pdf":
            return pdf.html_to_pdf(
                pdf.letter_html(text), title=f"{author} cover letter", author=author
            )
        if body.format == "docx":
            return docx_writer.letter_docx(text, author)
        return text.encode()
    if body.format == "pdf":
        return pdf.html_to_pdf(
            pdf.resume_html(body.resume), title=f"{author} resume", author=author
        )
    if body.format == "docx":
        return docx_writer.resume_docx(body.resume)
    return resume_to_text(body.resume).encode()


@router.post("/export", response_class=Response)
@limiter.limit("30/minute")
async def export(request: Request, body: ExportRequest) -> Response:
    """Render the resume or cover letter as PDF, DOCX or plain text."""
    content = await run_in_threadpool(_render, body)
    file_name = f"{_file_stem(body.resume.contact.name, body.kind)}.{body.format}"
    return Response(
        content,
        media_type=media_types[body.format],
        headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
    )

from __future__ import annotations

import json
import re
from typing import Literal

import pymupdf
from fastapi import APIRouter, Request, Response
from pydantic import Field
from starlette.concurrency import run_in_threadpool

from app.core.errors import AppError
from app.core.rate_limit import limiter
from app.core.schemas import CamelModel
from app.features.export import docx_writer, jake, pdf
from app.features.resume.models import ResumeDoc
from app.features.resume.render_text import resume_to_text

router = APIRouter(tags=["export"])

Format = Literal["pdf", "docx", "txt", "tex", "png"]
media_types: dict[Format, str] = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "txt": "text/plain; charset=utf-8",
    "tex": "application/x-tex; charset=utf-8",
    "png": "image/png",
}


class ExportRequest(CamelModel):
    kind: Literal["resume", "coverLetter"] = "resume"
    format: Format
    resume: ResumeDoc
    cover_letter: str | None = Field(default=None, max_length=10_000)
    paper: pdf.Paper = "a4"


class FitInfo(CamelModel):
    """How the resume was fitted on one page (sent as the X-Resume-Fit header)."""

    pages: int
    font_size: float
    trimmed: list[str]


def _file_stem(name: str, kind: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9]+", "-", name).strip("-") or "resume"
    return f"{slug}-{'Resume' if kind == 'resume' else 'Cover-Letter'}"


def _render(body: ExportRequest) -> tuple[bytes, FitInfo | None]:
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
            letter = pdf.letter_html(text)
            return pdf.html_to_pdf(letter, title=f"{author} cover letter", author=author), None
        if body.format == "docx":
            return docx_writer.letter_docx(text, author), None
        return text.encode(), None

    if body.format == "txt":
        return resume_to_text(body.resume).encode(), None
    # PDF, Word and LaTeX share the one-page fit, so every format carries the
    # same content.
    fit = pdf.fit_resume(body.resume, body.paper)
    info = FitInfo(pages=fit.pages, font_size=fit.font_size, trimmed=fit.trimmed)
    if body.format == "pdf":
        return fit.pdf, info
    if body.format == "docx":
        return docx_writer.resume_docx(fit.doc), info
    if body.format == "png":
        # Exact preview of the PDF page; images display on every device.
        with pymupdf.open(stream=fit.pdf, filetype="pdf") as document:
            return document[0].get_pixmap(dpi=144).tobytes("png"), info
    return jake.resume_latex(fit.doc).encode(), info


@router.post("/export", response_class=Response)
@limiter.limit("30/minute")
async def export(request: Request, body: ExportRequest) -> Response:
    """Render the resume (one page) or cover letter as PDF, DOCX, LaTeX or text."""
    content, fit = await run_in_threadpool(_render, body)
    file_name = f"{_file_stem(body.resume.contact.name, body.kind)}.{body.format}"
    disposition = "inline" if body.format == "png" else "attachment"
    headers = {"Content-Disposition": f'{disposition}; filename="{file_name}"'}
    if fit:
        headers["X-Resume-Fit"] = json.dumps(fit.model_dump(by_alias=True))
    return Response(content, media_type=media_types[body.format], headers=headers)

from __future__ import annotations

import re
from typing import Literal

import pymupdf
from fastapi import APIRouter, Request, Response
from pydantic import Field
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.errors import AppError
from app.core.rate_limit import limiter
from app.core.schemas import CamelModel
from app.features.latex.apply import apply_tailoring
from app.features.latex.compile import compile_latex
from app.features.latex.convert import latex_to_text
from app.features.latex.fit import fit_latex
from app.features.resume.models import ParsedFile, ResumeDoc

router = APIRouter(tags=["latex"])

max_source_chars = 200_000


class LatexSource(CamelModel):
    source: str = Field(min_length=1, max_length=max_source_chars)


class LatexApplyRequest(LatexSource):
    original: ResumeDoc
    tailored: ResumeDoc
    # Compile and trim least-relevant bullets until the result is one page.
    fit_one_page: bool = True


class LatexApplyResult(CamelModel):
    source: str
    bullets_updated: int
    summary_updated: bool
    skills_updated: int
    unmatched: list[str]
    bullets_removed: int = 0
    # Compiled page count, or None when not compiled on this server.
    pages: int | None = None
    compile_error: str | None = None


@router.post("/latex/parse")
@limiter.limit(settings.rate_limit_default)
async def parse_latex(request: Request, body: LatexSource) -> ParsedFile:
    """Read a pasted LaTeX resume into the same shape as an uploaded file."""
    if "\\" not in body.source:
        raise AppError(
            "notLatex",
            "This doesn't look like LaTeX.",
            hint="Paste the full .tex source, from \documentclass to \end{document}.",
            status=422,
        )
    text = latex_to_text(body.source)
    if len(text) < settings.min_resume_chars:
        raise AppError(
            "noTextFound",
            "We couldn't find enough resume text in this LaTeX.",
            hint="Paste the whole document, including \begin{document} and the body.",
            status=422,
        )
    warnings = []
    if "\begin{document}" not in body.source:
        warnings.append("No \begin{document} found; treating the paste as the document body.")
    return ParsedFile(
        file_name="resume.tex",
        size_bytes=len(body.source.encode()),
        file_type="tex",
        page_count=1,
        text=text,
        word_count=len(re.findall(r"[A-Za-z][A-Za-z'+#.-]*", text)),
        warnings=warnings,
    )


@router.post("/latex/apply")
@limiter.limit("20/minute")
async def apply_latex(request: Request, body: LatexApplyRequest) -> LatexApplyResult:
    """Write the tailored text into the user's LaTeX, layout untouched, and by
    default keep it on one page by trimming the least relevant bullets."""
    if body.fit_one_page:
        fit = await run_in_threadpool(fit_latex, body.source, body.original, body.tailored)
        report, pages, compile_error = fit.report, fit.pages, fit.compile_error
    else:
        report = apply_tailoring(body.source, body.original, body.tailored)
        pages, compile_error = None, None
    return LatexApplyResult(
        source=report.source,
        bullets_updated=report.bullets_updated,
        summary_updated=report.summary_updated,
        skills_updated=report.skills_updated,
        unmatched=report.unmatched,
        bullets_removed=report.bullets_removed,
        pages=pages,
        compile_error=compile_error,
    )


class LatexCompileRequest(LatexSource):
    format: Literal["pdf", "png"] = "pdf"


@router.post("/latex/compile", response_class=Response)
@limiter.limit("10/minute")
async def compile_source(request: Request, body: LatexCompileRequest) -> Response:
    """Compile LaTeX to PDF (or a PNG of page 1 for previews). X-Pages has the page count."""
    result = await run_in_threadpool(compile_latex, body.source)
    headers = {"X-Pages": str(result.pages)}
    if body.format == "png":
        with pymupdf.open(stream=result.pdf, filetype="pdf") as document:
            image = document[0].get_pixmap(dpi=144).tobytes("png")
        return Response(image, media_type="image/png", headers=headers)
    headers["Content-Disposition"] = 'attachment; filename="resume.pdf"'
    return Response(result.pdf, media_type="application/pdf", headers=headers)

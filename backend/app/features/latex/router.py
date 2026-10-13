from __future__ import annotations

import re

from fastapi import APIRouter, Request
from pydantic import Field

from app.core.config import settings
from app.core.errors import AppError
from app.core.rate_limit import limiter
from app.core.schemas import CamelModel
from app.features.latex.apply import apply_tailoring
from app.features.latex.convert import latex_to_text
from app.features.resume.models import ParsedFile, ResumeDoc

router = APIRouter(tags=["latex"])

max_source_chars = 200_000


class LatexSource(CamelModel):
    source: str = Field(min_length=1, max_length=max_source_chars)


class LatexApplyRequest(LatexSource):
    original: ResumeDoc
    tailored: ResumeDoc


class LatexApplyResult(CamelModel):
    source: str
    bullets_updated: int
    summary_updated: bool
    skills_updated: int
    unmatched: list[str]


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
@limiter.limit("60/minute")
async def apply_latex(request: Request, body: LatexApplyRequest) -> LatexApplyResult:
    """Write the tailored text back into the user's LaTeX, leaving layout untouched."""
    report = apply_tailoring(body.source, body.original, body.tailored)
    return LatexApplyResult(
        source=report.source,
        bullets_updated=report.bullets_updated,
        summary_updated=report.summary_updated,
        skills_updated=report.skills_updated,
        unmatched=report.unmatched,
    )

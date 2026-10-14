"""Keep a tailored LaTeX resume on one page.

Applies the tailored text to the user's template, compiles it, and if it runs
over one page, applies progressively trimmed versions of the tailored resume
(the same least-relevant-first policy as the PDF export) until it fits. The
template itself is never changed. Trim depth is found by binary search, so a
fit costs a handful of compiles rather than one per bullet.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.core.errors import AppError
from app.features.export.pdf import trim_steps
from app.features.latex.apply import ApplyReport, apply_tailoring
from app.features.latex.compile import compile_latex, engine
from app.features.resume.models import ResumeDoc


@dataclass
class FitReport:
    report: ApplyReport
    pages: int | None  # None when the source couldn't be compiled here
    trimmed: list[str] = field(default_factory=list)
    compile_error: str | None = None


def _pages(source: str) -> int:
    return compile_latex(source).pages


def fit_latex(source: str, original: ResumeDoc, tailored: ResumeDoc) -> FitReport:
    report = apply_tailoring(source, original, tailored)
    if not engine():
        return FitReport(report, pages=None)
    try:
        pages = _pages(report.source)
    except AppError as e:
        # Don't trim around a compile error; show it so it can be fixed.
        return FitReport(report, pages=None, compile_error=e.message)
    if pages <= 1:
        return FitReport(report, pages=pages)

    steps = list(trim_steps(tailored))
    if not steps:
        return FitReport(report, pages=pages)
    applied: dict[int, ApplyReport] = {}

    def fits(index: int) -> bool:
        applied[index] = apply_tailoring(source, original, steps[index][0])
        return _pages(applied[index].source) <= 1

    last = len(steps) - 1
    if not fits(last):
        # Even maximal trimming won't fit: keep the full tailored text.
        return FitReport(report, pages=pages)
    # Trimming is monotonic, so find the least trimming that fits.
    low, high = 0, last
    while low < high:
        middle = (low + high) // 2
        if fits(middle):
            high = middle
        else:
            low = middle + 1
    return FitReport(applied[low], pages=1, trimmed=steps[low][1])

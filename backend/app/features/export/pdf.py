"""ATS-safe, one-page PDF in the style of Jake's Resume.

One column, real selectable text, standard section headings and an embedded
Unicode font (Noto Sans), so every character, bullets included, extracts
cleanly for applicant tracking systems. Rendered with PyMuPDF's Story (HTML +
CSS to PDF): no system libraries, identical on a laptop and in the container.

`fit_resume` guarantees one page. It first tightens typography in small
steps down to a readable floor; only if that is not enough does it trim
content, always from the least relevant end (bullets are already ordered
most-relevant-first by tailoring), and it reports exactly what it removed.
"""

from __future__ import annotations

import io
from dataclasses import dataclass, field
from html import escape
from typing import Literal

import pymupdf

from app.features.resume.models import ResumeDoc
from app.features.resume.render_text import date_range

Paper = Literal["a4", "letter"]


@dataclass(frozen=True)
class _Layout:
    font: float  # body size, pt
    line: float  # line height multiplier
    margin: float  # page margin, pt
    gap: float  # space above section headings, pt


# Loosest first. The last entry is the readability floor.
_layouts = [
    _Layout(10.5, 1.32, 44, 10),
    _Layout(10.25, 1.28, 40, 9),
    _Layout(10, 1.25, 38, 8),
    _Layout(9.75, 1.22, 34, 7),
    _Layout(9.5, 1.2, 30, 6),
]


@dataclass
class FitResult:
    pdf: bytes
    doc: ResumeDoc  # what was actually rendered (after any trimming)
    font_size: float
    pages: int
    trimmed: list[str] = field(default_factory=list)


def _e(text: str | None) -> str:
    return escape(text or "")


def _css(layout: _Layout) -> str:
    small = round(layout.font * 0.92, 2)
    return f"""
body {{ font-family: body; font-size: {layout.font}pt; line-height: {layout.line};
        color: #000; }}
h1 {{ font-size: {round(layout.font * 2.1, 1)}pt; font-weight: bold; text-align: center;
      margin: 0; line-height: 1.1; }}
.headline {{ text-align: center; margin: 2pt 0 0 0; }}
.contact {{ text-align: center; font-size: {small}pt; margin: 3pt 0 0 0; }}
a {{ color: #000; text-decoration: none; }}
h2 {{ font-size: {round(layout.font * 1.08, 2)}pt; font-weight: bold; text-transform: uppercase;
      letter-spacing: 0.6pt; margin: {layout.gap}pt 0 2pt 0; padding-bottom: 1pt;
      border-bottom: 0.6pt solid #000; }}
table {{ width: 100%; border-collapse: collapse; margin: {round(layout.gap * 0.45, 1)}pt 0 0 0; }}
td {{ padding: 0; vertical-align: top; }}
td.r {{ text-align: right; white-space: nowrap; }}
.sub td {{ font-style: italic; font-size: {small}pt; }}
p {{ margin: 0 0 1pt 0; }}
ul {{ margin: 1pt 0 0 0; padding-left: 12pt; }}
li {{ margin: 0 0 0.5pt 0; }}
"""


def _row(left: str, right: str, sub: bool = False) -> str:
    cls = " class='sub'" if sub else ""
    return f"<tr{cls}><td>{left}</td><td class='r'>{right}</td></tr>"


def _bullets(items: list[str]) -> str:
    return "<ul>" + "".join(f"<li>{_e(i)}</li>" for i in items) + "</ul>" if items else ""


def _link(url: str) -> str:
    shown = url.removeprefix("https://").removeprefix("http://").removeprefix("www.").rstrip("/")
    href = url if "://" in url else f"https://{url}"
    return f"<a href='{_e(href)}'>{_e(shown)}</a>"


_profile_hosts = (
    "linkedin.",
    "github.",
    "gitlab.",
    "behance.",
    "dribbble.",
    "medium.",
    "x.com",
    "twitter.",
    "leetcode.",
    "kaggle.",
    "stackoverflow.",
)


def _host(url: str) -> str:
    return url.split("://")[-1].removeprefix("www.").split("/")[0].lower()


def _is_profile(url: str) -> bool:
    """A profile page (github.com/name), not a repository (github.com/name/repo)."""
    path = [p for p in url.split("://")[-1].split("/")[1:] if p]
    return (
        any(h in _host(url) for h in _profile_hosts)
        and len(path) <= 2
        and ("linkedin." in _host(url) or len(path) <= 1)
    )


def header_links(doc: ResumeDoc, limit: int = 4) -> list[str]:
    """Profile links for the header; links that belong to a project are left out.

    A link is a project's if a project already carries it, its address contains
    the project's name ("chatzen.in" for "ChatZen"), or it is a repository rather
    than a profile (github.com/name/repo). Profiles and a
    portfolio come first; the header keeps at most `limit` links.
    """
    project_hosts = {_host(p.link) for p in doc.projects if p.link}
    names = ["".join(ch for ch in p.name.lower() if ch.isalnum()) for p in doc.projects]

    def belongs_to_project(url: str) -> bool:
        host = _host(url)
        flat = "".join(ch for ch in url.lower() if ch.isalnum())
        is_profile = _is_profile(url)
        named = any(n and len(n) > 3 and n in flat for n in names)
        repo_or_post = any(h in host for h in _profile_hosts) and not is_profile
        return not is_profile and (host in project_hosts or named or repo_or_post)

    links = [link.url for link in doc.contact.links if not belongs_to_project(link.url)]
    profiles = [u for u in links if _is_profile(u)]
    others = [u for u in links if u not in profiles]
    return (profiles + others)[:limit]


def resume_html(doc: ResumeDoc) -> str:
    c = doc.contact
    out = [f"<h1>{_e(c.name)}</h1>"]
    if c.headline:
        out.append(f"<p class='headline'>{_e(c.headline)}</p>")
    contact = [_e(p) for p in (c.phone, c.email, c.location) if p]
    contact += [_link(url) for url in header_links(doc)]
    if contact:
        out.append(f"<p class='contact'>{' &nbsp;|&nbsp; '.join(contact)}</p>")

    if doc.summary:
        out += ["<h2>Summary</h2>", f"<p>{_e(doc.summary)}</p>"]
    if doc.experience:
        out.append("<h2>Experience</h2>")
        for job in doc.experience:
            rows = _row(f"<b>{_e(job.role)}</b>", _e(date_range(job.start, job.end)))
            rows += _row(_e(job.company), _e(job.location), sub=True)
            out.append(f"<table>{rows}</table>{_bullets(job.bullets)}")
    if doc.projects:
        out.append("<h2>Projects</h2>")
        for project in doc.projects:
            link = _link(project.link) if project.link else ""
            out.append(f"<table>{_row(f'<b>{_e(project.name)}</b>', link)}</table>")
            out.append(_bullets(project.bullets))
    if doc.skills:
        out.append("<h2>Technical Skills</h2>")
        out += [f"<p><b>{_e(g.name)}:</b> {_e(', '.join(g.items))}</p>" for g in doc.skills]
    if doc.education:
        out.append("<h2>Education</h2>")
        for ed in doc.education:
            rows = _row(f"<b>{_e(ed.school)}</b>", _e(date_range(ed.start, ed.end)))
            rows += _row(_e(ed.degree), _e(ed.location), sub=True)
            out.append(f"<table>{rows}</table>{_bullets(ed.details)}")
    for extra in doc.extras:
        if extra.items:
            out.append(f"<h2>{_e(extra.title)}</h2>{_bullets(extra.items)}")
    return "".join(out)


def _story(html: str, css: str) -> tuple[pymupdf.Story, pymupdf.Archive]:
    archive = pymupdf.Archive()
    font_css = pymupdf.css_for_pymupdf_font("notos", archive=archive, name="body")
    return pymupdf.Story(
        html=f"<body>{html}</body>", user_css=font_css + css, archive=archive
    ), archive


def _render(html: str, css: str, paper: Paper, margin: float, *, title: str, author: str):
    """Render to PDF bytes; returns (bytes, page count)."""
    story, _archive = _story(html, css)
    buffer = io.BytesIO()
    writer = pymupdf.DocumentWriter(buffer)
    page = pymupdf.paper_rect(paper)
    content = pymupdf.Rect(page.x0 + margin, page.y0 + margin, page.x1 - margin, page.y1 - margin)
    pages, more = 0, True
    while more:
        device = writer.begin_page(page)
        more, _ = story.place(content)
        story.draw(device)
        writer.end_page()
        pages += 1
    writer.close()
    pdf = pymupdf.open(stream=buffer.getvalue(), filetype="pdf")
    with pdf:
        pdf.set_metadata({"title": title, "author": author, "creator": "Tailor"})
        pdf.subset_fonts()  # embed only the glyphs used: ~40 KB instead of ~1.4 MB
        return pdf.tobytes(garbage=3, deflate=True), pages


def _fits(doc: ResumeDoc, layout: _Layout, paper: Paper) -> bool:
    story, _archive = _story(resume_html(doc), _css(layout))
    page = pymupdf.paper_rect(paper)
    m = layout.margin
    more, _ = story.place(pymupdf.Rect(page.x0 + m, page.y0 + m, page.x1 - m, page.y1 - m))
    return not more


def _trim_steps(doc: ResumeDoc):
    """Ever-shorter versions of the resume, one removal at a time.

    Bullets are tailored most-relevant-first, so cuts come from the end of a
    list, older roles before recent ones, and each role keeps at least one
    bullet (the most recent keeps two). Projects lose bullets before whole
    projects go, and at least one project stays. Contact details, titles,
    dates, skills and education are never removed. Yields (doc, notes).
    """
    current = doc.model_copy(deep=True)
    bullets_cut, projects_cut = 0, []

    def notes() -> list[str]:
        out = []
        if bullets_cut:
            out.append(f"{bullets_cut} lower-priority bullet{'s' if bullets_cut != 1 else ''}")
        if projects_cut:
            out.append(f"project{'s' if len(projects_cut) > 1 else ''} {', '.join(projects_cut)}")
        return out

    def next_cut() -> bool:
        nonlocal bullets_cut
        # 1. Project bullets beyond the first, from the last project.
        for project in reversed(current.projects):
            if len(project.bullets) > 1:
                project.bullets.pop()
                bullets_cut += 1
                return True
        # 2. Experience bullets, oldest role first, keeping a floor per role.
        for index in range(len(current.experience) - 1, -1, -1):
            job = current.experience[index]
            if len(job.bullets) > (2 if index == 0 else 1):
                job.bullets.pop()
                bullets_cut += 1
                return True
        # 3. Whole projects, last first, keeping one.
        if len(current.projects) > 1:
            projects_cut.append(current.projects.pop().name)
            return True
        return False

    while next_cut():
        yield current, notes()


def fit_resume(doc: ResumeDoc, paper: Paper = "a4") -> FitResult:
    """Render on exactly one page when at all possible (see module docstring)."""
    title, author = f"{doc.contact.name} resume", doc.contact.name

    def done(d: ResumeDoc, layout: _Layout, trimmed: list[str]) -> FitResult:
        pdf, pages = _render(
            resume_html(d), _css(layout), paper, layout.margin, title=title, author=author
        )
        return FitResult(pdf=pdf, doc=d, font_size=layout.font, pages=pages, trimmed=trimmed)

    for layout in _layouts:
        if _fits(doc, layout, paper):
            return done(doc, layout, [])

    floor = _layouts[-1]
    for trimmed_doc, note in _trim_steps(doc):
        if _fits(trimmed_doc, floor, paper):
            return done(trimmed_doc, floor, note)
    # Extraordinarily long resume: render everything rather than gut it further.
    return done(doc, floor, [])


def letter_html(text: str) -> str:
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    return "".join(f"<p>{_e(p).replace(chr(10), '<br/>')}</p><p>&nbsp;</p>" for p in paragraphs)


def html_to_pdf(html: str, *, title: str, author: str) -> bytes:
    """Free-flowing document (cover letter), same font and look."""
    layout = _Layout(11, 1.45, 64, 0)
    pdf, _ = _render(html, _css(layout), "a4", layout.margin, title=title, author=author)
    return pdf

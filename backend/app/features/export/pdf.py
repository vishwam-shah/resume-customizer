"""ATS-safe PDF: one column, real text, standard headings, no tables or images.

Rendered with PyMuPDF's Story (HTML + CSS to PDF), which needs no system
libraries, so it behaves the same on a laptop and in the container.
"""

from __future__ import annotations

import io
from html import escape

import pymupdf

from app.features.resume.models import ResumeDoc
from app.features.resume.render_text import contact_line, date_range

css = """
* { font-family: sans-serif; }
body { font-size: 10pt; line-height: 1.35; color: #111; }
h1 { font-size: 20pt; margin: 0; }
.headline { font-size: 11pt; margin: 2pt 0 0 0; }
.contact { font-size: 9pt; margin: 4pt 0 0 0; color: #333; }
h2 { font-size: 10.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1pt;
     margin: 12pt 0 4pt 0; }
h3 { font-size: 10pt; font-weight: bold; margin: 6pt 0 0 0; }
.meta { font-size: 9pt; color: #333; margin: 0 0 2pt 0; }
p { margin: 0 0 3pt 0; }
ul { margin: 0 0 2pt 0; padding-left: 14pt; }
li { margin: 0 0 2pt 0; }
"""


def _e(text: str | None) -> str:
    return escape(text or "")


def resume_html(doc: ResumeDoc) -> str:
    c = doc.contact
    out = [f"<h1>{_e(c.name)}</h1>"]
    if c.headline:
        out.append(f"<p class='headline'>{_e(c.headline)}</p>")
    if line := contact_line(doc):
        out.append(f"<p class='contact'>{_e(line)}</p>")

    if doc.summary:
        out += ["<h2>Summary</h2>", f"<p>{_e(doc.summary)}</p>"]
    if doc.skills:
        out.append("<h2>Skills</h2>")
        out += [f"<p><b>{_e(g.name)}:</b> {_e(', '.join(g.items))}</p>" for g in doc.skills]
    if doc.experience:
        out.append("<h2>Experience</h2>")
        for job in doc.experience:
            out.append(f"<h3>{_e(job.role)}, {_e(job.company)}</h3>")
            meta = " | ".join(p for p in [job.location, date_range(job.start, job.end)] if p)
            if meta:
                out.append(f"<p class='meta'>{_e(meta)}</p>")
            out.append("<ul>" + "".join(f"<li>{_e(b)}</li>" for b in job.bullets) + "</ul>")
    if doc.projects:
        out.append("<h2>Projects</h2>")
        for project in doc.projects:
            out.append(f"<h3>{_e(project.name)}</h3>")
            if project.link:
                out.append(f"<p class='meta'>{_e(project.link)}</p>")
            out.append("<ul>" + "".join(f"<li>{_e(b)}</li>" for b in project.bullets) + "</ul>")
    if doc.education:
        out.append("<h2>Education</h2>")
        for ed in doc.education:
            out.append(f"<h3>{_e(ed.degree)}, {_e(ed.school)}</h3>")
            meta = " | ".join(p for p in [ed.location, date_range(ed.start, ed.end)] if p)
            if meta:
                out.append(f"<p class='meta'>{_e(meta)}</p>")
            if ed.details:
                out.append("<ul>" + "".join(f"<li>{_e(d)}</li>" for d in ed.details) + "</ul>")
    for extra in doc.extras:
        if extra.items:
            out.append(f"<h2>{_e(extra.title)}</h2>")
            out.append("<ul>" + "".join(f"<li>{_e(i)}</li>" for i in extra.items) + "</ul>")
    return "".join(out)


def letter_html(text: str) -> str:
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    return "".join(f"<p>{_e(p).replace(chr(10), '<br/>')}</p><p></p>" for p in paragraphs)


def html_to_pdf(html: str, *, title: str, author: str) -> bytes:
    story = pymupdf.Story(html=f"<body>{html}</body>", user_css=css)
    buffer = io.BytesIO()
    writer = pymupdf.DocumentWriter(buffer)
    page = pymupdf.paper_rect("a4")
    content = pymupdf.Rect(page.x0 + 50, page.y0 + 50, page.x1 - 50, page.y1 - 50)
    more = True
    while more:
        device = writer.begin_page(page)
        more, _ = story.place(content)
        story.draw(device)
        writer.end_page()
    writer.close()

    # Set document metadata; ATS and email previews show the title.
    pdf = pymupdf.open(stream=buffer.getvalue(), filetype="pdf")
    with pdf:
        pdf.set_metadata({"title": title, "author": author, "creator": "Resume Customizer"})
        return pdf.tobytes(garbage=3, deflate=True)

"""ATS-safe Word document: built-in Heading and List Bullet styles, no tables."""

from __future__ import annotations

import io

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt

from app.features.resume.models import ResumeDoc
from app.features.resume.render_text import contact_line, date_range


def _new_document(title: str, author: str) -> Document:
    document = Document()
    document.core_properties.title = title
    document.core_properties.author = author
    style = document.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(10.5)
    for section in document.sections:
        section.left_margin = section.right_margin = Pt(54)
        section.top_margin = section.bottom_margin = Pt(48)
    return document


def _bytes(document: Document) -> bytes:
    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def _entry(document: Document, heading: str, meta: str, bullets: list[str]) -> None:
    p = document.add_paragraph()
    p.add_run(heading).bold = True
    p.paragraph_format.space_after = Pt(0)
    if meta:
        m = document.add_paragraph(meta)
        m.paragraph_format.space_after = Pt(2)
    for bullet in bullets:
        document.add_paragraph(bullet, style="List Bullet")


def resume_docx(doc: ResumeDoc) -> bytes:
    document = _new_document(f"{doc.contact.name} resume", doc.contact.name)
    name = document.add_heading(doc.contact.name, level=0)
    name.alignment = WD_ALIGN_PARAGRAPH.LEFT
    if doc.contact.headline:
        document.add_paragraph(doc.contact.headline)
    if line := contact_line(doc):
        document.add_paragraph(line)

    if doc.summary:
        document.add_heading("Summary", level=1)
        document.add_paragraph(doc.summary)
    if doc.skills:
        document.add_heading("Skills", level=1)
        for group in doc.skills:
            p = document.add_paragraph()
            p.add_run(f"{group.name}: ").bold = True
            p.add_run(", ".join(group.items))
    if doc.experience:
        document.add_heading("Experience", level=1)
        for job in doc.experience:
            meta = " | ".join(p for p in [job.location, date_range(job.start, job.end)] if p)
            _entry(document, f"{job.role}, {job.company}", meta, job.bullets)
    if doc.projects:
        document.add_heading("Projects", level=1)
        for project in doc.projects:
            _entry(document, project.name, project.link or "", project.bullets)
    if doc.education:
        document.add_heading("Education", level=1)
        for ed in doc.education:
            meta = " | ".join(p for p in [ed.location, date_range(ed.start, ed.end)] if p)
            _entry(document, f"{ed.degree}, {ed.school}", meta, ed.details)
    for extra in doc.extras:
        if extra.items:
            document.add_heading(extra.title, level=1)
            for item in extra.items:
                document.add_paragraph(item, style="List Bullet")
    return _bytes(document)


def letter_docx(text: str, author: str) -> bytes:
    document = _new_document(f"{author} cover letter", author)
    for paragraph in (p.strip() for p in text.split("\n\n")):
        if paragraph:
            document.add_paragraph(paragraph)
    return _bytes(document)

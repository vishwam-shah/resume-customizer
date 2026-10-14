"""ATS-safe Word documents.

The resume mirrors the one-page PDF: same (already fitted) content, compact
type, and dates right-aligned with a tab stop rather than a table, which
some ATS parsers read out of order. Built-in heading and list styles only.
"""

from __future__ import annotations

import io

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt

from app.features.export.pdf import header_links
from app.features.resume.models import ResumeDoc
from app.features.resume.render_text import date_range

font_name = "Calibri"


def _new_document(title: str, author: str, *, size: float, margin: float) -> Document:
    document = Document()
    document.core_properties.title = title
    document.core_properties.author = author
    normal = document.styles["Normal"]
    normal.font.name = font_name
    normal.font.size = Pt(size)
    normal.paragraph_format.space_after = Pt(0)
    normal.paragraph_format.line_spacing = 1.05
    bullet = document.styles["List Bullet"]
    bullet.font.size = Pt(size)
    bullet.paragraph_format.space_after = Pt(0)
    for section in document.sections:
        section.left_margin = section.right_margin = Pt(margin)
        section.top_margin = section.bottom_margin = Pt(margin)
    return document


def _bytes(document: Document) -> bytes:
    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def _usable_width(document: Document):
    section = document.sections[0]
    return section.page_width - section.left_margin - section.right_margin


def _rule_below(paragraph) -> None:
    """A thin line under a section heading, as in the PDF."""
    borders = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    for key, value in (("val", "single"), ("sz", "4"), ("space", "1"), ("color", "000000")):
        bottom.set(qn(f"w:{key}"), value)
    borders.append(bottom)
    paragraph._p.get_or_add_pPr().append(borders)


def _heading(document: Document, text: str) -> None:
    p = document.add_paragraph()
    p.paragraph_format.space_before = Pt(7)
    p.paragraph_format.space_after = Pt(2)
    run = p.add_run(text.upper())
    run.bold = True
    run.font.size = Pt(11)
    _rule_below(p)


def _split_line(document: Document, left: str, right: str, *, bold=False, italic=False) -> None:
    p = document.add_paragraph()
    p.paragraph_format.tab_stops.add_tab_stop(_usable_width(document), WD_TAB_ALIGNMENT.RIGHT)
    run = p.add_run(left)
    run.bold, run.italic = bold, italic
    if right:
        tail = p.add_run(f"\t{right}")
        tail.italic = italic


def _bullets(document: Document, items: list[str]) -> None:
    for item in items:
        document.add_paragraph(item, style="List Bullet")


def resume_docx(doc: ResumeDoc) -> bytes:
    document = _new_document(f"{doc.contact.name} resume", doc.contact.name, size=10, margin=36)
    c = doc.contact
    name = document.add_paragraph()
    name.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = name.add_run(c.name)
    run.bold = True
    run.font.size = Pt(20)
    if c.headline:
        document.add_paragraph(c.headline).alignment = WD_ALIGN_PARAGRAPH.CENTER
    contact = [p for p in (c.phone, c.email, c.location) if p] + header_links(doc)
    if contact:
        line = document.add_paragraph(" | ".join(contact))
        line.alignment = WD_ALIGN_PARAGRAPH.CENTER

    if doc.summary:
        _heading(document, "Summary")
        document.add_paragraph(doc.summary)
    if doc.experience:
        _heading(document, "Experience")
        for job in doc.experience:
            _split_line(document, job.role, date_range(job.start, job.end), bold=True)
            _split_line(document, job.company, job.location or "", italic=True)
            _bullets(document, job.bullets)
    if doc.projects:
        _heading(document, "Projects")
        for project in doc.projects:
            _split_line(document, project.name, project.link or "", bold=True)
            _bullets(document, project.bullets)
    if doc.skills:
        _heading(document, "Technical Skills")
        for group in doc.skills:
            p = document.add_paragraph()
            p.add_run(f"{group.name}: ").bold = True
            p.add_run(", ".join(group.items))
    if doc.education:
        _heading(document, "Education")
        for ed in doc.education:
            _split_line(document, ed.school, date_range(ed.start, ed.end), bold=True)
            _split_line(document, ed.degree, ed.location or "", italic=True)
            _bullets(document, ed.details)
    for extra in doc.extras:
        if extra.items:
            _heading(document, extra.title)
            _bullets(document, extra.items)
    return _bytes(document)


def letter_docx(text: str, author: str) -> bytes:
    document = _new_document(f"{author} cover letter", author, size=11, margin=64)
    for paragraph in (p.strip() for p in text.split("\n\n")):
        if paragraph:
            document.add_paragraph(paragraph).paragraph_format.space_after = Pt(10)
    return _bytes(document)

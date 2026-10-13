"""Extract text from an uploaded PDF or DOCX resume.

Validation checks the bytes, not just the extension: a renamed .exe or a
password-protected PDF gets a specific, actionable error rather than a crash
or an empty resume further down the pipeline.
"""

from __future__ import annotations

import io
import re
import zipfile
from pathlib import Path

import docx
import pymupdf
from docx.table import Table
from docx.text.paragraph import Paragraph

from app.core.config import settings
from app.core.errors import AppError
from app.features.resume.models import ParsedFile

pdf_magic = b"%PDF-"
zip_magic = b"PK\x03\x04"
garbled_glyph = re.compile(r"\(cid:\d+\)|\ufffd")
word_pattern = re.compile(r"[A-Za-z][A-Za-z'+#.-]*")


def _human_size(n: int) -> str:
    return f"{n / (1024 * 1024):.1f} MB" if n >= 1024 * 1024 else f"{max(1, n // 1024)} KB"


def _detect_type(file_name: str, data: bytes) -> str:
    ext = Path(file_name).suffix.lower()
    if ext == ".doc":
        raise AppError(
            "unsupportedFileType",
            "Old Word .doc files aren't supported.",
            hint="In Word, choose File > Save As > Word Document (.docx), or export as PDF.",
            status=415,
        )
    if ext not in {".pdf", ".docx"}:
        raise AppError(
            "unsupportedFileType",
            f"'{ext or 'no extension'}' files can't be read.",
            hint="Upload your resume as a PDF or a Word (.docx) file.",
            status=415,
        )
    if ext == ".pdf" and not data.startswith(pdf_magic):
        raise AppError(
            "corruptFile",
            "This file is named .pdf but isn't a valid PDF.",
            hint="Re-export the resume as a PDF and upload it again.",
        )
    if ext == ".docx":
        if not data.startswith(zip_magic):
            raise AppError(
                "corruptFile",
                "This file is named .docx but isn't a valid Word file.",
                hint="Open it in Word and save it again as .docx.",
            )
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                if "word/document.xml" not in z.namelist():
                    raise AppError(
                        "corruptFile",
                        "This .docx file has no document content.",
                        hint="Open it in Word and save it again as .docx.",
                    )
        except zipfile.BadZipFile as e:
            raise AppError(
                "corruptFile",
                "This Word file is damaged and can't be opened.",
                hint="Open it in Word and save it again as .docx.",
            ) from e
    return ext.lstrip(".")


def _pdf_text(data: bytes) -> tuple[str, int]:
    try:
        doc = pymupdf.open(stream=data, filetype="pdf")
    except Exception as e:
        raise AppError(
            "corruptFile",
            "This PDF is damaged and can't be opened.",
            hint="Re-export the resume as a PDF and upload it again.",
        ) from e
    with doc:
        if doc.needs_pass:
            raise AppError(
                "encryptedFile",
                "This PDF is password-protected.",
                hint="Remove the password (print to PDF works) and upload it again.",
            )
        if doc.page_count > settings.max_resume_pages:
            raise AppError(
                "tooManyPages",
                f"This PDF has {doc.page_count} pages; the limit is {settings.max_resume_pages}.",
                hint="Upload just your resume, not a portfolio or combined document.",
            )
        # sort=True reads multi-column layouts top-to-bottom, left-to-right.
        pages = [page.get_text("text", sort=True) for page in doc]
        # Profile links are often icons whose URL lives only in a link
        # annotation; without this they'd vanish from the tailored resume.
        urls = [link["uri"] for page in doc for link in page.get_links() if link.get("uri")]
        return "\n".join(pages) + _links_block(urls), doc.page_count


def _links_block(urls: list[str]) -> str:
    unique = [u for u in dict.fromkeys(urls) if not u.lower().startswith(("mailto:", "tel:"))]
    return "\n\nLinks:\n" + "\n".join(unique) if unique else ""


def _docx_text(data: bytes) -> str:
    try:
        document = docx.Document(io.BytesIO(data))
    except Exception as e:
        raise AppError(
            "corruptFile",
            "This Word file is damaged and can't be opened.",
            hint="Open it in Word and save it again as .docx.",
        ) from e

    lines: list[str] = []
    urls: list[str] = []
    # Headers often hold the name and contact details.
    for section in document.sections:
        lines += [p.text for p in section.header.paragraphs]

    # Body in document order, including tables (common in resume templates).
    def walk(blocks) -> None:
        for block in blocks:
            if isinstance(block, Paragraph):
                lines.append(block.text)
                urls.extend(h.url for h in block.hyperlinks if h.url)
            elif isinstance(block, Table):
                for row in block.rows:
                    seen: set[int] = set()
                    for cell in row.cells:
                        # Merged cells repeat; read each underlying cell once.
                        if id(cell._tc) in seen:
                            continue
                        seen.add(id(cell._tc))
                        walk(cell.iter_inner_content())

    walk(document.iter_inner_content())
    return "\n".join(lines) + _links_block(urls)


def _clean(text: str) -> str:
    text = text.replace("\u00a0", " ").replace("\u200b", "")
    # Icon fonts (Font Awesome etc.) map glyphs to the Private Use Area.
    text = re.sub(r"[\ue000-\uf8ff]", "", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n\s*\n+", "\n\n", text)
    return text.strip()


def parse_resume(file_name: str, data: bytes) -> ParsedFile:
    if not data:
        raise AppError(
            "emptyFile", "The uploaded file is empty.", hint="Choose your resume file again."
        )
    if len(data) > settings.max_upload_bytes:
        raise AppError(
            "fileTooLarge",
            f"This file is {_human_size(len(data))}; the limit is "
            f"{_human_size(settings.max_upload_bytes)}.",
            hint="Resumes are usually under 1 MB. Remove embedded images or re-export the PDF.",
            status=413,
        )

    file_type = _detect_type(file_name, data)
    if file_type == "pdf":
        raw, pages = _pdf_text(data)
    else:
        raw, pages = _docx_text(data), 1

    text = _clean(raw)
    warnings: list[str] = []
    word_count = len(word_pattern.findall(text))

    if len(text) < settings.min_resume_chars:
        raise AppError(
            "noTextFound",
            "We couldn't find readable text in this file.",
            hint="It may be a scanned image. Export the resume from Word or Google Docs as a "
            "text-based PDF, or upload the .docx.",
            status=422,
        )
    if len(garbled_glyph.findall(text)) > 10:
        warnings.append(
            "Some characters didn't extract cleanly (the PDF uses custom font encoding). "
            "Many applicant tracking systems will have the same problem; the tailored "
            "download fixes it."
        )
        text = garbled_glyph.sub("", text)
    if word_count > 1500:
        warnings.append(f"Your resume is long ({word_count} words). Tailoring will tighten it.")

    return ParsedFile(
        file_name=Path(file_name).name,
        size_bytes=len(data),
        file_type=file_type,
        page_count=pages,
        text=text,
        word_count=word_count,
        warnings=warnings,
    )

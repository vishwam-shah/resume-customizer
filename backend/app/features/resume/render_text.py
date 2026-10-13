"""Flatten a structured resume into plain text.

Used for scoring (what an ATS would read), the .txt download, and as LLM
context. Section headings are the conventional ones ATS parsers look for.
"""

from __future__ import annotations

from app.features.resume.models import ResumeDoc


def date_range(start: str | None, end: str | None) -> str:
    if start and end:
        return f"{start} to {end}"
    return start or end or ""


def contact_line(doc: ResumeDoc) -> str:
    c = doc.contact
    parts = [c.email, c.phone, c.location, *(link.url for link in c.links)]
    return " | ".join(p for p in parts if p)


def resume_to_text(doc: ResumeDoc) -> str:
    lines: list[str] = [doc.contact.name]
    if doc.contact.headline:
        lines.append(doc.contact.headline)
    if contact := contact_line(doc):
        lines.append(contact)

    if doc.summary:
        lines += ["", "SUMMARY", doc.summary]

    if doc.skills:
        lines += ["", "SKILLS"]
        lines += [f"{g.name}: {', '.join(g.items)}" for g in doc.skills if g.items]

    if doc.experience:
        lines += ["", "EXPERIENCE"]
        for job in doc.experience:
            heading = f"{job.role}, {job.company}"
            meta = " | ".join(p for p in [job.location, date_range(job.start, job.end)] if p)
            lines.append(f"{heading} ({meta})" if meta else heading)
            lines += [f"- {b}" for b in job.bullets]

    if doc.projects:
        lines += ["", "PROJECTS"]
        for project in doc.projects:
            lines.append(f"{project.name} ({project.link})" if project.link else project.name)
            lines += [f"- {b}" for b in project.bullets]

    if doc.education:
        lines += ["", "EDUCATION"]
        for ed in doc.education:
            meta = " | ".join(p for p in [ed.location, date_range(ed.start, ed.end)] if p)
            lines.append(f"{ed.degree}, {ed.school}" + (f" ({meta})" if meta else ""))
            lines += [f"- {d}" for d in ed.details]

    for extra in doc.extras:
        if extra.items:
            lines += ["", extra.title.upper()]
            lines += [f"- {item}" for item in extra.items]

    return "\n".join(lines).strip()

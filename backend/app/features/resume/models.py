"""Structured resume, the single shape every feature works on.

The same model is the LLM's output schema when a raw resume is structured, so
every field is required (no defaults) and optional values are nullable. That
is what strict JSON-schema modes (Groq strict, OpenAI) demand.
"""

from __future__ import annotations

from app.core.schemas import CamelModel


class ContactLink(CamelModel):
    label: str
    url: str


class Contact(CamelModel):
    name: str
    headline: str | None
    email: str | None
    phone: str | None
    location: str | None
    links: list[ContactLink]


class SkillGroup(CamelModel):
    name: str
    items: list[str]


class ExperienceItem(CamelModel):
    id: str
    role: str
    company: str
    location: str | None
    start: str | None
    end: str | None
    bullets: list[str]


class ProjectItem(CamelModel):
    id: str
    name: str
    link: str | None
    bullets: list[str]


class EducationItem(CamelModel):
    id: str
    degree: str
    school: str
    location: str | None
    start: str | None
    end: str | None
    details: list[str]


class ExtraSection(CamelModel):
    """Anything else the resume carries: certifications, awards, languages."""

    title: str
    items: list[str]


class ResumeDoc(CamelModel):
    contact: Contact
    summary: str | None
    skills: list[SkillGroup]
    experience: list[ExperienceItem]
    projects: list[ProjectItem]
    education: list[EducationItem]
    extras: list[ExtraSection]


class ParsedFile(CamelModel):
    """What the upload endpoint returns: the file facts plus extracted text."""

    file_name: str
    size_bytes: int
    file_type: str
    page_count: int
    text: str
    word_count: int
    warnings: list[str]

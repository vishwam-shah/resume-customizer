from __future__ import annotations

from typing import Literal

from pydantic import Field

from app.core.schemas import CamelModel
from app.features.job.models import JobAnalysis
from app.features.resume.models import ResumeDoc, SkillGroup
from app.features.scoring.models import Scores

Section = Literal["summary", "skills", "experience", "projects"]
Tone = Literal["balanced", "confident", "concise"]


# ---- LLM output ---------------------------------------------------------------


class TailoredEntry(CamelModel):
    id: str
    bullets: list[str]


class KeywordSuggestion(CamelModel):
    keyword: str
    section: Literal["summary", "skills", "experience", "projects"]
    suggestion: str


class TermEvidence(CamelModel):
    """A job term the model used because the resume shows a concrete instance
    of it ("vector databases" because the resume lists "Pinecone")."""

    term: str
    evidence: list[str]


class TailorOutput(CamelModel):
    summary: str
    skills: list[SkillGroup]
    experience: list[TailoredEntry]
    projects: list[TailoredEntry]
    term_evidence: list[TermEvidence]
    keyword_suggestions: list[KeywordSuggestion]
    change_notes: list[str]


# ---- API ----------------------------------------------------------------------


class TailorRequest(CamelModel):
    job_description: str = Field(min_length=1, max_length=20_000)
    resume_text: str = Field(min_length=1, max_length=60_000)
    # Sent back on later runs so a new version skips re-reading the inputs.
    resume: ResumeDoc | None = None
    analysis: JobAnalysis | None = None
    sections: list[Section] = Field(
        default_factory=lambda: ["summary", "skills", "experience", "projects"], min_length=1
    )
    tone: Tone = "balanced"
    # Skills the candidate confirmed they genuinely have ("I have this" in the
    # UI). Usable in Skills and the summary; bullets still need evidence.
    confirmed_skills: list[str] = Field(default_factory=list, max_length=40)


class Flag(CamelModel):
    """Something the guard changed or wants the user to double-check."""

    section: Section
    item_id: str | None
    message: str


class TailorResult(CamelModel):
    resume: ResumeDoc
    suggestions: list[KeywordSuggestion]
    notes: list[str]
    flags: list[Flag]
    scores: Scores

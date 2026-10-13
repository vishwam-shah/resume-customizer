from __future__ import annotations

from typing import Literal

from app.core.schemas import CamelModel

Seniority = Literal["intern", "entry", "mid", "senior", "lead", "principal", "unspecified"]


class JobAnalysis(CamelModel):
    title: str
    company: str | None
    seniority: Seniority
    summary: str
    must_have_skills: list[str]
    nice_to_have_skills: list[str]
    keywords: list[str]
    responsibilities: list[str]

    def all_keywords(self) -> list[str]:
        """Every distinct term, highest priority first, case-insensitively unique."""
        seen: set[str] = set()
        out: list[str] = []
        for term in [*self.must_have_skills, *self.keywords, *self.nice_to_have_skills]:
            key = term.strip().lower()
            if key and key not in seen:
                seen.add(key)
                out.append(term.strip())
        return out

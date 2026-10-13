"""Enforce the grounding rules on the model's output before the user sees it.

The prompt asks the model not to invent; this module checks. A bullet that
introduces a number or a job keyword its original never had is reverted to
the original wording, and the user gets a flag explaining why. Skills the
resume never showed are moved out of the skills list into suggestions.
"""

from __future__ import annotations

import re
from difflib import SequenceMatcher

from app.features.job.models import JobAnalysis
from app.features.resume.models import ExperienceItem, ProjectItem, ResumeDoc
from app.features.resume.render_text import resume_to_text
from app.features.scoring.keywords import contains_term
from app.features.tailor.models import (
    Flag,
    KeywordSuggestion,
    Section,
    TailoredEntry,
    TailorOutput,
    TermEvidence,
)

number_re = re.compile(r"\d+(?:[.,]\d+)*")


def clean_dashes(text: str) -> str:
    """No em/en dashes in output; keep ranges like 2021-2023 readable."""
    text = re.sub(r"(?<=\d)\s*[\u2013\u2014]\s*(?=\d)", "-", text)
    text = re.sub(r"\s*[\u2013\u2014]\s*", ", ", text)
    return text.strip()


def numbers_in(text: str) -> set[str]:
    return {n.replace(",", "") for n in number_re.findall(text)}


def _similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


class _Guard:
    def __init__(
        self, original: ResumeDoc, analysis: JobAnalysis, evidence: list[TermEvidence]
    ) -> None:
        self.original = original
        self.original_text = resume_to_text(original)
        self.original_low = self.original_text.lower()
        self.original_numbers = numbers_in(self.original_text)
        self.job_terms = analysis.all_keywords()
        # Umbrella terms the model justified with concrete resume wording.
        self.evidence: dict[str, list[str]] = {}
        for e in evidence:
            self.evidence.setdefault(e.term.strip().lower(), []).extend(e.evidence)
        self.flags: list[Flag] = []
        self.moved_skills: list[str] = []

    def invented_numbers(self, text: str) -> set[str]:
        return numbers_in(text) - self.original_numbers

    def supported(self, term: str, context_low: str) -> bool:
        """The context shows the term itself, or verified evidence for it."""
        if contains_term(context_low, term):
            return True
        proof = self.evidence.get(term.strip().lower(), [])
        return any(len(p.strip()) > 1 and p.strip().lower() in context_low for p in proof)

    def unsupported_terms(self, new: str, context_low: str) -> list[str]:
        """Job terms the text now claims that its context never showed."""
        new_low = new.lower()
        return [
            t
            for t in self.job_terms
            if contains_term(new_low, t) and not self.supported(t, context_low)
        ]

    def summary(self, tailored: str) -> str | None:
        tailored = clean_dashes(tailored)
        if not tailored:
            return self.original.summary
        claims = sorted(self.invented_numbers(tailored)) + self.unsupported_terms(
            tailored, self.original_low
        )
        if claims:
            self.flags.append(
                Flag(
                    section="summary",
                    item_id=None,
                    message=f"The summary mentions {', '.join(claims)}, which your original "
                    "resume doesn't show. Check it's accurate before sending.",
                )
            )
        return tailored

    def skills(self, tailored: list) -> list:
        if not tailored:
            return self.original.skills
        kept_groups = []
        for group in tailored:
            items = []
            for item in group.items:
                item = clean_dashes(item)
                if self.supported(item, self.original_low):
                    items.append(item)
                else:
                    self.moved_skills.append(item)
            if items:
                group.items = items
                kept_groups.append(group)
        if self.moved_skills:
            self.flags.append(
                Flag(
                    section="skills",
                    item_id=None,
                    message=f"Kept out of Skills because your resume doesn't show them: "
                    f"{', '.join(self.moved_skills)}. See Suggestions if they're true.",
                )
            )
        return kept_groups or self.original.skills

    def bullets(
        self,
        section: Section,
        original: ExperienceItem | ProjectItem,
        tailored: TailoredEntry | None,
    ) -> list[str]:
        if tailored is None or not tailored.bullets:
            return original.bullets
        entry_low = " ".join(
            [*original.bullets, getattr(original, "role", ""), getattr(original, "name", "")]
        ).lower()
        source = list(original.bullets)
        result: list[str] = []
        reverted = 0
        for raw in tailored.bullets[: len(source)]:
            bullet = clean_dashes(raw)
            closest = max(source, key=lambda b: _similarity(b, bullet)) if source else None
            if closest is not None and (
                self.invented_numbers(bullet) or self.unsupported_terms(bullet, entry_low)
            ):
                bullet = closest
                reverted += 1
            if closest is not None:
                source.remove(closest)
            result.append(bullet)
        # A dropped bullet is lost work history; put any unmatched originals back.
        result += source
        if reverted:
            self.flags.append(
                Flag(
                    section=section,
                    item_id=original.id,
                    message=f"{reverted} bullet{'s' if reverted > 1 else ''} kept as originally "
                    "written, because the rewrite added a number or skill your resume "
                    "doesn't show.",
                )
            )
        return result


def apply_output(
    original: ResumeDoc, output: TailorOutput, analysis: JobAnalysis, sections: list[Section]
) -> tuple[ResumeDoc, list[KeywordSuggestion], list[Flag]]:
    guard = _Guard(original, analysis, output.term_evidence)
    doc = original.model_copy(deep=True)

    if "summary" in sections:
        doc.summary = guard.summary(output.summary)
    if "skills" in sections:
        doc.skills = guard.skills(output.skills)
    if "experience" in sections:
        by_id = {e.id: e for e in output.experience}
        for job in doc.experience:
            job.bullets = guard.bullets("experience", job, by_id.get(job.id))
    if "projects" in sections:
        by_id = {e.id: e for e in output.projects}
        for project in doc.projects:
            project.bullets = guard.bullets("projects", project, by_id.get(project.id))

    suggestions = [
        s
        for s in output.keyword_suggestions
        if not contains_term(resume_to_text(doc).lower(), s.keyword)
    ]
    known = {s.keyword.lower() for s in suggestions}
    for skill in guard.moved_skills:
        if skill.lower() not in known:
            suggestions.append(
                KeywordSuggestion(
                    keyword=skill,
                    section="skills",
                    suggestion=f"If you have real experience with {skill}, add it to Skills and "
                    "to the bullet where you used it.",
                )
            )
    for s in suggestions:
        s.suggestion = clean_dashes(s.suggestion)
    return doc, suggestions[:10], guard.flags

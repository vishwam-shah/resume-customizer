"""How well a resume covers what one job asks for, 0 to 100.

Weighted keyword coverage: hard requirements count three times, ATS keywords
twice, nice-to-haves once. Deterministic, so the before/after numbers mean
something and the user can see exactly which terms moved them.
"""

from __future__ import annotations

from app.features.job.models import JobAnalysis
from app.features.scoring.keywords import split_matches
from app.features.scoring.models import MatchScore


def _dedupe(terms: list[str], exclude: set[str]) -> list[str]:
    out: list[str] = []
    for t in terms:
        key = t.strip().lower()
        if key and key not in exclude:
            exclude.add(key)
            out.append(t.strip())
    return out


def match_score(resume_text: str, job: JobAnalysis) -> MatchScore:
    seen: set[str] = set()
    must = _dedupe(job.must_have_skills, seen)
    keywords = _dedupe(job.keywords, seen)
    nice = _dedupe(job.nice_to_have_skills, seen)

    must_hit, must_miss = split_matches(resume_text, must)
    kw_hit, kw_miss = split_matches(resume_text, keywords)
    nice_hit, nice_miss = split_matches(resume_text, nice)

    weights = ((must, must_hit, 3), (keywords, kw_hit, 2), (nice, nice_hit, 1))
    total = sum(len(group) * w for group, _, w in weights)
    earned = sum(len(hit) * w for _, hit, w in weights)
    score = round(100 * earned / total) if total else 100

    return MatchScore(
        score=score,
        matched_must_have=must_hit,
        missing_must_have=must_miss,
        matched_keywords=kw_hit,
        missing_keywords=kw_miss,
        matched_nice_to_have=nice_hit,
        missing_nice_to_have=nice_miss,
    )

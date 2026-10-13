from __future__ import annotations

from app.core.schemas import CamelModel


class ScoreComponent(CamelModel):
    key: str
    label: str
    points: float
    max_points: float
    detail: str


class AtsScore(CamelModel):
    score: int
    components: list[ScoreComponent]
    issues: list[str]


class MatchScore(CamelModel):
    score: int
    matched_must_have: list[str]
    missing_must_have: list[str]
    matched_keywords: list[str]
    missing_keywords: list[str]
    matched_nice_to_have: list[str]
    missing_nice_to_have: list[str]


class Scores(CamelModel):
    match: MatchScore
    ats: AtsScore

"""Deterministic ATS-readiness score, 0 to 100.

Applies the checks real applicant tracking systems apply: can the parser find
standard sections and contact details, does the resume contain the posting's
keywords, are achievements concrete. Transparent and repeatable; no tool can
promise a specific score inside a particular employer's private ATS.
"""

from __future__ import annotations

import re

from app.features.job.models import JobAnalysis
from app.features.resume.models import ResumeDoc
from app.features.resume.render_text import resume_to_text
from app.features.scoring.keywords import contains_term, split_matches
from app.features.scoring.models import AtsScore, ScoreComponent

action_verbs = {
    "accelerated",
    "achieved",
    "analyzed",
    "architected",
    "automated",
    "built",
    "championed",
    "collaborated",
    "created",
    "cut",
    "decreased",
    "defined",
    "delivered",
    "deployed",
    "designed",
    "developed",
    "directed",
    "drove",
    "enabled",
    "engineered",
    "established",
    "expanded",
    "generated",
    "grew",
    "implemented",
    "improved",
    "increased",
    "integrated",
    "introduced",
    "launched",
    "led",
    "managed",
    "mentored",
    "migrated",
    "modernized",
    "negotiated",
    "optimized",
    "orchestrated",
    "organized",
    "owned",
    "partnered",
    "pioneered",
    "planned",
    "produced",
    "rebuilt",
    "redesigned",
    "reduced",
    "refactored",
    "resolved",
    "saved",
    "scaled",
    "shipped",
    "simplified",
    "spearheaded",
    "standardized",
    "streamlined",
    "trained",
    "transformed",
    "unified",
}
title_noise = {
    "senior",
    "junior",
    "staff",
    "lead",
    "principal",
    "remote",
    "hybrid",
    "intern",
    "the",
    "and",
    "for",
    "with",
    "of",
    "ii",
    "iii",
    "iv",
}
quantified = re.compile(r"\d+\s*%|\$\s?\d|\b\d[\d,.]*\s*(?:k|m|bn|x|\+)?\b", re.I)
email_re = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
phone_re = re.compile(r"\+?\d[\d\s().-]{7,}\d")


def _bullets(doc: ResumeDoc) -> list[str]:
    return [b for job in doc.experience for b in job.bullets] + [
        b for p in doc.projects for b in p.bullets
    ]


def ats_score(doc: ResumeDoc, job: JobAnalysis) -> AtsScore:
    text = resume_to_text(doc)
    low = text.lower()
    components: list[ScoreComponent] = []
    issues: list[str] = []

    # Keyword coverage (40): the dominant ranking signal in keyword-based ATS.
    terms = job.all_keywords()
    hit, _ = split_matches(text, terms)
    coverage = len(hit) / len(terms) if terms else 1.0
    components.append(
        ScoreComponent(
            key="keywords",
            label="Job keywords",
            points=round(40 * coverage, 1),
            max_points=40,
            detail=f"{len(hit)} of {len(terms)} posting keywords present",
        )
    )

    # Title alignment (10): recruiters search by title.
    words = {
        w
        for w in re.findall(r"[a-z][a-z.+#]*", job.title.lower())
        if len(w) > 1 and w not in title_noise
    }
    title_hit = {w for w in words if contains_term(low, w)}
    title_points = round(10 * len(title_hit) / len(words), 1) if words else 10.0
    components.append(
        ScoreComponent(
            key="title",
            label="Job title match",
            points=title_points,
            max_points=10,
            detail=f"{len(title_hit)} of {len(words)} title words present",
        )
    )
    if title_points < 10:
        issues.append(f'Use the exact title "{job.title}" in your headline or summary.')

    # Standard sections (15).
    sections = {
        "Summary": bool(doc.summary),
        "Skills": bool(doc.skills),
        "Experience": bool(doc.experience),
        "Education": bool(doc.education),
    }
    present = [name for name, ok in sections.items() if ok]
    components.append(
        ScoreComponent(
            key="sections",
            label="Standard sections",
            points=round(15 * len(present) / len(sections), 1),
            max_points=15,
            detail=f"{len(present)} of {len(sections)}: {', '.join(present) or 'none'}",
        )
    )
    issues += [f"Add a {name} section." for name, ok in sections.items() if not ok]

    # Contact details (10).
    c = doc.contact
    contact_points = (
        (4 if c.email and email_re.search(c.email) else 0)
        + (3 if c.phone and phone_re.search(c.phone) else 0)
        + (3 if c.links else 0)
    )
    components.append(
        ScoreComponent(
            key="contact",
            label="Contact details",
            points=contact_points,
            max_points=10,
            detail="Email, phone and a profile link",
        )
    )
    if not c.email:
        issues.append("Add an email address.")
    if not c.phone:
        issues.append("Add a phone number.")
    if not c.links:
        issues.append("Add a LinkedIn, GitHub or portfolio link.")

    # Quantified impact (15): full marks when 40% of bullets carry a number.
    bullets = _bullets(doc)
    with_numbers = [b for b in bullets if quantified.search(b)]
    ratio = len(with_numbers) / len(bullets) if bullets else 0.0
    components.append(
        ScoreComponent(
            key="impact",
            label="Quantified impact",
            points=round(min(15.0, 15 * ratio / 0.4), 1),
            max_points=15,
            detail=f"{len(with_numbers)} of {len(bullets)} bullets include a number",
        )
    )
    if bullets and ratio < 0.4:
        issues.append("Add real numbers (users, time saved, revenue, scale) to more bullets.")

    # Action verbs (5): full marks when 60% of bullets open with one.
    openers = [b.split()[0].lower().strip(".,:;") for b in bullets if b.split()]
    strong = sum(1 for w in openers if w in action_verbs)
    verb_ratio = strong / len(openers) if openers else 0.0
    components.append(
        ScoreComponent(
            key="verbs",
            label="Action verbs",
            points=round(min(5.0, 5 * verb_ratio / 0.6), 1),
            max_points=5,
            detail=f"{strong} of {len(openers)} bullets start with an action verb",
        )
    )

    # Length (5): 350 to 900 words reads as a focused one or two pager.
    word_count = len(re.findall(r"[A-Za-z][A-Za-z'-]+", text))
    if 350 <= word_count <= 900:
        length_points = 5.0
    elif 250 <= word_count < 350 or 900 < word_count <= 1200:
        length_points = 3.0
    else:
        length_points = 1.0
        issues.append(f"Your resume is {word_count} words; aim for 350 to 900.")
    components.append(
        ScoreComponent(
            key="length",
            label="Length",
            points=length_points,
            max_points=5,
            detail=f"{word_count} words",
        )
    )

    total = round(sum(comp.points for comp in components))
    return AtsScore(score=min(100, total), components=components, issues=issues)

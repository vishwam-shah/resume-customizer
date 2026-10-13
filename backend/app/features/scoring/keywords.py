"""Keyword matching that respects word boundaries and common variants."""

from __future__ import annotations

import re

# Spellings that mean the same thing to a recruiter and most ATS engines.
_aliases: dict[str, tuple[str, ...]] = {
    "javascript": ("js",),
    "typescript": ("ts",),
    "node.js": ("node", "nodejs"),
    "next.js": ("nextjs",),
    "react": ("react.js", "reactjs"),
    "vue": ("vue.js", "vuejs"),
    "postgresql": ("postgres",),
    "kubernetes": ("k8s",),
    "amazon web services": ("aws",),
    "aws": ("amazon web services",),
    "google cloud": ("gcp", "google cloud platform"),
    "gcp": ("google cloud", "google cloud platform"),
    "machine learning": ("ml",),
    "artificial intelligence": ("ai",),
    "continuous integration": ("ci/cd", "ci"),
    "ci/cd": ("continuous integration", "continuous delivery"),
    "rest api": ("restful", "rest apis", "rest"),
    "golang": ("go",),
}


def _pattern(term: str) -> re.Pattern[str]:
    # Boundaries that work for terms with punctuation ("c++", "node.js", "ci/cd")
    # and tolerate a plural ("REST APIs").
    return re.compile(r"(?<![a-z0-9+#])" + re.escape(term.lower()) + r"(?:s|es)?(?![a-z0-9+#])")


def contains_term(text_lower: str, term: str) -> bool:
    term = term.strip().lower()
    if not term:
        return False
    variants = (term, *_aliases.get(term, ()))
    return any(_pattern(v).search(text_lower) for v in variants)


def split_matches(text: str, terms: list[str]) -> tuple[list[str], list[str]]:
    low = text.lower()
    matched = [t for t in terms if contains_term(low, t)]
    missing = [t for t in terms if t not in matched]
    return matched, missing

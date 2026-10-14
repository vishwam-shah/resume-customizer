"""Keyword matching that respects word boundaries and common variants.

Matching is deliberately generous about *spelling* (hyphens, spaces, joined
words, plurals, well-known aliases) and strict about *meaning* (whole words
only, so "java" never matches "javascript"). Under-counting a skill the
resume plainly shows would push people to stuff keywords; over-counting
would flatter them.
"""

from __future__ import annotations

import re
from functools import lru_cache

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
    "large language models": ("llm", "llms"),
    "llm": ("large language model", "large language models"),
    "continuous integration": ("ci/cd", "ci"),
    "ci/cd": ("continuous integration", "continuous delivery", "ci cd"),
    "rest api": ("restful", "rest apis", "rest"),
    "golang": ("go",),
    "retrieval augmented generation": ("rag",),
    "rag": ("retrieval augmented generation",),
}


def _pattern(term: str) -> re.Pattern[str]:
    # Boundaries that work for terms with punctuation ("c++", "node.js", "ci/cd")
    # and tolerate a plural ("REST APIs").
    return re.compile(r"(?<![a-z0-9+#])" + re.escape(term) + r"(?:s|es)?(?![a-z0-9+#])")


def _spellings(term: str) -> set[str]:
    """'full-stack' -> {'full-stack', 'full stack', 'fullstack'}."""
    words = re.split(r"[\s\-_]+", term)
    out = {term}
    if len(words) > 1:
        out |= {" ".join(words), "-".join(words), "".join(words)}
    return out


@lru_cache(maxsize=4096)
def _variants(term: str) -> tuple[re.Pattern[str], ...]:
    names = {term, *_aliases.get(term, ())}
    spellings = {s for name in names for s in _spellings(name)}
    return tuple(_pattern(s) for s in spellings)


def _normalize(text_lower: str) -> str:
    # Hyphenated and spaced forms read the same ("full-stack" == "full stack").
    return re.sub(r"(?<=[a-z0-9])[-_](?=[a-z0-9])", " ", text_lower)


def contains_term(text_lower: str, term: str) -> bool:
    term = term.strip().lower()
    if not term:
        return False
    texts = (text_lower, _normalize(text_lower))
    return any(p.search(t) for p in _variants(term) for t in texts)


def split_matches(text: str, terms: list[str]) -> tuple[list[str], list[str]]:
    low = text.lower()
    matched = [t for t in terms if contains_term(low, t)]
    missing = [t for t in terms if t not in matched]
    return matched, missing

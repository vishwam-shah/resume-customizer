"""Write a tailored resume back into the user's own LaTeX source.

Deterministic, not generated: the model never touches the LaTeX, so the
preamble, macros and layout come back byte-for-byte. Only text is swapped:

- bullets: every `\\item ...` and every argument of a macro that wraps an
  `\\item` (e.g. `\\resumeItem{...}` in Jake's template) is matched to an
  original bullet; a list whose bullets were reordered is rewritten in the
  tailored order;
- summary: the section body that reads like the original summary;
- skills: the item list on the line of each skill group.

Anything that can't be placed unambiguously is reported, never guessed.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from difflib import SequenceMatcher

from app.features.latex.convert import _comment, _macros, escape, latex_to_text, read_braced
from app.features.resume.models import ResumeDoc
from app.features.tailor.guard import pair_bullets


@dataclass
class _Span:
    start: int
    end: int
    text: str  # readable text of the span
    # The whole bullet command (e.g. "\resumeItem{...}" or "\item ..."), for deletion.
    outer_start: int = 0
    outer_end: int = 0
    entry: str | None = None
    index: int | None = None  # index of the original bullet it holds


@dataclass
class ApplyReport:
    source: str
    bullets_updated: int = 0
    bullets_removed: int = 0
    summary_updated: bool = False
    skills_updated: int = 0
    unmatched: list[str] = field(default_factory=list)


def _similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, " ".join(a.lower().split()), " ".join(b.lower().split())).ratio()


def _is_commented(source: str, pos: int) -> bool:
    line_start = source.rfind("\n", 0, pos) + 1
    return bool(_comment.search(source[line_start:pos]))


def _body_bounds(source: str) -> tuple[int, int]:
    start = source.find(r"\begin{document}")
    start = start + len(r"\begin{document}") if start != -1 else 0
    end = source.find(r"\end{document}")
    return start, end if end != -1 else len(source)


def _bullet_spans(source: str) -> list[_Span]:
    body_start, body_end = _body_bounds(source)
    item_macros = [
        name for name, (argc, body) in _macros(source).items() if argc >= 1 and r"\item" in body
    ]
    spans: list[_Span] = []

    for name in item_macros:
        for match in re.finditer(rf"\\{name}(?![A-Za-z])\s*", source[body_start:body_end]):
            pos = body_start + match.end()
            if _is_commented(source, pos) or pos >= len(source) or source[pos] != "{":
                continue
            content, after = read_braced(source, pos)
            spans.append(
                _Span(pos + 1, after - 1, latex_to_text(content), body_start + match.start(), after)
            )

    boundary = re.compile(r"\\item\b|\\end\{|\\begin\{|\\[A-Za-z]*ListEnd\b|\\(?:sub)*section")
    for match in re.finditer(r"\\item\b(\s*\[[^\]]*\])?", source[body_start:body_end]):
        start = body_start + match.end()
        if _is_commented(source, match.start() + body_start):
            continue
        nxt = boundary.search(source, start, body_end)
        end = nxt.start() if nxt else body_end
        while end > start and source[end - 1] in " \t\n":
            end -= 1
        while start < end and source[start] in " \t":
            start += 1
        text = latex_to_text(source[start:end])
        # Inside a macro definition or an already-captured macro argument: skip.
        if text and not any(s.start <= start < s.end for s in spans):
            spans.append(_Span(start, end, text, body_start + match.start(), end))
    return sorted(spans, key=lambda s: s.start)


def _deletion(source: str, span: _Span) -> tuple[int, int, str]:
    """Remove a whole bullet command, and its line when nothing else is on it."""
    start, end = span.outer_start, span.outer_end
    line_start = source.rfind("\n", 0, start) + 1
    line_end = source.find("\n", end)
    line_end = len(source) if line_end == -1 else line_end
    if not source[line_start:start].strip() and not source[end:line_end].strip():
        return line_start, min(line_end + 1, len(source)), ""
    return start, end, ""


def _replace(source: str, edits: list[tuple[int, int, str]]) -> str:
    for start, end, text in sorted(edits, key=lambda e: e[0], reverse=True):
        source = source[:start] + text + source[end:]
    return source


def _assign_spans(spans: list[_Span], original: ResumeDoc) -> None:
    """Match each span to the original bullet it holds (best pairs first)."""
    candidates = []
    for entry in [*original.experience, *original.projects]:
        for index, bullet in enumerate(entry.bullets):
            for span_index, span in enumerate(spans):
                score = _similarity(span.text, bullet)
                if score >= 0.6:
                    candidates.append((score, span_index, entry.id, index))
    taken_spans: set[int] = set()
    taken_bullets: set[tuple[str, int]] = set()
    for _, span_index, entry_id, index in sorted(candidates, reverse=True):
        if span_index in taken_spans or (entry_id, index) in taken_bullets:
            continue
        spans[span_index].entry, spans[span_index].index = entry_id, index
        taken_spans.add(span_index)
        taken_bullets.add((entry_id, index))


def _bullet_edits(source: str, original: ResumeDoc, tailored: ResumeDoc, report: ApplyReport):
    spans = _bullet_spans(source)
    _assign_spans(spans, original)
    edits: list[tuple[int, int, str]] = []
    tailored_by_id = {e.id: e.bullets for e in [*tailored.experience, *tailored.projects]}

    for entry in [*original.experience, *original.projects]:
        new = tailored_by_id.get(entry.id)
        if new is None:
            continue
        mine = [s for s in spans if s.entry == entry.id]
        if not mine:
            if new != entry.bullets:
                report.unmatched.append(f"bullets of {getattr(entry, 'role', None) or entry.name}")
            continue
        pairs = pair_bullets(entry.bullets, new)
        # Every bullet of this entry was found: write the tailored order, and
        # remove the leftover bullets when the tailored list is shorter (trimmed).
        complete = len(mine) == len(entry.bullets) and len(new) <= len(mine)
        for position, span in enumerate(mine):
            if complete and position >= len(new):
                edits.append(_deletion(source, span))
                report.bullets_removed += 1
                continue
            if complete:
                text = new[position]
            else:
                # Partial match: rewrite each found bullet in place, no reordering.
                try:
                    text = new[pairs.index(span.index)]
                except ValueError:
                    continue
            if text.strip() != span.text.strip():
                edits.append((span.start, span.end, escape(text)))
                report.bullets_updated += 1
    return edits


_section = re.compile(r"\\(?:sub)*section\*?\s*\{([^{}]*)\}")
_wrapper = re.compile(r"^(\\[A-Za-z]+\s*\{)(.*)(\})$", re.S)


def _summary_edit(source: str, original: ResumeDoc, tailored: ResumeDoc, report: ApplyReport):
    if not tailored.summary or original.summary == tailored.summary:
        return []
    body_start, body_end = _body_bounds(source)
    if not original.summary:
        return _insert_summary(source, tailored.summary, body_start, body_end, report)
    heads = list(_section.finditer(source, body_start, body_end))
    best: tuple[float, int, int] | None = None
    for i, head in enumerate(heads):
        start = head.end()
        end = heads[i + 1].start() if i + 1 < len(heads) else body_end
        score = _similarity(latex_to_text(source[start:end]), original.summary)
        if score >= 0.6 and (best is None or score > best[0]):
            best = (score, start, end)
    if not best:
        report.unmatched.append("summary")
        return []
    _, start, end = best
    block = source[start:end]
    lead = len(block) - len(block.lstrip())
    trail = len(block) - len(block.rstrip())
    inner = block.strip()
    wrapped = _wrapper.match(inner)
    text = escape(tailored.summary)
    new_inner = f"{wrapped.group(1)}{text}{wrapped.group(3)}" if wrapped else text
    report.summary_updated = True
    return [(start + lead, end - trail, new_inner)]


def _insert_summary(source: str, summary: str, body_start: int, body_end: int, report):
    """No summary in the template: add one before the first section, styled
    with the template's own section command (e.g. \section or \section*)."""
    first = _section.search(source, body_start, body_end)
    if not first:
        report.unmatched.append("summary (no sections found to place it before)")
        return []
    command = first.group(0).split("{", 1)[0]  # "\section" or "\section*"
    block = f"{command}{{Summary}}\n{escape(summary)}\n\n"
    report.summary_updated = True
    return [(first.start(), first.start(), block)]


def _skill_edits(source: str, original: ResumeDoc, tailored: ResumeDoc, report: ApplyReport):
    body_start, body_end = _body_bounds(source)
    by_name = {g.name.strip().lower(): g for g in tailored.skills}
    edits: list[tuple[int, int, str]] = []
    for group in original.skills:
        new = by_name.get(group.name.strip().lower())
        if not new or new.items == group.items:
            continue
        placed = False
        lines: list[tuple[int, int]] = []
        cursor = body_start
        for line in source[body_start:body_end].split("\n"):
            lines.append((cursor, cursor + len(line)))
            cursor += len(line) + 1
        for i, (line_start, line_end) in enumerate(lines):
            if group.name.lower() not in latex_to_text(source[line_start:line_end]).lower():
                continue
            # Items may sit on the same line or the next ones (a tabular row
            # like "\textbf{Languages}" then "& Python, SQL"); stop at a blank line.
            region_end = line_end
            for next_start, next_end in lines[i + 1 : i + 3]:
                if not source[next_start:next_end].strip():
                    break
                region_end = next_end
            raw = source[line_start:region_end]
            name_end = raw.lower().find(escape(group.name).lower())
            offset = name_end + len(group.name) if name_end != -1 else 0
            found = []
            for item in group.items:
                for form in dict.fromkeys([escape(item), item]):
                    at = raw.find(form, offset)
                    if at != -1:
                        found.append((at, at + len(form)))
                        break
            if len(found) < max(2, len(group.items) // 2):
                continue
            found.sort()
            separator = raw[found[0][1] : found[1][0]] if len(found) > 1 else ", "
            if chr(10) in separator or len(separator) > 16:
                separator = ", "  # items weren't adjacent; don't copy stray markup
            text = separator.join(escape(i) for i in new.items)
            edits.append((line_start + found[0][0], line_start + found[-1][1], text))
            report.skills_updated += 1
            placed = True
            break
        if not placed:
            report.unmatched.append(f"skills: {group.name}")
    return edits


def apply_tailoring(source: str, original: ResumeDoc, tailored: ResumeDoc) -> ApplyReport:
    report = ApplyReport(source=source)
    edits = (
        _bullet_edits(source, original, tailored, report)
        + _summary_edit(source, original, tailored, report)
        + _skill_edits(source, original, tailored, report)
    )
    # Overlapping edits would corrupt the source; keep the first of any overlap.
    edits.sort(key=lambda e: e[0])
    safe: list[tuple[int, int, str]] = []
    for edit in edits:
        if not safe or edit[0] >= safe[-1][1]:
            safe.append(edit)
    report.source = _replace(source, safe)
    return report

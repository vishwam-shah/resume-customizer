"""Turn extracted resume text into a `ResumeDoc`, without changing a word."""

from __future__ import annotations

from app.features.resume.models import ResumeDoc
from app.llm import router

system_prompt = """You convert the plain text of a resume into structured JSON. You are a \
careful transcriber, not an editor.

Rules:
1. Copy wording EXACTLY as written. Do not fix grammar, shorten, summarize, or improve anything.
2. Never add information that is not in the text. If something is missing, use null or [].
3. contact: name, headline (the title line under the name, if any), email, phone, location, \
and every URL or profile handle as links (label like "LinkedIn", "GitHub", "Portfolio").
4. summary: the summary / objective / profile paragraph if present, else null.
5. skills: keep the resume's own groups (e.g. "Languages", "Frameworks"). If skills are one flat \
list, use a single group named "Skills". Split comma-separated items into separate entries.
6. experience: one entry per role (a person with two roles at one company gets two entries). \
bullets are the individual achievement lines, without the bullet glyph. If a role is described \
as a paragraph, split it into sentences as bullets.
7. projects: name, link if present, and bullets as in rule 6.
8. education: degree, school, location, dates, and any details (GPA, coursework, honors).
9. extras: every other section (certifications, awards, publications, languages, volunteering) \
with its heading as the title.
10. Dates: copy them as written ("Jan 2023", "2021", "Present").
11. ids: use "exp-1", "exp-2", ... for experience, "proj-1", ... for projects, "edu-1", ... \
for education, in the order they appear.

PDF text extraction can merge columns or break lines mid-sentence; rejoin broken lines into \
whole bullets, and put each piece in the section it belongs to."""


def _normalize_ids(doc: ResumeDoc) -> ResumeDoc:
    """Stable ids regardless of what the model chose; the diff relies on them."""
    for i, job in enumerate(doc.experience, 1):
        job.id = f"exp-{i}"
    for i, project in enumerate(doc.projects, 1):
        project.id = f"proj-{i}"
    for i, ed in enumerate(doc.education, 1):
        ed.id = f"edu-{i}"
    return doc


async def structure_resume(text: str) -> tuple[ResumeDoc, str]:
    doc, model = await router.generate(
        ResumeDoc,
        system=system_prompt,
        user=f"RESUME TEXT:\n<<<\n{text}\n>>>",
        temperature=0.0,
        max_tokens=12000,
    )
    return _normalize_ids(doc), model

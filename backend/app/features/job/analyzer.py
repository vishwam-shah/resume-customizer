"""Read a job description into the facts tailoring and scoring need."""

from __future__ import annotations

from app.features.job.models import JobAnalysis
from app.llm import router

system_prompt = """You are a senior technical recruiter who reads job descriptions the way an \
applicant tracking system (ATS) and a hiring manager both would.

Extract, from the job description only:
- title: the role title exactly as the posting states it (no company, location or level noise).
- company: the hiring company if named, else null.
- seniority: one of intern, entry, mid, senior, lead, principal, unspecified.
- summary: one sentence on what this role mainly does.
- mustHaveSkills: hard requirements ("required", "must", "you have", minimum qualifications). \
Concrete skills, tools, languages, certifications. Max 12.
- niceToHaveSkills: preferred / bonus / "nice to have" items. Max 10.
- keywords: the exact terms an ATS would match on, as written in the posting: technologies, \
methods, domain terms, and important soft-skill phrases. Use the posting's spelling and \
casing ("Node.js", "CI/CD", "stakeholder management"). Most important first. Max 25. \
Do not repeat items that differ only in case.
- responsibilities: the 3 to 6 main duties, each under 15 words.

Rules: use only what the posting says; never infer requirements that aren't there. Keep every \
skill short (1 to 4 words). Ignore benefits, EEO statements and company boilerplate."""


async def analyze_job(job_description: str) -> tuple[JobAnalysis, str]:
    return await router.generate(
        JobAnalysis,
        system=system_prompt,
        user=f"JOB DESCRIPTION:\n<<<\n{job_description}\n>>>",
        temperature=0.1,
        max_tokens=3000,
    )

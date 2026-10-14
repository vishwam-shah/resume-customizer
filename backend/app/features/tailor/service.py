"""The tailoring pipeline, streamed as server-sent events.

    reading    structure the resume text      } run in parallel
    analyzing  extract what the job asks for  }
    scoring    score the original
    tailoring  rewrite the requested sections
    checking   enforce grounding rules, score again

Each stage emits `stage` events (active, done) so the UI can show real
progress, and data events as soon as their data exists.
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import AsyncIterator
from typing import Literal

from fastapi.sse import ServerSentEvent

from app.core.errors import AppError
from app.features.job.analyzer import analyze_job
from app.features.job.models import JobAnalysis
from app.features.resume.models import ResumeDoc
from app.features.resume.render_text import resume_to_text
from app.features.resume.structurer import structure_resume
from app.features.scoring.ats import ats_score
from app.features.scoring.match import match_score
from app.features.scoring.models import Scores
from app.features.tailor import guard, prompts
from app.features.tailor.events import DoneEvent, StageEvent, StageId
from app.features.tailor.models import TailorOutput, TailorRequest, TailorResult
from app.llm import router


def _stage(stage_id: StageId, status: Literal["active", "done"]) -> ServerSentEvent:
    return ServerSentEvent(data=StageEvent(id=stage_id, status=status), event="stage")


match_target = 90


async def _second_pass(req, resume, analysis, tailored, suggestions, flags, output):
    """Below the target match: one more pass aimed at the terms still missing.

    The rewrite is checked against the ORIGINAL resume again, and kept only if
    it scores higher, so this can raise the match but never invent or regress.
    """
    current = score(tailored, analysis).match
    missing = current.missing_must_have + current.missing_keywords
    if current.score >= match_target or not missing:
        return tailored, suggestions, flags, output
    focus = (
        "SECOND PASS. The draft below still misses these job terms: "
        + ", ".join(missing)
        + ". Cover each one ONLY if the original resume or the confirmed skills genuinely "
        "support it (rule 5, with termEvidence); leave the rest in keywordSuggestions. "
        "Keep everything that already works.\n\n"
    )
    try:
        second, _ = await router.generate(
            TailorOutput,
            system=prompts.system_prompt,
            user=prompts.build_user_prompt(
                job_description=req.job_description,
                analysis=analysis,
                resume=tailored,
                sections=req.sections,
                tone=req.tone,
                match=current,
                confirmed=req.confirmed_skills,
                focus=focus,
            ),
            temperature=0.25,
            max_tokens=12000,
        )
    except AppError:
        return tailored, suggestions, flags, output  # the first draft still stands
    improved, s2, f2 = guard.apply_output(
        resume, second, analysis, req.sections, req.confirmed_skills
    )
    if score(improved, analysis).match.score > current.score:
        return improved, s2, f2, second
    return tailored, suggestions, flags, output


def score(doc: ResumeDoc, analysis: JobAnalysis) -> Scores:
    return Scores(match=match_score(resume_to_text(doc), analysis), ats=ats_score(doc, analysis))


async def _prepare(req: TailorRequest) -> AsyncIterator[ServerSentEvent | tuple]:
    """Structure the resume and analyze the job, reusing whatever the client sent."""
    resume_task = None if req.resume else asyncio.create_task(structure_resume(req.resume_text))
    analysis_task = None if req.analysis else asyncio.create_task(analyze_job(req.job_description))

    yield _stage("reading", "active")
    yield _stage("analyzing", "active")
    try:
        resume = req.resume or (await resume_task)[0]
        yield ServerSentEvent(data=resume, event="resume")
        yield _stage("reading", "done")
        analysis = req.analysis or (await analysis_task)[0]
        yield ServerSentEvent(data=analysis, event="analysis")
        yield _stage("analyzing", "done")
    except BaseException:
        for task in (resume_task, analysis_task):
            if task:
                task.cancel()
        raise
    yield (resume, analysis)


async def run_pipeline(req: TailorRequest) -> AsyncIterator[ServerSentEvent]:
    started = time.monotonic()
    try:
        resume: ResumeDoc | None = None
        analysis: JobAnalysis | None = None
        async for item in _prepare(req):
            if isinstance(item, tuple):
                resume, analysis = item
            else:
                yield item
        assert resume is not None and analysis is not None

        if not resume.experience and not resume.summary and not resume.skills:
            raise AppError(
                "notAResume",
                "This file doesn't look like a resume.",
                hint="Upload the resume itself, with experience and skills sections.",
                status=422,
            )

        yield _stage("scoring", "active")
        before = score(resume, analysis)
        yield ServerSentEvent(data=before, event="scoresBefore")
        yield _stage("scoring", "done")

        yield _stage("tailoring", "active")
        output, model = await router.generate(
            TailorOutput,
            system=prompts.system_prompt,
            user=prompts.build_user_prompt(
                job_description=req.job_description,
                analysis=analysis,
                resume=resume,
                sections=req.sections,
                tone=req.tone,
                match=before.match,
                confirmed=req.confirmed_skills,
            ),
            temperature=0.35,
            max_tokens=12000,
        )
        yield _stage("tailoring", "done")

        yield _stage("checking", "active")
        tailored, suggestions, flags = guard.apply_output(
            resume, output, analysis, req.sections, req.confirmed_skills
        )
        tailored, suggestions, flags, output = await _second_pass(
            req, resume, analysis, tailored, suggestions, flags, output
        )
        result = TailorResult(
            resume=tailored,
            suggestions=suggestions,
            notes=[guard.clean_dashes(n) for n in output.change_notes],
            flags=flags,
            scores=score(tailored, analysis),
        )
        yield ServerSentEvent(data=result, event="result")
        yield _stage("checking", "done")
        yield ServerSentEvent(
            data=DoneEvent(model=model, duration_ms=round((time.monotonic() - started) * 1000)),
            event="done",
        )
    except AppError as e:
        yield ServerSentEvent(data=e.to_dict(), event="error")

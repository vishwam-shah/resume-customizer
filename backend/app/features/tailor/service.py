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
from app.features.tailor.models import TailorOutput, TailorRequest, TailorResult
from app.llm import router


def _stage(stage_id: str, status: str) -> ServerSentEvent:
    return ServerSentEvent(data={"id": stage_id, "status": status}, event="stage")


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
            ),
            temperature=0.35,
            max_tokens=12000,
        )
        yield _stage("tailoring", "done")

        yield _stage("checking", "active")
        tailored, suggestions, flags = guard.apply_output(resume, output, analysis, req.sections)
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
            data={"model": model, "durationMs": round((time.monotonic() - started) * 1000)},
            event="done",
        )
    except AppError as e:
        yield ServerSentEvent(data=e.to_dict(), event="error")

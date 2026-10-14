"""Resume Customizer API.

Stateless: uploaded files and resume text live only for the length of a
request. Persistence (accounts, history) belongs to the web app.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.openapi.utils import get_openapi
from pydantic.json_schema import models_json_schema
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.core.errors import install_error_handlers
from app.core.keep_awake import keep_awake
from app.core.rate_limit import limiter
from app.core.schemas import CamelModel
from app.features.cover_letter.router import router as cover_letter_router
from app.features.export.router import router as export_router
from app.features.latex.router import router as latex_router
from app.features.resume.router import router as resume_router
from app.features.tailor.events import DoneEvent, ErrorBody, StageEvent
from app.features.tailor.models import TailorResult
from app.features.tailor.router import router as tailor_router
from app.llm import router as llm

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


class Meta(CamelModel):
    """Limits the UI validates against, so client and server never disagree."""

    max_upload_bytes: int
    max_resume_pages: int
    min_job_description_chars: int
    max_job_description_chars: int
    accepted_types: list[str]
    model: str


def create_app() -> FastAPI:
    app = FastAPI(
        title="Resume Customizer API",
        version="1.0.0",
        docs_url=None if settings.is_production else "/docs",
        lifespan=keep_awake,
        redoc_url=None,
    )
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)
    # SSE responses must not be gzip-buffered; GZip skips text/event-stream.
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
        expose_headers=["Content-Disposition", "X-Resume-Fit", "X-Pages"],
        max_age=600,
    )
    install_error_handlers(app)

    api = APIRouter(prefix="/api/v1")

    @api.get("/health", tags=["meta"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @api.get("/meta", tags=["meta"])
    async def meta() -> Meta:
        return Meta(
            max_upload_bytes=settings.max_upload_bytes,
            max_resume_pages=settings.max_resume_pages,
            min_job_description_chars=settings.min_job_description_chars,
            max_job_description_chars=settings.max_job_description_chars,
            accepted_types=[".pdf", ".docx"],
            model=llm.active_model(),
        )

    for feature in (
        resume_router,
        latex_router,
        tailor_router,
        cover_letter_router,
        export_router,
    ):
        api.include_router(feature)
    app.include_router(api)
    _register_stream_schemas(app)
    return app


def _register_stream_schemas(app: FastAPI) -> None:
    """Add SSE payload models to the OpenAPI components so clients can type them."""
    stream_models = [TailorResult, StageEvent, DoneEvent, ErrorBody]

    def openapi() -> dict:
        if app.openapi_schema:
            return app.openapi_schema
        schema = get_openapi(title=app.title, version=app.version, routes=app.routes)
        _, defs = models_json_schema(
            [(m, "serialization") for m in stream_models],
            ref_template="#/components/schemas/{model}",
        )
        schema.setdefault("components", {}).setdefault("schemas", {}).update(defs["$defs"])
        app.openapi_schema = schema
        return schema

    app.openapi = openapi


app = create_app()

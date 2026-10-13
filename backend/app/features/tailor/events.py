"""Payloads of the server-sent events the streaming endpoints emit.

FastAPI can't infer these from an event stream, so `app.main` registers them
in the OpenAPI schema and the frontend generates its types from there.
"""

from __future__ import annotations

from typing import Literal

from app.core.schemas import CamelModel

StageId = Literal["reading", "analyzing", "scoring", "tailoring", "checking"]


class StageEvent(CamelModel):
    id: StageId
    status: Literal["active", "done"]


class DoneEvent(CamelModel):
    model: str
    duration_ms: int | None = None


class ErrorBody(CamelModel):
    code: str
    message: str
    hint: str

"""One error shape for every failure the user can see.

Every error response is `{"error": {"code", "message", "hint"}}`. `code` is a
stable camelCase identifier the UI can branch on; `message` says what went
wrong in plain language; `hint` says how to fix it. Internal details never
reach the client.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

logger = logging.getLogger("app")


class AppError(Exception):
    def __init__(self, code: str, message: str, *, hint: str = "", status: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.hint = hint
        self.status = status

    def to_dict(self) -> dict:
        return {"code": self.code, "message": self.message, "hint": self.hint}


class LlmUnavailableError(AppError):
    def __init__(self, detail: str = "") -> None:
        super().__init__(
            "llmUnavailable",
            "The AI service is busy or unreachable right now.",
            hint="Your inputs are kept. Wait a few seconds and try again.",
            status=503,
        )
        self.detail = detail


def _response(err: AppError) -> JSONResponse:
    return JSONResponse({"error": err.to_dict()}, status_code=err.status)


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        if isinstance(exc, LlmUnavailableError):
            logger.warning("llm unavailable: %s", exc.detail)
        return _response(exc)

    @app.exception_handler(RequestValidationError)
    async def handle_validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        first = exc.errors()[0] if exc.errors() else {}
        field = ".".join(str(p) for p in first.get("loc", [])[1:]) or "request"
        return _response(
            AppError(
                "invalidRequest",
                f"Check the {field} field: {first.get('msg', 'invalid value')}.",
                status=422,
            )
        )

    @app.exception_handler(RateLimitExceeded)
    async def handle_rate_limit(_: Request, exc: RateLimitExceeded) -> JSONResponse:
        return _response(
            AppError(
                "rateLimited",
                "You're sending requests faster than we can handle.",
                hint="Wait a minute, then try again.",
                status=429,
            )
        )

    @app.exception_handler(Exception)
    async def handle_unexpected(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled error", exc_info=exc)
        return _response(
            AppError(
                "internalError",
                "Something went wrong on our side.",
                hint="Try again. If it keeps happening, reload the page.",
                status=500,
            )
        )

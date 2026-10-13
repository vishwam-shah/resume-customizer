# syntax=docker/dockerfile:1.7

# ---- build: resolve dependencies from the lockfile into /app/.venv ----
FROM python:3.13-slim AS builder
COPY --from=ghcr.io/astral-sh/uv:0.13.0 /uv /uvx /bin/
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=0 UV_NO_DEV=1
WORKDIR /app
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --frozen --no-install-project --no-dev

# ---- runtime: slim image, non-root user, app code only ----
FROM python:3.13-slim
ENV PATH="/app/.venv/bin:$PATH" PYTHONUNBUFFERED=1 PORT=8000 ENVIRONMENT=production
RUN useradd --create-home --uid 1001 app
WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY app ./app
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request,os;urllib.request.urlopen(f'http://127.0.0.1:{os.environ[\"PORT\"]}/api/v1/health')"
# Platforms (Railway, Render, Cloud Run) inject PORT; proxy headers give real client IPs for rate limits.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]

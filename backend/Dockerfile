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

# ---- tectonic: self-contained LaTeX engine for compiling pasted resumes ----
FROM python:3.13-slim AS tectonic
ARG TECTONIC_VERSION=0.17.0
ADD https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-x86_64-unknown-linux-musl.tar.gz /tmp/tectonic.tar.gz
RUN tar -xzf /tmp/tectonic.tar.gz -C /usr/local/bin tectonic && tectonic --version

# ---- runtime: slim image, non-root user, app code only ----
FROM python:3.13-slim
ENV PATH="/app/.venv/bin:$PATH" PYTHONUNBUFFERED=1 PORT=8000 ENVIRONMENT=production \
    TECTONIC_CACHE=/opt/tex-cache TECTONIC_HOME=/opt/tex-cache XDG_CACHE_HOME=/opt/tex-cache
COPY --from=tectonic /usr/local/bin/tectonic /usr/local/bin/tectonic
# fontconfig gives Tectonic its default font configuration; without it every
# compile prints "Fontconfig error: Cannot load default config file".
RUN apt-get update \
    && apt-get install -y --no-install-recommends fontconfig ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 1001 app
WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY app ./app
# Pre-download the common resume packages so the first compile is fast, then
# hand the cache to the app user (compiles run as that user).
RUN mkdir -p /opt/tex-cache /tmp/warmup && cp app/features/latex/warmup.tex /tmp/warmup/ \
    && tectonic -X compile --untrusted /tmp/warmup/warmup.tex \
    && rm -rf /tmp/warmup && chown -R app:app /opt/tex-cache
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request,os;urllib.request.urlopen(f'http://127.0.0.1:{os.environ[\"PORT\"]}/api/v1/health')"
# Platforms (Railway, Render, Cloud Run) inject PORT; proxy headers give real client IPs for rate limits.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]

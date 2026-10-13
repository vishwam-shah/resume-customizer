"""Runtime settings, read from the environment (and `.env` in local dev)."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"

    # Comma-separated browser origins allowed to call the API.
    cors_origins: str = "http://localhost:3000"

    # "provider/model" entries, tried in order; entries without a key are skipped.
    # Order chosen by benchmark (README): gpt-oss-120b was fastest and needed
    # no guard reverts; Gemini 3.1 Flash-Lite scored well; the rest are
    # fallbacks. Each model has its own free-tier rate limit, so a longer
    # chain means more headroom.
    llm_chain: str = (
        "groq/openai/gpt-oss-120b,"
        "gemini/gemini-3.1-flash-lite,"
        "groq/qwen/qwen3.8-27b,"
        "gemini/gemini-3.8-flash,"
        "gemini/gemini-3.6-flash,"
        "groq/openai/gpt-oss-20b"
    )
    gemini_api_key: str = ""
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    # Hard wall-clock limit per provider call; healthy calls take 7-15 s.
    llm_timeout_seconds: float = 30.0

    # Upload and input limits, shared with the UI through GET /api/v1/meta.
    max_upload_bytes: int = 5 * 1024 * 1024
    max_resume_pages: int = 10
    min_job_description_chars: int = 200
    max_job_description_chars: int = 20_000
    min_resume_chars: int = 300

    rate_limit_tailor: str = Field(default="12/minute")
    rate_limit_default: str = Field(default="60/minute")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

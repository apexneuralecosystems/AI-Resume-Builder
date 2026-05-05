"""Environment-based backend settings."""

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    app_name: str
    allowed_origins: list[str]
    openrouter_model: str
    openrouter_timeout_seconds: float
    openrouter_max_tokens: int
    openrouter_temperature: float
    site_url: str
    app_title: str
    backend_port: int
    backend_reload: bool
    max_resume_chars: int
    max_jd_chars: int
    max_upload_bytes: int
    openrouter_api_key: str | None


def _to_bool(raw: str | None, default: bool = False) -> bool:
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def get_settings() -> Settings:
    raw_origins = os.getenv(
        "ALLOWED_ORIGINS",
        "https://resume.builder.apexneural.cloud,http://localhost:5173,http://localhost:3000,http://localhost",
    )
    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

    return Settings(
        app_name=os.getenv("APP_NAME", "Resume Builder API"),
        allowed_origins=origins,
        openrouter_model=os.getenv(
            "OPENROUTER_MODEL",
            # Anthropic via OpenRouter; override with another slug if needed
            "anthropic/claude-sonnet-4.5",
        ),
        openrouter_timeout_seconds=float(os.getenv("OPENROUTER_TIMEOUT_SECONDS", "120")),
        openrouter_max_tokens=int(os.getenv("OPENROUTER_MAX_TOKENS", "8192")),
        openrouter_temperature=float(os.getenv("OPENROUTER_TEMPERATURE", "0.2")),
        site_url=os.getenv("SITE_URL", "https://resume.builder.apexneural.cloud"),
        app_title=os.getenv("APP_TITLE", "ResumeForge"),
        backend_port=int(os.getenv("BACKEND_PORT") or os.getenv("PORT") or "8282"),
        backend_reload=_to_bool(os.getenv("RELOAD"), default=False),
        max_resume_chars=int(os.getenv("MAX_RESUME_CHARS", "0")),
        max_jd_chars=int(os.getenv("MAX_JD_CHARS", "3000")),
        max_upload_bytes=int(os.getenv("MAX_UPLOAD_BYTES", "15728640")),
        openrouter_api_key=os.getenv("OPENROUTER_API_KEY"),
    )

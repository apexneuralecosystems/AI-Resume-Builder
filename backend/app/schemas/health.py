"""Health endpoint schemas."""

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    openrouter_configured: bool

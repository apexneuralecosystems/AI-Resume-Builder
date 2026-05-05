"""Convenient local launcher for the backend API."""

import uvicorn

from app.core.config import get_settings


def run() -> None:
    """Start the FastAPI application with configured host/port/reload."""
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.backend_port,
        reload=settings.backend_reload,
    )


if __name__ == "__main__":
    run()

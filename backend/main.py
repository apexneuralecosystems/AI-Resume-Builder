"""Compatibility entrypoint for uvicorn and local execution."""

import uvicorn

from app.core.config import get_settings
from app.main import app


if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.backend_port,
        reload=settings.backend_reload,
    )  # test
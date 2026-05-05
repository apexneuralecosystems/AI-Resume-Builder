"""OpenRouter API (OpenAI-compatible) — Anthropic Claude models via OpenRouter key."""

import json

import httpx
from fastapi import HTTPException

from app.core.config import Settings

OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"


def _strip_json_fence(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines)
    return text.strip()


class OpenRouterClient:
    """Anthropic Claude (or any OpenRouter model) using OPENROUTER_API_KEY."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    @staticmethod
    def _extract_message_content(message_content: object) -> str:
        if isinstance(message_content, str):
            return message_content
        if isinstance(message_content, list):
            parts: list[str] = []
            for chunk in message_content:
                if isinstance(chunk, dict) and chunk.get("type") == "text":
                    t = chunk.get("text")
                    if isinstance(t, str):
                        parts.append(t)
            return "".join(parts)
        return ""

    async def parse_to_json(self, system_prompt: str, user_content: str) -> dict:
        api_key = self.settings.openrouter_api_key
        if not api_key:
            raise HTTPException(
                status_code=500,
                detail="OPENROUTER_API_KEY is not configured. Please add it to backend/.env",
            )

        payload: dict = {
            "model": self.settings.openrouter_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            "temperature": self.settings.openrouter_temperature,
            "max_tokens": self.settings.openrouter_max_tokens,
            "response_format": {"type": "json_object"},
        }
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": self.settings.site_url,
            "X-Title": self.settings.app_title,
        }

        async with httpx.AsyncClient(timeout=self.settings.openrouter_timeout_seconds) as client:
            response = await client.post(OPENROUTER_CHAT_URL, json=payload, headers=headers)

        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"OpenRouter error {response.status_code}: {response.text[:400]}",
            )

        try:
            data = response.json()
            first_choice = data["choices"][0]
            finish_reason = first_choice.get("finish_reason")
            if finish_reason == "length":
                raise HTTPException(
                    status_code=502,
                    detail=(
                        "Model output was truncated before completion. "
                        "Increase OPENROUTER_MAX_TOKENS or reduce input size."
                    ),
                )

            raw_content = self._extract_message_content(first_choice["message"]["content"])
            if not raw_content.strip():
                raise HTTPException(status_code=502, detail="OpenRouter returned empty content")

            return json.loads(_strip_json_fence(raw_content))
        except (KeyError, TypeError, json.JSONDecodeError) as exc:
            raise HTTPException(status_code=502, detail="OpenRouter returned invalid JSON") from exc

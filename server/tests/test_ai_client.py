"""LLM 客户端测试：mock、降级链、重试、流式提取。"""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from app.config import settings
from app.services.ai import client as client_module
from app.services.ai.client import (
    LLMClient,
    MOCK_SCHEMA,
    _ReplyExtractor,
    strip_code_fence,
)


class FakeCompletions:
    def __init__(self, behaviours):
        self.behaviours = behaviours
        self.calls = []

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        behaviour = self.behaviours.pop(0)
        if isinstance(behaviour, Exception):
            raise behaviour
        return behaviour


class FakeChat:
    def __init__(self, completions):
        self.completions = completions


def response_with_content(content: str):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])


async def test_mock_returns_independent_copy(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "mock")
    ai = LLMClient(provider="mock")
    first = await ai.complete_json("s", "u", {})
    first["title"] = "mutated"
    second = await ai.complete_json("s", "u", {})
    assert second["title"] == MOCK_SCHEMA["title"]


def test_strip_code_fence():
    assert strip_code_fence("```json\n{\"a\":1}\n```") == '{"a":1}'
    assert strip_code_fence('{"a":1}') == '{"a":1}'


@pytest.mark.parametrize("message", ["response_format unsupported", "tool calling not support", "json_schema invalid"])
def test_is_unsupported_keywords(message):
    assert client_module._is_unsupported(ValueError(message))


async def test_three_level_fallback(monkeypatch):
    monkeypatch.setattr(settings, "ai_api_key", "sk-test")
    ai = LLMClient(provider="openai", max_retry=0)
    behaviours = [
        ValueError("response_format unsupported"),
        ValueError("tool not supported"),
        response_with_content('```json\n{"ok": true}\n```'),
    ]
    fake = FakeCompletions(behaviours)
    ai._client = SimpleNamespace(chat=FakeChat(fake))
    result = await ai.complete_json("system", "user", {"type": "object"})
    assert result == {"ok": True}
    assert len(fake.calls) == 3
    assert fake.calls[0]["response_format"]["type"] == "json_schema"
    assert "tools" in fake.calls[1]


async def test_retry_then_success(monkeypatch):
    monkeypatch.setattr(client_module.asyncio, "sleep", _noop_sleep)
    ai = LLMClient(provider="openai", max_retry=1)
    fake = FakeCompletions([ValueError("network"), response_with_content('{"ok": 1}')])
    ai._client = SimpleNamespace(chat=FakeChat(fake))
    result = await ai.complete_json("s", "u", {})
    assert result == {"ok": 1}
    assert len(fake.calls) == 2


async def _noop_sleep(*args, **kwargs):
    return None


def test_reply_extractor_incremental():
    extractor = _ReplyExtractor()
    chunks = ['{"reply": "你', "好", '\\"世界\\"", "other": 1}']
    output = ""
    for chunk in chunks:
        extractor.feed(chunk)
        output += extractor.take()
    assert output == '你好"世界"'


async def test_mock_stream_tools(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "mock")
    ai = LLMClient(provider="mock")
    events = []
    async for kind, payload in ai.stream_tools([], [], mock_reply="你好，世界"):
        events.append((kind, payload))
    text = "".join(payload for kind, payload in events if kind == "delta")
    assert text == "你好，世界"
    assert events[-1][0] == "result"

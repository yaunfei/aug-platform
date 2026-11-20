"""SSE 流式对话测试。"""

from __future__ import annotations

import json


def parse_events(text: str) -> list[dict]:
    events = []
    for line in text.splitlines():
        if line.startswith("data: "):
            events.append(json.loads(line[len("data: "):]))
    return events


async def test_stream_mock_generate(client):
    async with client.stream(
        "POST",
        "/api/assistant/chat/stream",
        json={"messages": [{"role": "user", "content": "生成一个反馈表单"}]},
    ) as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        assert response.headers["cache-control"] == "no-cache, no-transform"
        body = "".join([chunk async for chunk in response.aiter_text()])
    events = parse_events(body)
    assert events, body
    deltas = [e["text"] for e in events if e["type"] == "delta"]
    assert "".join(deltas)
    final = events[-1]
    assert final["type"] == "final"
    assert final["data"]["intent"] == "generate"


async def test_stream_error_frame(client):
    async with client.stream(
        "POST",
        "/api/assistant/chat/stream",
        json={"messages": [{"role": "assistant", "content": "非法最后一条"}]},
    ) as response:
        body = "".join([chunk async for chunk in response.aiter_text()])
    events = parse_events(body)
    assert events[0]["type"] == "error"
    assert events[0]["errorCode"] == "VALIDATION_ERROR"


async def test_stream_reply_intent(client):
    async with client.stream(
        "POST",
        "/api/assistant/chat/stream",
        json={"messages": [{"role": "user", "content": "你好"}]},
    ) as response:
        body = "".join([chunk async for chunk in response.aiter_text()])
    events = parse_events(body)
    assert events[-1]["data"]["intent"] == "reply"

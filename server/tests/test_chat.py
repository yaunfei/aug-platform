"""对话助手测试（mock 分派 + tool-loop）。"""

from __future__ import annotations

import json

import pytest

from app.config import settings
from app.db import SessionLocal
from app.services.ai.chat import ChatService, truncate_messages
from app.services.ai.client import AssistantMessage, ToolCall
from app.responses import AppError

SCHEMA = {
    "formKey": "chat_form",
    "title": "对话测试表",
    "columns": [
        {"dataIndex": "name", "title": "姓名", "valueType": "text"},
        {"dataIndex": "level", "title": "级别", "valueType": "select",
         "valueEnum": {"a": {"text": "甲"}, "b": {"text": "乙"}}},
    ],
}


async def test_mock_generate_intent(client):
    response = await client.post(
        "/api/assistant/chat",
        json={"messages": [{"role": "user", "content": "帮我生成一个反馈表单"}]},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["intent"] == "generate"
    assert data["schema"]["formKey"] == "user_feedback"


async def test_mock_sample_data(client):
    response = await client.post(
        "/api/assistant/chat",
        json={"messages": [{"role": "user", "content": "生成几条示例数据"}], "currentSchema": SCHEMA},
    )
    data = response.json()["data"]
    assert data["intent"] == "sample_data"
    assert len(data["sampleData"]) == 3
    assert set(data["sampleData"][0]).issubset({"name", "level"})


async def test_mock_review(client):
    response = await client.post(
        "/api/assistant/chat",
        json={"messages": [{"role": "user", "content": "审查一下这个表单"}], "currentSchema": SCHEMA},
    )
    data = response.json()["data"]
    assert data["intent"] == "review"
    assert "审查" in data["reply"]


async def test_mock_propose_delete(client):
    response = await client.post(
        "/api/assistant/chat",
        json={"messages": [{"role": "user", "content": "删除 chat_form 表单"}], "currentSchema": SCHEMA},
    )
    data = response.json()["data"]
    assert data["intent"] == "action"
    assert data["action"]["type"] == "delete"
    assert data["action"]["formKey"] == "chat_form"


async def test_mock_query_list(client):
    await client.post(f"/api/schema/{SCHEMA['formKey']}/publish", json=SCHEMA)
    response = await client.post(
        "/api/assistant/chat",
        json={"messages": [{"role": "user", "content": "平台有哪些表单？"}]},
    )
    data = response.json()["data"]
    assert data["intent"] == "reply"
    assert "chat_form" in data["reply"]


async def test_chat_message_validation(client):
    response = await client.post(
        "/api/assistant/chat",
        json={"messages": [{"role": "assistant", "content": "最后一条不是用户"}]},
    )
    assert response.status_code == 400
    assert response.json()["errorCode"] == "VALIDATION_ERROR"


def test_truncate_messages_drops_oldest():
    messages = [{"role": "user", "content": "x" * 20000} for _ in range(7)]
    messages.append({"role": "user", "content": "最后"})
    result = truncate_messages(messages)
    assert result[-1]["content"] == "最后"
    assert sum(len(m["content"]) for m in result) <= 100000


def test_truncate_requires_user_last():
    with pytest.raises(AppError):
        truncate_messages([{"role": "user", "content": "hi"}, {"role": "assistant", "content": "yo"}])


class StubClient:
    is_mock = False

    def __init__(self, responses):
        self.responses = list(responses)
        self.messages_seen = []

    async def complete_tools(self, messages, tools, tool_choice="auto", max_retry=None):
        self.messages_seen.append(list(messages))
        return self.responses.pop(0)


async def test_tool_loop_query_then_reply():
    async with SessionLocal() as db:
        from app.repositories import schema_repo

        await schema_repo.publish(db, "chat_form", SCHEMA)
        await db.commit()

        stub = StubClient(
            [
                AssistantMessage(
                    tool_calls=[ToolCall(id="c1", name="query_platform", arguments={"query_type": "list_schemas"})]
                ),
                AssistantMessage(
                    tool_calls=[ToolCall(id="c2", name="reply", arguments={"reply": "平台有 1 个表单"})]
                ),
            ]
        )
        service = ChatService(db, client=stub)
        result = await service.handle([{"role": "user", "content": "有哪些表单"}])
        assert result["intent"] == "reply"
        assert result["reply"] == "平台有 1 个表单"
        # 第二次调用可见工具结果
        tool_messages = [m for m in stub.messages_seen[1] if m.get("role") == "tool"]
        assert tool_messages
        assert "chat_form" in tool_messages[0]["content"]


async def test_tool_loop_generate_schema():
    async with SessionLocal() as db:
        stub = StubClient(
            [
                AssistantMessage(
                    tool_calls=[
                        ToolCall(
                            id="g1",
                            name="generate_schema",
                            arguments={"schema": SCHEMA, "reply": "已生成"},
                        )
                    ]
                )
            ]
        )
        service = ChatService(db, client=stub)
        result = await service.handle([{"role": "user", "content": "生成表单"}])
        assert result["intent"] == "generate"
        assert result["schema"]["formKey"] == "chat_form"


async def test_tool_loop_invalid_schema_then_success(monkeypatch):
    monkeypatch.setattr(settings, "ai_max_retry", 1)
    async with SessionLocal() as db:
        stub = StubClient(
            [
                AssistantMessage(
                    tool_calls=[
                        ToolCall(id="g1", name="generate_schema", arguments={"schema": {"formKey": "x"}, "reply": "坏"})
                    ]
                ),
                AssistantMessage(
                    tool_calls=[
                        ToolCall(
                            id="g2",
                            name="generate_schema",
                            arguments={"schema": SCHEMA, "reply": "已修好"},
                        )
                    ]
                ),
            ]
        )
        service = ChatService(db, client=stub)
        result = await service.handle([{"role": "user", "content": "生成表单"}])
        assert result["intent"] == "generate"
        assert stub.responses == []


async def test_tool_loop_invalid_schema_exhausted(monkeypatch):
    monkeypatch.setattr(settings, "ai_max_retry", 0)
    async with SessionLocal() as db:
        stub = StubClient(
            [
                AssistantMessage(
                    tool_calls=[
                        ToolCall(id="g1", name="generate_schema", arguments={"schema": {}, "reply": "坏"})
                    ]
                )
            ]
        )
        service = ChatService(db, client=stub)
        with pytest.raises(AppError) as exc:
            await service.handle([{"role": "user", "content": "生成"}])
        assert exc.value.code == "AI_GENERATE_FAILED"


async def test_mock_query_records(client):
    await client.post(f"/api/schema/{SCHEMA['formKey']}/publish", json=SCHEMA)
    await client.post(
        f"/api/form/{SCHEMA['formKey']}/submit", json={"name": "张三", "level": "a"}
    )
    response = await client.post(
        "/api/assistant/chat",
        json={"messages": [{"role": "user", "content": "帮我查询一下记录"}]},
    )
    assert response.status_code == 200

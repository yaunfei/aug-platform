"""单发 AI 生成测试。"""

from __future__ import annotations

from app.config import settings
from app.responses import AppError
from app.services.ai.generator import SchemaGenerator
from app.services.ai.client import MOCK_SCHEMA


async def test_generate_with_mock(client):
    response = await client.post(
        "/api/schema/generate", json={"prdText": "做一个用户反馈表单", "formKeyHint": "user_feedback"}
    )
    assert response.status_code == 200
    body = response.json()["data"]
    assert body["schema"]["formKey"] == MOCK_SCHEMA["formKey"]
    assert body["warnings"] == []
    # 不落库
    listing = await client.get("/api/schema")
    assert listing.json()["data"] == []


async def test_generate_requires_prd(client):
    assert (await client.post("/api/schema/generate", json={"prdText": ""})).status_code == 400
    assert (await client.post("/api/schema/generate", json={})).status_code == 400
    too_long = "x" * 20001
    assert (
        await client.post("/api/schema/generate", json={"prdText": too_long})
    ).status_code == 400


class FlakyClient:
    def __init__(self, payloads):
        self.payloads = payloads
        self.calls = 0

    async def complete_json(self, *args, **kwargs):
        payload = self.payloads[min(self.calls, len(self.payloads) - 1)]
        self.calls += 1
        return payload


async def test_generator_retries_after_validation_error(monkeypatch):
    monkeypatch.setattr(settings, "ai_max_retry", 1)
    invalid = {"formKey": "demo", "title": "demo", "columns": []}
    valid = {
        "formKey": "demo",
        "title": "演示",
        "columns": [{"dataIndex": "a", "title": "A", "valueType": "text"}],
    }
    fake = FlakyClient([invalid, valid])
    generator = SchemaGenerator(fake)
    result = await generator.generate("需求")
    assert fake.calls == 2
    assert result["schema"]["formKey"] == "demo"


async def test_generator_exhausted(monkeypatch):
    import pytest

    monkeypatch.setattr(settings, "ai_max_retry", 1)
    invalid = {"formKey": "demo", "title": "demo", "columns": []}
    fake = FlakyClient([invalid])
    generator = SchemaGenerator(fake)
    with pytest.raises(AppError) as exc:
        await generator.generate("需求")
    assert exc.value.code == "AI_GENERATE_FAILED"
    assert fake.calls == 2

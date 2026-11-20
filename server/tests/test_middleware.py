"""中间件测试：鉴权 / 请求体限制 / 访问日志。"""

from __future__ import annotations

import logging

from app.config import settings


async def test_auth_disabled_by_default(client):
    assert (await client.get("/api/schema")).status_code == 200


async def test_auth_requires_bearer(client, monkeypatch):
    monkeypatch.setattr(settings, "auth_enabled", True)
    monkeypatch.setattr(settings, "auth_token", "secret-token")
    response = await client.get("/api/schema")
    assert response.status_code == 401
    assert response.json()["errorCode"] == "UNAUTHORIZED"

    ok = await client.get("/api/schema", headers={"Authorization": "Bearer secret-token"})
    assert ok.status_code == 200

    health = await client.get("/health")
    assert health.status_code == 200


async def test_body_size_limit_content_length(client, monkeypatch):
    monkeypatch.setattr(settings, "max_body_bytes", 100)
    response = await client.post("/api/assistant/chat", json={"messages": [{"role": "user", "content": "x" * 500}]})
    assert response.status_code == 413
    assert response.json()["errorCode"] == "PAYLOAD_TOO_LARGE"


async def test_access_log_written(client, caplog):
    with caplog.at_level(logging.INFO, logger="aug.access"):
        await client.get("/health")
    assert any("durationMs" in record.message for record in caplog.records)

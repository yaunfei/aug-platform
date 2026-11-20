"""Webhook 重试与提交联动测试。"""

from __future__ import annotations

from app.config import settings
from app.services import webhook


class FakeResponse:
    def __init__(self, status_code: int):
        self.status_code = status_code


class FakeClient:
    def __init__(self, statuses):
        self.statuses = list(statuses)
        self.calls = 0

    def __call__(self, *args, **kwargs):
        return self

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None

    async def post(self, url, json=None):
        self.calls += 1
        return FakeResponse(self.statuses.pop(0))


async def _noop_sleep(*args, **kwargs):
    return None


async def test_webhook_retries_then_succeeds(monkeypatch):
    monkeypatch.setattr(settings, "webhook_enabled", True)
    monkeypatch.setattr(settings, "webhook_url", "http://example.test/hook")
    monkeypatch.setattr(webhook.asyncio, "sleep", _noop_sleep)
    fake = FakeClient([500, 500, 200])
    monkeypatch.setattr(webhook.httpx, "AsyncClient", fake)
    await webhook.send_submit_webhook({"recordId": 1})
    assert fake.calls == 3


async def test_webhook_gives_up(monkeypatch):
    monkeypatch.setattr(settings, "webhook_enabled", True)
    monkeypatch.setattr(settings, "webhook_url", "http://example.test/hook")
    monkeypatch.setattr(webhook.asyncio, "sleep", _noop_sleep)
    fake = FakeClient([500, 500, 500, 500])
    monkeypatch.setattr(webhook.httpx, "AsyncClient", fake)
    await webhook.send_submit_webhook({"recordId": 2})
    assert fake.calls == 4


async def test_webhook_disabled_noop(monkeypatch):
    monkeypatch.setattr(settings, "webhook_enabled", False)
    fake = FakeClient([])
    monkeypatch.setattr(webhook.httpx, "AsyncClient", fake)
    await webhook.send_submit_webhook({"recordId": 3})
    assert fake.calls == 0


async def test_submit_triggers_background_webhook(client, form_key_factory, monkeypatch):
    from app.routers import record as record_router

    called = []

    async def fake_send(payload):
        called.append(payload)

    monkeypatch.setattr(record_router, "send_submit_webhook", fake_send)
    monkeypatch.setattr(settings, "webhook_enabled", True)
    form_key = form_key_factory("hook")
    schema = {
        "formKey": form_key,
        "title": "Hook 测试",
        "columns": [{"dataIndex": "name", "title": "姓名", "valueType": "text"}],
    }
    await client.post(f"/api/schema/{form_key}/publish", json=schema)
    response = await client.post(f"/api/form/{form_key}/submit", json={"name": "张三"})
    assert response.status_code == 200
    assert called and called[0]["formKey"] == form_key
    assert called[0]["data"] == {"name": "张三"}

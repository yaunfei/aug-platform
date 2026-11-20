"""Schema 管理 API 测试。"""

from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest

FIXTURE = Path(__file__).parent / "fixtures" / "prd" / "case01.expected.json"


def schema_payload(form_key: str | None = None) -> dict:
    payload = json.loads(FIXTURE.read_text(encoding="utf-8"))
    if form_key:
        payload["formKey"] = form_key
    return payload


async def publish(client, form_key: str, payload: dict | None = None):
    return await client.post(f"/api/schema/{form_key}/publish", json=payload or schema_payload(form_key))


async def test_health(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["data"]["status"] == "ok"


async def test_publish_and_list_versions(client, form_key_factory):
    form_key = form_key_factory("feedback")
    r1 = await publish(client, form_key)
    assert r1.status_code == 200, r1.text
    body = r1.json()["data"]
    assert body["version"] == 1
    assert body["formKey"] == form_key

    r2 = await publish(client, form_key)
    assert r2.json()["data"]["version"] == 2

    listing = await client.get("/api/schema")
    assert listing.status_code == 200
    items = listing.json()["data"]
    assert len(items) == 1
    assert items[0]["version"] == 2

    versions = await client.get(f"/api/schema/{form_key}/versions")
    assert [v["version"] for v in versions.json()["data"]] == [2, 1]

    latest = await client.get(f"/api/form/{form_key}/schema")
    assert latest.json()["data"]["version"] == 2
    old = await client.get(f"/api/form/{form_key}/schema", params={"version": 1})
    assert old.json()["data"]["version"] == 1


async def test_rollback_is_forward_append(client, form_key_factory):
    form_key = form_key_factory("rollback")
    await publish(client, form_key)
    changed = schema_payload(form_key)
    changed["title"] = "新标题"
    await client.post(f"/api/schema/{form_key}/publish", json=changed)

    response = await client.post(f"/api/schema/{form_key}/rollback", json={"version": 1})
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["version"] == 3
    assert data["schema"]["title"] == "用户反馈表"

    latest = await client.get(f"/api/form/{form_key}/schema")
    assert latest.json()["data"]["version"] == 3

    again = await client.post(f"/api/schema/{form_key}/rollback", json={"version": 3})
    assert again.status_code == 400


async def test_publish_validation_and_mismatch(client, form_key_factory):
    form_key = form_key_factory("bad")
    mismatch = schema_payload("other_form")
    r = await client.post(f"/api/schema/{form_key}/publish", json=mismatch)
    assert r.status_code == 400

    bad = schema_payload(form_key)
    bad["columns"][0]["valueType"] = "unknown_x"
    r = await client.post(f"/api/schema/{form_key}/publish", json=bad)
    assert r.status_code == 400
    assert r.json()["errorCode"] == "SCHEMA_INVALID"


async def test_404s(client, form_key_factory):
    missing = form_key_factory("missing")
    assert (await client.get(f"/api/form/{missing}/schema")).status_code == 404
    assert (await client.get(f"/api/schema/{missing}/versions")).status_code == 404
    assert (await client.delete(f"/api/schema/{missing}")).status_code == 404


async def test_list_filters(client, form_key_factory):
    key_a = form_key_factory("alpha")
    key_b = form_key_factory("beta")
    await publish(client, key_a)
    payload_b = schema_payload(key_b)
    payload_b["title"] = "另一种表单"
    await publish(client, key_b, payload_b)

    by_key = await client.get("/api/schema", params={"formKey": key_a})
    assert [i["formKey"] for i in by_key.json()["data"]] == [key_a]

    by_title = await client.get("/api/schema", params={"title": "另一种"})
    assert [i["formKey"] for i in by_title.json()["data"]] == [key_b]

    future = await client.get("/api/schema", params={"startTime": "2999-01-01T00:00:00Z"})
    assert future.json()["data"] == []


async def test_delete_cascades_records(client, form_key_factory):
    form_key = form_key_factory("cascade")
    await publish(client, form_key)
    submitted = await client.post(
        f"/api/form/{form_key}/submit", json={"feedback_title": "x", "level": "p1"}
    )
    assert submitted.status_code == 200

    deleted = await client.delete(f"/api/schema/{form_key}")
    assert deleted.status_code == 200
    assert (await client.get(f"/api/form/{form_key}/schema")).status_code == 404
    records = await client.get(f"/api/form/{form_key}/records")
    assert records.json()["total"] == 0


async def test_components_endpoint_hides_prompt_assets(client):
    response = await client.get("/api/schema/components")
    components = response.json()["data"]["components"]
    assert len(components) == 50
    for item in components:
        assert "criteria" not in item
        assert "rules" not in item
        assert "fewShot" not in item
    image = next(c for c in components if c["valueType"] == "imageUpload")
    assert image["custom"] is True
    assert image["allowedFieldProps"] == ["maxSizeMB"]


async def test_publish_body_not_object(client, form_key_factory):
    form_key = form_key_factory("arraybody")
    response = await client.post(f"/api/schema/{form_key}/publish", json=[1, 2])
    assert response.status_code == 400

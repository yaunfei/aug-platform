"""记录 CRUD / 查询三件套测试。"""

from __future__ import annotations

import json

import pytest


def build_schema(form_key: str) -> dict:
    return {
        "formKey": form_key,
        "title": "记录测试表",
        "columns": [
            {"dataIndex": "name", "title": "姓名", "valueType": "text"},
            {
                "dataIndex": "status",
                "title": "状态",
                "valueType": "select",
                "valueEnum": {"paid": {"text": "已支付"}, "pending": {"text": "待支付"}},
            },
            {"dataIndex": "amount", "title": "金额", "valueType": "digit"},
            {"dataIndex": "apply_range", "title": "申请时间", "valueType": "dateRange"},
        ],
    }


async def setup_form(client, form_key: str):
    response = await client.post(
        f"/api/schema/{form_key}/publish", json=build_schema(form_key)
    )
    assert response.status_code == 200, response.text


async def test_submit_and_detail(client, form_key_factory):
    form_key = form_key_factory("rec")
    await setup_form(client, form_key)
    submitted = await client.post(
        f"/api/form/{form_key}/submit",
        json={"name": "张三", "status": "paid", "amount": 100, "apply_range": ["2026-01-01", "2026-01-31"]},
    )
    assert submitted.status_code == 200, submitted.text
    record = submitted.json()["data"]
    assert record["schemaVersion"] == 1
    assert record["data"]["name"] == "张三"

    detail = await client.get(f"/api/form/{form_key}/records/{record['id']}")
    body = detail.json()["data"]
    assert body["schemaVersion"] == 1
    assert body["record"]["id"] == record["id"]


async def test_submit_requires_published_schema(client, form_key_factory):
    response = await client.post(
        f"/api/form/{form_key_factory('ghost')}/submit", json={"name": "x"}
    )
    assert response.status_code == 404


async def test_submit_body_must_be_object(client, form_key_factory):
    form_key = form_key_factory("arr")
    await setup_form(client, form_key)
    response = await client.post(f"/api/form/{form_key}/submit", json=[1, 2])
    assert response.status_code == 400
    assert response.json()["errorCode"] == "VALIDATION_ERROR"


async def test_list_pagination_and_filters(client, form_key_factory):
    form_key = form_key_factory("query")
    await setup_form(client, form_key)
    records = [
        {"name": "张三", "status": "paid", "amount": 100, "apply_range": ["2026-01-01", "2026-01-02"]},
        {"name": "李四", "status": "pending", "amount": 200, "apply_range": ["2026-02-01", "2026-02-02"]},
        {"name": "王五", "status": "paid", "amount": 300, "apply_range": ["2026-03-01", "2026-03-02"]},
    ]
    for record in records:
        await client.post(f"/api/form/{form_key}/submit", json=record)

    page1 = await client.get(f"/api/form/{form_key}/records", params={"current": 1, "pageSize": 2})
    body = page1.json()
    assert body["total"] == 3
    assert body["current"] == 1
    assert body["pageSize"] == 2
    assert len(body["data"]) == 2

    page2 = await client.get(f"/api/form/{form_key}/records", params={"current": 2, "pageSize": 2})
    assert len(page2.json()["data"]) == 1

    by_keyword = await client.get(f"/api/form/{form_key}/records", params={"keyword": "张三"})
    assert [r["data"]["name"] for r in by_keyword.json()["data"]] == ["张三"]

    by_string_filter = await client.get(
        f"/api/form/{form_key}/records", params={"filters": json.dumps({"status": "paid"})}
    )
    assert by_string_filter.json()["total"] == 2

    by_number_filter = await client.get(
        f"/api/form/{form_key}/records", params={"filters": json.dumps({"amount": 200})}
    )
    assert by_number_filter.json()["total"] == 1

    future = await client.get(
        f"/api/form/{form_key}/records", params={"startTime": "2999-01-01T00:00:00Z"}
    )
    assert future.json()["total"] == 0

    old = await client.get(
        f"/api/form/{form_key}/records", params={"endTime": "2000-01-01T00:00:00Z"}
    )
    assert old.json()["total"] == 0


async def test_page_size_clamped(client, form_key_factory):
    form_key = form_key_factory("clamp")
    await setup_form(client, form_key)
    await client.post(f"/api/form/{form_key}/submit", json={"name": "x"})
    response = await client.get(f"/api/form/{form_key}/records", params={"pageSize": 9999})
    assert response.json()["pageSize"] == 200


async def test_invalid_filters_json(client, form_key_factory):
    form_key = form_key_factory("badfilter")
    await setup_form(client, form_key)
    response = await client.get(f"/api/form/{form_key}/records", params={"filters": "not-json"})
    assert response.status_code == 400


async def test_update_and_delete(client, form_key_factory):
    form_key = form_key_factory("upd")
    await setup_form(client, form_key)
    created = (
        await client.post(f"/api/form/{form_key}/submit", json={"name": "旧名字"})
    ).json()["data"]

    updated = await client.put(
        f"/api/form/{form_key}/records/{created['id']}", json={"name": "新名字"}
    )
    assert updated.status_code == 200
    assert updated.json()["data"]["data"] == {"name": "新名字"}

    deleted = await client.delete(f"/api/form/{form_key}/records/{created['id']}")
    assert deleted.status_code == 200
    assert (
        await client.get(f"/api/form/{form_key}/records/{created['id']}")
    ).status_code == 404


async def test_record_not_found(client, form_key_factory):
    form_key = form_key_factory("norec")
    await setup_form(client, form_key)
    assert (await client.get(f"/api/form/{form_key}/records/99999")).status_code == 404
    assert (
        await client.put(f"/api/form/{form_key}/records/99999", json={"name": "x"})
    ).status_code == 404
    assert (await client.delete(f"/api/form/{form_key}/records/99999")).status_code == 404

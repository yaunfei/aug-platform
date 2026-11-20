"""视图映射 API 测试。"""

from __future__ import annotations

SCHEMA = {
    "formKey": "order_form",
    "title": "订单表单",
    "columns": [
        {"dataIndex": "customer_name", "title": "客户", "valueType": "text"},
        {
            "dataIndex": "status",
            "title": "状态",
            "valueType": "select",
            "valueEnum": {"pending": {"text": "待支付"}, "paid": {"text": "已支付"}},
        },
        {"dataIndex": "apply_range", "title": "申请区间", "valueType": "dateRange"},
        {"dataIndex": "contacts", "title": "联系人", "valueType": "formList",
         "columns": [
             {"dataIndex": "name", "title": "姓名", "valueType": "text"},
             {"dataIndex": "phone", "title": "电话", "valueType": "text"},
         ]},
    ],
}


def config(view_key: str) -> dict:
    return {
        "viewKey": view_key,
        "title": "CRM 订单接口",
        "formKey": "order_form",
        "mappings": [
            {"from": "$.id", "to": "recordId", "type": "long"},
            {"from": "$.data.customer_name", "to": "buyer.name", "type": "string"},
            {
                "from": "$.data.status",
                "to": "orderStatus",
                "type": "enum",
                "enumMap": {"pending": "待支付", "paid": "已支付"},
                "enumDefault": "未知",
            },
            {"from": "$.data.apply_range[0]", "to": "startDate", "type": "string"},
            {"from": "$.createdAt", "to": "createTime", "type": "datetime",
             "format": "yyyy-MM-dd HH:mm:ss"},
            {"to": "source", "type": "const", "value": "aug-platform"},
        ],
    }


async def ensure_schema(client, key: str = "order_form"):
    return await client.post(f"/api/schema/{key}/publish", json=SCHEMA if key == "order_form" else {**SCHEMA, "formKey": key})


async def test_publish_versions_and_rollback(client):
    assert (await ensure_schema(client)).status_code == 200
    first = await client.post("/api/view/crm_order/publish", json=config("crm_order"))
    assert first.status_code == 200, first.text
    assert first.json()["data"]["version"] == 1
    assert first.json()["data"]["warnings"] == []

    second = await client.post("/api/view/crm_order/publish", json=config("crm_order"))
    assert second.json()["data"]["version"] == 2

    listing = await client.get("/api/view")
    assert [v["viewKey"] for v in listing.json()["data"]] == ["crm_order"]

    versions = await client.get("/api/view/crm_order/versions")
    assert [v["version"] for v in versions.json()["data"]] == [2, 1]

    got = await client.get("/api/view/crm_order")
    assert got.json()["data"]["mapping"]["viewKey"] == "crm_order"

    rollback = await client.post("/api/view/crm_order/rollback", json={"version": 1})
    assert rollback.status_code == 200
    assert rollback.json()["data"]["version"] == 3

    again = await client.post("/api/view/crm_order/rollback", json={"version": 3})
    assert again.status_code == 400


async def test_publish_invalid_config_and_missing_form(client):
    await ensure_schema(client)
    mismatch = config("other_view")
    response = await client.post("/api/view/crm_x/publish", json=mismatch)
    assert response.status_code == 400

    broken = config("crm_broken")
    broken["mappings"] = [
        {"from": "$.id", "to": "a.b", "type": "long"},
        {"from": "$.id", "to": "a.b.c", "type": "string"},
    ]
    response = await client.post("/api/view/crm_broken/publish", json=broken)
    assert response.status_code == 400
    assert response.json()["errorCode"] == "VIEW_CONFIG_INVALID"

    missing = {**config("crm_missing"), "formKey": "no_such_form"}
    response = await client.post("/api/view/crm_missing/publish", json=missing)
    assert response.status_code == 404


async def test_test_endpoint_sample_data_and_record(client):
    await ensure_schema(client)
    await client.post("/api/view/crm_test/publish", json=config("crm_test"))

    sample = {
        "id": 7,
        "schemaVersion": 1,
        "createdAt": "2026-07-01T12:00:00Z",
        "data": {
            "customer_name": "张三",
            "status": "paid",
            "apply_range": ["2026-01-01", "2026-02-01"],
        },
    }
    response = await client.post("/api/view/crm_test/test", json={"sampleData": sample})
    assert response.status_code == 200
    transformed = response.json()["data"]["transformed"]
    assert transformed["recordId"] == 7
    assert transformed["buyer"]["name"] == "张三"
    assert transformed["orderStatus"] == "已支付"
    assert transformed["startDate"] == "2026-01-01"
    assert transformed["createTime"] == "2026-07-01 12:00:00"
    assert transformed["source"] == "aug-platform"

    submitted = await client.post(
        "/api/form/order_form/submit",
        json={"customer_name": "李四", "status": "pending", "apply_range": ["2026-01-01", "2026-02-01"]},
    )
    record_id = submitted.json()["data"]["id"]
    by_id = await client.post("/api/view/crm_test/test", json={"recordId": record_id})
    assert by_id.status_code == 200
    assert by_id.json()["data"]["transformed"]["orderStatus"] == "待支付"

    assert (await client.post("/api/view/crm_test/test", json={})).status_code == 400
    assert (
        await client.post("/api/view/crm_test/test", json={"recordId": 999999})
    ).status_code == 404


async def test_delete_view(client):
    await ensure_schema(client)
    await client.post("/api/view/crm_del/publish", json=config("crm_del"))
    assert (await client.delete("/api/view/crm_del")).status_code == 200
    assert (await client.get("/api/view/crm_del")).status_code == 404
    assert (await client.get("/api/view/crm_del/versions")).status_code == 404
    assert (await client.delete("/api/view/crm_del")).status_code == 404


async def test_generate_view_mock(client):
    await ensure_schema(client)
    response = await client.post(
        "/api/view/generate",
        json={"docText": "订单查询接口：返回 recordId、buyer.name、orderStatus", "formKey": "order_form"},
    )
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["mapping"]["viewKey"] == "crm_order_v2"
    assert data["mapping"]["formKey"] == "order_form"
    assert isinstance(data["warnings"], list)

    published = await client.post(
        "/api/view/crm_order_v2/publish", json=data["mapping"]
    )
    assert published.status_code == 200


async def test_generate_view_validation(client):
    response = await client.post(
        "/api/view/generate", json={"docText": "", "formKey": "order_form"}
    )
    assert response.status_code == 400
    response = await client.post(
        "/api/view/generate", json={"docText": "x", "formKey": "missing_form"}
    )
    assert response.status_code == 404

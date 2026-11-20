"""端到端主流程：建表 → 生成 → 发布 → 填单 → 查询 → 导出 → 视图分发。"""

from __future__ import annotations

import json


async def test_full_flow(client):
    # 1. AI 生成草稿
    generated = await client.post(
        "/api/schema/generate", json={"prdText": "做一个用户反馈表单，包含标题、严重程度、发生时间"}
    )
    assert generated.status_code == 200
    schema = generated.json()["data"]["schema"]
    form_key = schema["formKey"]

    # 2. 发布
    published = await client.post(f"/api/schema/{form_key}/publish", json=schema)
    assert published.status_code == 200, published.text
    assert published.json()["data"]["version"] == 1

    # 3. 填单
    submitted = await client.post(
        f"/api/form/{form_key}/submit",
        json={
            "feedback_title": "登录失败",
            "level": "p0",
            "occur_range": ["2026-07-01", "2026-07-02"],
        },
    )
    assert submitted.status_code == 200
    record_id = submitted.json()["data"]["id"]

    # 4. 查询 + 详情
    records = await client.get(f"/api/form/{form_key}/records", params={"keyword": "登录"})
    assert records.json()["total"] == 1
    detail = await client.get(f"/api/form/{form_key}/records/{record_id}")
    assert detail.json()["data"]["schemaVersion"] == 1

    # 5. 导出
    exported = await client.get(f"/api/form/{form_key}/export")
    assert exported.status_code == 200
    assert "登录失败" in exported.text
    assert "致命" in exported.text

    # 6. 视图分发
    view = {
        "viewKey": "e2e_feedback_view",
        "title": "反馈下游接口",
        "formKey": form_key,
        "mappings": [
            {"from": "$.id", "to": "id", "type": "long"},
            {"from": "$.data.feedback_title", "to": "title", "type": "string"},
            {
                "from": "$.data.level",
                "to": "levelText",
                "type": "enum",
                "enumMap": {"p0": "致命", "p1": "严重", "p2": "一般"},
                "enumDefault": "未知",
            },
            {"from": "$.data.occur_range[0]", "to": "startDate", "type": "string"},
            {"to": "platform", "type": "const", "value": "aug"},
        ],
    }
    assert (await client.post("/api/view/e2e_feedback_view/publish", json=view)).status_code == 200
    transformed = await client.post(
        "/api/view/e2e_feedback_view/test", json={"recordId": record_id}
    )
    output = transformed.json()["data"]["transformed"]
    assert output["title"] == "登录失败"
    assert output["levelText"] == "致命"
    assert output["startDate"] == "2026-07-01"

    # 7. 对话查询命中真实数据
    answer = await client.post(
        "/api/assistant/chat",
        json={"messages": [{"role": "user", "content": "平台有哪些表单？"}]},
    )
    assert form_key in answer.json()["data"]["reply"]

    # 8. 会话持久化
    saved = await client.put(
        "/api/assistant/sessions/e2e_session",
        json={
            "messages": [{"role": "user", "content": "做一个用户反馈表单"}],
            "schemaJson": json.dumps(schema, ensure_ascii=False),
        },
    )
    assert saved.status_code == 200
    assert saved.json()["data"]["title"] == "做一个用户反馈表单"

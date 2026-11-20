"""CSV 导出测试。"""

from __future__ import annotations

import csv
import io

import pytest

from app.services import export_service
from tests.test_records import build_schema, setup_form


def parse_csv(text: str) -> list[list[str]]:
    assert text.startswith("\ufeff")
    return list(csv.reader(io.StringIO(text.lstrip("\ufeff"))))


async def test_export_bom_header_and_values(client, form_key_factory):
    form_key = form_key_factory("export")
    await setup_form(client, form_key)
    await client.post(
        f"/api/form/{form_key}/submit",
        json={"name": "张三", "status": "paid", "amount": 10, "apply_range": ["2026-01-01", "2026-01-31"]},
    )
    await client.post(
        f"/api/form/{form_key}/submit",
        json={"name": "李四", "status": "pending", "amount": 20, "apply_range": ["2026-02-01", "2026-02-28"]},
    )

    response = await client.get(f"/api/form/{form_key}/export")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment" in response.headers["content-disposition"]
    assert form_key in response.headers["content-disposition"]

    rows = parse_csv(response.text)
    assert rows[0] == ["姓名", "状态", "金额", "申请时间", "id", "createdAt"]
    assert rows[1][0] == "李四"
    assert rows[1][1] == "待支付"
    assert rows[1][3] == "2026-02-01 ~ 2026-02-28"
    assert rows[2][1] == "已支付"
    assert rows[2][2] == "10"


async def test_export_applies_keyword(client, form_key_factory):
    form_key = form_key_factory("exportkw")
    await setup_form(client, form_key)
    await client.post(f"/api/form/{form_key}/submit", json={"name": "张三", "amount": 1})
    await client.post(f"/api/form/{form_key}/submit", json={"name": "李四", "amount": 2})
    response = await client.get(f"/api/form/{form_key}/export", params={"keyword": "张三"})
    rows = parse_csv(response.text)
    assert len(rows) == 2
    assert rows[1][0] == "张三"


async def test_export_truncation_header(client, form_key_factory, monkeypatch):
    form_key = form_key_factory("exporttrunc")
    await setup_form(client, form_key)
    for index in range(3):
        await client.post(f"/api/form/{form_key}/submit", json={"name": f"n{index}"})
    monkeypatch.setattr(export_service, "MAX_EXPORT_ROWS", 1)
    response = await client.get(f"/api/form/{form_key}/export")
    assert response.headers["x-truncated"] == "true"
    rows = parse_csv(response.text)
    assert len(rows) == 2


async def test_export_missing_schema(client, form_key_factory):
    response = await client.get(f"/api/form/{form_key_factory('noexport')}/export")
    assert response.status_code == 404

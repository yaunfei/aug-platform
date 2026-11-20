"""会话持久化测试。"""

from __future__ import annotations


async def test_save_get_list_delete(client):
    key = "draft_session"
    messages = [
        {"role": "user", "content": "帮我做一个很长的需求描述\n第二行"},
        {"role": "assistant", "content": "好的"},
    ]
    saved = await client.put(
        f"/api/assistant/sessions/{key}",
        json={"messages": messages, "schemaJson": '{"formKey":"a"}'},
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["data"]["title"] == "帮我做一个很长的需求描述"

    fetched = await client.get(f"/api/assistant/sessions/{key}")
    assert fetched.json()["data"]["schemaJson"] == '{"formKey":"a"}'
    assert fetched.json()["data"]["messages"] == messages

    listing = await client.get("/api/assistant/sessions")
    assert [s["sessionKey"] for s in listing.json()["data"]] == [key]

    updated = await client.put(
        f"/api/assistant/sessions/{key}",
        json={"messages": [{"role": "user", "content": "新"}], "schemaJson": ""},
    )
    assert updated.json()["data"]["title"] == "新"

    assert (await client.delete(f"/api/assistant/sessions/{key}")).status_code == 200
    assert (await client.get(f"/api/assistant/sessions/{key}")).status_code == 400
    assert (await client.delete(f"/api/assistant/sessions/{key}")).status_code == 200


async def test_title_truncated_to_30(client):
    content = "字" * 50
    saved = await client.put(
        "/api/assistant/sessions/title_case",
        json={"messages": [{"role": "user", "content": content}], "schemaJson": ""},
    )
    assert saved.json()["data"]["title"] == "字" * 30


async def test_invalid_session_key(client):
    response = await client.put(
        "/api/assistant/sessions/Bad-Key", json={"messages": [], "schemaJson": ""}
    )
    assert response.status_code == 400
    assert response.json()["errorCode"] == "VALIDATION_ERROR"


async def test_messages_must_be_list(client):
    response = await client.put(
        "/api/assistant/sessions/ok_key", json={"messages": "not-a-list", "schemaJson": ""}
    )
    assert response.status_code == 400


async def test_draft_key_allowed(client):
    response = await client.put(
        "/api/assistant/sessions/__draft__",
        json={"messages": [{"role": "user", "content": "草稿"}], "schemaJson": ""},
    )
    assert response.status_code == 200

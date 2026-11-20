"""对话助手：双层上下文检索 + 7 工具 tool-loop + SSE 流式。"""

from __future__ import annotations

import asyncio
import copy
import json
import logging
from datetime import datetime, timezone
from typing import Any, AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from ... import contracts, registry
from ...config import settings
from ...contracts import SchemaValidationError
from ...repositories import record_repo, schema_repo
from ...responses import AppError, ErrorCode
from . import prompt
from .client import LLMClient, MOCK_SCHEMA, ToolCall

logger = logging.getLogger("aug.ai.chat")

MAX_MESSAGE_CHARS = 20000
MAX_TOTAL_CHARS = 100_000
TOOL_RESULT_LIMIT = 4000
PREFETCH_LIMIT = 2000

CORE_INTENTS = {"generate", "modify", "review", "sample_data", "action", "reply"}


def build_tools() -> list[dict]:
    column_fields = {
        "dataIndex": {"type": "string"},
        "title": {"type": "string"},
        "valueType": {"type": "string"},
        "valueEnum": {"type": "object"},
        "formItemProps": {"type": "object"},
        "fieldProps": {"type": "object"},
        "hideInTable": {"type": "boolean"},
        "hideInSearch": {"type": "boolean"},
        "hideInForm": {"type": "boolean"},
        "tooltip": {"type": "string"},
        "width": {"type": "integer"},
        "columns": {"type": "array", "items": {"type": "object"}},
    }
    schema_object = {
        "type": "object",
        "properties": {
            "formKey": {"type": "string"},
            "title": {"type": "string"},
            "description": {"type": "string"},
            "columns": {
                "type": "array",
                "items": {"type": "object", "properties": column_fields},
            },
        },
        "required": ["formKey", "title", "columns"],
    }
    return [
        {
            "type": "function",
            "function": {
                "name": "generate_schema",
                "description": "根据用户需求生成全新表单 Schema 草稿",
                "parameters": {
                    "type": "object",
                    "properties": {"schema": schema_object, "reply": {"type": "string"}},
                    "required": ["schema", "reply"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "modify_schema",
                "description": "修改当前草稿，必须输出完整修改后的 Schema（未提及字段原样保留）",
                "parameters": {
                    "type": "object",
                    "properties": {"schema": schema_object, "reply": {"type": "string"}},
                    "required": ["schema", "reply"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "review_schema",
                "description": "审查当前 Schema 合理性并给出建议",
                "parameters": {
                    "type": "object",
                    "properties": {"reply": {"type": "string"}, "schema": schema_object},
                    "required": ["reply"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "generate_sample_data",
                "description": "为当前 Schema 生成预览用样例数据（≤20 条）",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "records": {"type": "array", "items": {"type": "object"}}
                    },
                    "required": ["records"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "query_platform",
                "description": "查询平台已有表单/版本/记录",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query_type": {
                            "type": "string",
                            "enum": [
                                "list_schemas",
                                "schema_detail",
                                "list_versions",
                                "diff_versions",
                                "query_records",
                            ],
                        },
                        "formKey": {"type": "string"},
                        "version": {"type": "integer"},
                        "keyword": {"type": "string"},
                        "startTime": {"type": "string"},
                        "endTime": {"type": "string"},
                        "filters": {"type": "object"},
                        "countOnly": {"type": "boolean"},
                    },
                    "required": ["query_type"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "propose_action",
                "description": "生成写操作提议（删除/发布/回滚/导出），等待用户确认",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "type": {
                            "type": "string",
                            "enum": ["delete", "publish", "rollback", "export"],
                        },
                        "formKey": {"type": "string"},
                        "version": {"type": "integer"},
                    },
                    "required": ["type", "formKey"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "reply",
                "description": "一般对话回复",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "reply": {"type": "string"},
                        "suggestions": {
                            "type": "array",
                            "items": {"type": "string"},
                            "maxItems": 3,
                        },
                    },
                    "required": ["reply"],
                },
            },
        },
    ]


TOOLS = build_tools()


def truncate_messages(messages: list[dict]) -> list[dict]:
    if not messages:
        raise AppError(ErrorCode.VALIDATION_ERROR, "messages 不能为空")
    if messages[-1].get("role") != "user":
        raise AppError(ErrorCode.VALIDATION_ERROR, "messages 最后一条必须是 user")
    cleaned: list[dict] = []
    for message in messages:
        role = message.get("role")
        if role not in ("user", "assistant", "system"):
            continue
        content = str(message.get("content") or "")
        if len(content) > MAX_MESSAGE_CHARS:
            content = content[:MAX_MESSAGE_CHARS]
        cleaned.append({"role": role, "content": content, **{
            k: v for k, v in message.items() if k in ("proposedSchema",)
        }})
    total = sum(len(m["content"]) for m in cleaned)
    while total > MAX_TOTAL_CHARS and len(cleaned) > 1:
        removed = cleaned.pop(0)
        total -= len(removed["content"])
    while cleaned and cleaned[0]["role"] != "user":
        removed = cleaned.pop(0)
        total -= len(removed["content"])
    if not cleaned:
        raise AppError(ErrorCode.VALIDATION_ERROR, "截断后没有有效的 user 消息")
    return cleaned


class ChatService:
    def __init__(self, db: AsyncSession, client: LLMClient | None = None):
        self.db = db
        self.client = client or LLMClient(timeout=settings.ai_chat_deadline_seconds, max_retry=0)
        self._query_cache: dict[str, Any] = {}

    # ---------------- 预检索 ----------------
    async def prefetch(self, messages: list[dict]) -> str:
        lines: list[str] = []
        latest_models = await schema_repo.list_latest(self.db)
        if latest_models:
            lines.append("平台已有表单：")
            for model in latest_models:
                title = (model.schema_json or {}).get("title", model.form_key)
                lines.append(f"- {model.form_key} v{model.version}：{title}")
        else:
            lines.append("平台当前没有任何已发布表单。")

        recent_user = [m["content"] for m in messages if m["role"] == "user"][-2:]
        matched: list[str] = []
        for model in latest_models:
            title = (model.schema_json or {}).get("title", "")
            if any(model.form_key in text or (title and title in text) for text in recent_user):
                if model.form_key in matched:
                    continue
                matched.append(model.form_key)
                if len(matched) >= 3:
                    break
        if matched:
            lines.append("用户可能关注的表单详情：")
            for form_key in matched:
                versions = await schema_repo.list_versions(self.db, form_key)
                latest = versions[0]
                fields = [
                    f"{c.get('dataIndex')}({c.get('valueType')})"
                    for c in contracts.flatten_columns((latest.schema_json or {}).get("columns") or [])
                ]
                history = ", ".join(f"v{m.version}" for m in versions[:8])
                lines.append(
                    f"- {form_key}：字段 {', '.join(fields[:30])}；版本历史 {history}"
                )
        text = "\n".join(lines)
        return text[:PREFETCH_LIMIT]

    # ---------------- 工具执行 ----------------
    async def _execute_query(self, args: dict) -> tuple[dict, bool]:
        cache_key = json.dumps(args, sort_keys=True, ensure_ascii=False)
        if cache_key in self._query_cache:
            return self._query_cache[cache_key], True
        query_type = args.get("query_type")
        form_key = args.get("formKey")
        result: dict[str, Any] = {}
        if query_type == "list_schemas":
            models = await schema_repo.list_latest(self.db)
            result = {
                "schemas": [
                    {
                        "formKey": m.form_key,
                        "version": m.version,
                        "title": (m.schema_json or {}).get("title"),
                    }
                    for m in models
                ]
            }
        elif query_type == "schema_detail":
            if not form_key:
                result = {"error": "schema_detail 需要 formKey"}
            else:
                model = await schema_repo.latest(self.db, form_key)
                if args.get("version") is not None:
                    model = await schema_repo.get_version(self.db, form_key, int(args["version"]))
                result = (
                    {"formKey": model.form_key, "version": model.version, "schema": model.schema_json}
                    if model
                    else {"error": f"表单 {form_key} 不存在"}
                )
        elif query_type == "list_versions":
            if not form_key:
                result = {"error": "list_versions 需要 formKey"}
            else:
                models = await schema_repo.list_versions(self.db, form_key)
                result = {
                    "formKey": form_key,
                    "versions": [
                        {"version": m.version, "createdAt": str(m.created_at)} for m in models
                    ],
                }
        elif query_type == "diff_versions":
            if not form_key:
                result = {"error": "diff_versions 需要 formKey"}
            else:
                models = await schema_repo.list_versions(self.db, form_key)
                if len(models) < 2:
                    result = {"error": "该表单少于两个版本，无法对比"}
                else:
                    current = models[0]
                    target = (
                        await schema_repo.get_version(self.db, form_key, int(args["version"]))
                        if args.get("version") is not None
                        else models[1]
                    )
                    result = {
                        "fromVersion": target.version if target else None,
                        "toVersion": current.version,
                        "diff": _diff_columns(
                            (target.schema_json if target else {}).get("columns") or [],
                            (current.schema_json or {}).get("columns") or [],
                        ),
                    }
        elif query_type == "query_records":
            if not form_key:
                result = {"error": "query_records 需要 formKey"}
            else:
                rows, total = await record_repo.query(
                    self.db,
                    form_key,
                    current=1,
                    page_size=5,
                    keyword=args.get("keyword"),
                    filters=args.get("filters"),
                    start_time=_parse_time(args.get("startTime")),
                    end_time=_parse_time(args.get("endTime")),
                )
                if args.get("countOnly"):
                    result = {"formKey": form_key, "total": total}
                else:
                    result = {
                        "formKey": form_key,
                        "total": total,
                        "records": [
                            {
                                "id": r.id,
                                "schemaVersion": r.schema_version,
                                "data": r.data,
                                "createdAt": str(r.created_at),
                            }
                            for r in rows
                        ],
                    }
        else:
            result = {"error": f"未知 query_type：{query_type}"}
        self._query_cache[cache_key] = result
        return result, False

    async def _execute_tool(self, call: ToolCall) -> tuple[dict | None, dict | None, str | None]:
        """返回 (final_payload, tool_result, error_feedback)。"""
        name = call.name
        args = call.arguments or {}
        if name in ("generate_schema", "modify_schema"):
            schema_raw = args.get("schema")
            try:
                schema = contracts.validate_schema(schema_raw)
            except SchemaValidationError as exc:
                return None, {"error": f"Schema 校验失败：{exc}"}, str(exc)
            return (
                {
                    "intent": "generate" if name == "generate_schema" else "modify",
                    "schema": contracts.dump_schema(schema),
                    "reply": args.get("reply") or "",
                },
                {"status": "ok", "formKey": schema.formKey},
                None,
            )
        if name == "review_schema":
            payload: dict[str, Any] = {"intent": "review", "reply": args.get("reply") or ""}
            if args.get("schema") is not None:
                try:
                    schema = contracts.validate_schema(args["schema"])
                    payload["schema"] = contracts.dump_schema(schema)
                except SchemaValidationError as exc:
                    payload["warnings"] = [str(exc)]
            return payload, {"status": "ok"}, None
        if name == "generate_sample_data":
            records = args.get("records") or []
            if not isinstance(records, list):
                records = []
            return (
                {
                    "intent": "sample_data",
                    "reply": f"已生成 {len(records)} 条样例数据",
                    "sampleData": records[:20],
                },
                {"status": "ok", "count": len(records[:20])},
                None,
            )
        if name == "propose_action":
            action = {
                "type": args.get("type"),
                "formKey": args.get("formKey"),
                "version": args.get("version"),
            }
            return (
                {
                    "intent": "action",
                    "reply": f"已生成操作提议：{action['type']} {action['formKey']}",
                    "action": action,
                },
                {"status": "ok", "action": action},
                None,
            )
        if name == "query_platform":
            result, cached = await self._execute_query(args)
            return None, result, None
        if name == "reply":
            suggestions = args.get("suggestions") or []
            return (
                {
                    "intent": "reply",
                    "reply": args.get("reply") or "",
                    "suggestions": [str(s) for s in suggestions[:3]],
                },
                {"status": "ok"},
                None,
            )
        return None, {"error": f"未知工具：{name}"}, None

    # ---------------- 非流式 ----------------
    async def handle(self, messages: list[dict], current_schema: dict | None = None) -> dict:
        messages = truncate_messages(messages)
        if self.client.is_mock:
            return await self._mock_response(messages, current_schema)
        try:
            async with asyncio.timeout(settings.ai_chat_deadline_seconds):
                return await self._run_tool_loop(messages, current_schema)
        except TimeoutError as exc:
            raise AppError(ErrorCode.AI_GENERATE_FAILED, "AI 对话超时") from exc

    async def _run_tool_loop(self, messages: list[dict], current_schema: dict | None) -> dict:
        now = datetime.now(timezone.utc)
        context = await self.prefetch(messages)
        system = prompt.build_chat_system_prompt(now, context, current_schema)
        openai_messages: list[dict] = [{"role": "system", "content": system}]
        for message in messages:
            openai_messages.append({"role": message["role"], "content": message["content"]})

        budget = settings.ai_chat_tool_result_budget
        validation_failures = 0
        max_rounds = settings.ai_chat_max_tool_rounds
        final: dict | None = None
        for round_index in range(max_rounds + 1):
            tool_choice: Any = "auto"
            if round_index >= max_rounds or budget <= 0:
                openai_messages.append(
                    {
                        "role": "system",
                        "content": "工具预算已耗尽，请基于已有信息直接给出最终回答，不要再调用查询工具。",
                    }
                )
                tool_choice = "none"
            assistant = await self.client.complete_tools(
                openai_messages, TOOLS, tool_choice, max_retry=0
            )
            if not assistant.tool_calls:
                reply = assistant.content or "好的。"
                final = {"intent": "reply", "reply": reply}
                break
            openai_messages.append(assistant.as_dict())
            calls = assistant.tool_calls[: settings.ai_chat_max_calls_per_round]
            payloads = await asyncio.gather(*[self._execute_tool(call) for call in calls])
            stop_loop = False
            for call, (payload, tool_result, error_feedback) in zip(calls, payloads):
                content = json.dumps(tool_result, ensure_ascii=False) if tool_result is not None else "{}"
                if len(content) > TOOL_RESULT_LIMIT:
                    content = content[:TOOL_RESULT_LIMIT]
                budget -= len(content)
                openai_messages.append(
                    {"role": "tool", "tool_call_id": call.id, "content": content}
                )
                if error_feedback:
                    validation_failures += 1
                    if validation_failures > settings.ai_max_retry:
                        raise AppError(
                            ErrorCode.AI_GENERATE_FAILED,
                            f"AI 生成的 Schema 连续未通过校验：{error_feedback}",
                        )
                if payload is not None:
                    final = payload
            if final is not None:
                break
        if final is None:
            final = {"intent": "reply", "reply": "抱歉，我暂时无法完成该请求。"}
        final.setdefault("warnings", [])
        return final

    # ---------------- mock 分派 ----------------
    async def _mock_response(self, messages: list[dict], current_schema: dict | None) -> dict:
        last_user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
        has_tool = any(m["role"] in ("tool",) for m in messages)
        if has_tool:
            return {"intent": "reply", "reply": _mock_query_summary(messages), "warnings": []}
        if any(keyword in last_user for keyword in ("示例", "测试数据", "样例数据")):
            schema = current_schema or MOCK_SCHEMA
            return {
                "intent": "sample_data",
                "reply": "已生成 3 条样例数据，可用于预览。",
                "sampleData": _sample_records(schema),
                "warnings": [],
            }
        if "审查" in last_user:
            reply = (
                "审查结论：\n1. 字段命名符合 snake_case 规范；\n2. 枚举字段均提供了 valueEnum；\n"
                "3. 建议为其余字段补充 hideInSearch，避免列表页查询区过宽。"
            )
            return {"intent": "review", "reply": reply, "warnings": []}
        if "删除" in last_user:
            form_key = _guess_form_key(last_user, current_schema)
            return {
                "intent": "action",
                "reply": f"将删除表单 {form_key} 的全部版本与记录，请确认后执行。",
                "action": {"type": "delete", "formKey": form_key},
                "warnings": [],
            }
        if any(keyword in last_user for keyword in ("有哪些", "列表", "查一下", "查询")):
            models = await schema_repo.list_latest(self.db)
            if not models:
                reply = "平台当前还没有任何已发布表单。"
            else:
                lines = ["当前平台已发布表单："]
                for model in models:
                    title = (model.schema_json or {}).get("title", model.form_key)
                    lines.append(f"- {model.form_key} v{model.version}：{title}")
                reply = "\n".join(lines)
            return {"intent": "reply", "reply": reply, "warnings": []}
        if any(keyword in last_user for keyword in ("修改", "改成", "增加", "新增字段")) and current_schema:
            schema = copy.deepcopy(current_schema)
            return {
                "intent": "modify",
                "reply": "已按你的要求调整草稿。",
                "schema": schema,
                "warnings": [],
            }
        if any(keyword in last_user for keyword in ("生成", "创建", "表单")):
            return {
                "intent": "generate",
                "reply": "已生成「用户反馈表」草稿，请在右侧预览并确认。",
                "schema": copy.deepcopy(MOCK_SCHEMA),
                "warnings": [],
            }
        return {
            "intent": "reply",
            "reply": "我可以帮你生成表单 Schema、修改草稿、审查字段设计或查询平台数据。请描述你的需求。",
            "suggestions": ["生成一个用户反馈表单", "查看平台有哪些表单", "审查当前草稿"],
            "warnings": [],
        }

    # ---------------- 流式 ----------------
    async def stream(self, messages: list[dict], current_schema: dict | None = None) -> AsyncIterator[dict]:
        messages = truncate_messages(messages)
        if self.client.is_mock:
            result = await self._mock_response(messages, current_schema)
            reply = result.get("reply") or ""
            for idx in range(0, len(reply), 8):
                yield {"type": "delta", "text": reply[idx : idx + 8]}
                await asyncio.sleep(0)
            yield {"type": "final", "data": result}
            return
        try:
            async with asyncio.timeout(settings.ai_chat_deadline_seconds):
                async for event in self._stream_real(messages, current_schema):
                    yield event
        except TimeoutError:
            yield {"type": "error", "message": "AI 对话超时"}

    async def _stream_real(
        self, messages: list[dict], current_schema: dict | None
    ) -> AsyncIterator[dict]:
        now = datetime.now(timezone.utc)
        context = await self.prefetch(messages)
        system = prompt.build_chat_system_prompt(now, context, current_schema)
        openai_messages: list[dict] = [{"role": "system", "content": system}]
        for message in messages:
            openai_messages.append({"role": message["role"], "content": message["content"]})
        final: dict | None = None
        budget = settings.ai_chat_tool_result_budget
        for round_index in range(settings.ai_chat_max_tool_rounds + 1):
            tool_choice: Any = "auto"
            if round_index >= settings.ai_chat_max_tool_rounds or budget <= 0:
                tool_choice = "none"
            message_obj = None
            calls: list[ToolCall] = []
            async for kind, payload in self.client.stream_tools(
                openai_messages, TOOLS, tool_choice
            ):
                if kind == "delta" and payload:
                    yield {"type": "delta", "text": payload}
                elif kind == "reset":
                    yield {"type": "reset"}
                elif kind == "result":
                    message_obj, calls = payload
            if not calls:
                final = {
                    "intent": "reply",
                    "reply": (message_obj.content if message_obj else "") or "好的。",
                }
                break
            openai_messages.append((message_obj or message_obj).as_dict() if message_obj else {
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {
                        "id": c.id,
                        "type": "function",
                        "function": {"name": c.name, "arguments": json.dumps(c.arguments, ensure_ascii=False)},
                    }
                    for c in calls
                ],
            })
            is_query = any(c.name == "query_platform" for c in calls)
            if is_query:
                yield {"type": "stage", "text": "正在查询平台数据…"}
            payloads = await asyncio.gather(
                *[self._execute_tool(c) for c in calls[: settings.ai_chat_max_calls_per_round]]
            )
            for call, (payload, tool_result, error_feedback) in zip(calls, payloads):
                content = json.dumps(tool_result, ensure_ascii=False) if tool_result else "{}"
                if len(content) > TOOL_RESULT_LIMIT:
                    content = content[:TOOL_RESULT_LIMIT]
                budget -= len(content)
                openai_messages.append(
                    {"role": "tool", "tool_call_id": call.id, "content": content}
                )
                if error_feedback:
                    yield {"type": "reset"}
                if payload is not None:
                    final = payload
            if final is not None:
                break
        if final is None:
            final = {"intent": "reply", "reply": "抱歉，我暂时无法完成该请求。"}
        final.setdefault("warnings", [])
        yield {"type": "final", "data": final}


def _parse_time(value: str | None):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _diff_columns(old_columns: list[dict], new_columns: list[dict]) -> dict:
    def flatten(columns: list[dict], out: dict[str, dict]) -> None:
        for col in columns or []:
            data_index = col.get("dataIndex")
            if data_index:
                out[data_index] = col
            if col.get("columns"):
                flatten(col["columns"], out)

    old_map: dict[str, dict] = {}
    new_map: dict[str, dict] = {}
    flatten(old_columns, old_map)
    flatten(new_columns, new_map)
    added = [k for k in new_map if k not in old_map]
    removed = [k for k in old_map if k not in new_map]
    changed = [
        k
        for k in new_map
        if k in old_map
        and (
            new_map[k].get("valueType") != old_map[k].get("valueType")
            or new_map[k].get("title") != old_map[k].get("title")
        )
    ]
    return {"added": added, "removed": removed, "changed": changed}


def _sample_records(schema: dict) -> list[dict]:
    columns = contracts.flatten_columns(schema.get("columns") or [])
    base: dict[str, Any] = {}
    for col in columns:
        data_index = col.get("dataIndex")
        if not data_index:
            continue
        value_type = col.get("valueType")
        enum = col.get("valueEnum") or {}
        if enum:
            base[data_index] = next(iter(enum.keys()))
        elif value_type in ("digit", "money", "percent", "second", "progress", "rate"):
            base[data_index] = 100 if value_type != "rate" else 5
        elif value_type == "switch":
            base[data_index] = True
        elif value_type == "date":
            base[data_index] = "2026-01-01"
        elif value_type == "dateTime":
            base[data_index] = "2026-01-01 10:00:00"
        elif value_type == "dateRange":
            base[data_index] = ["2026-01-01", "2026-01-31"]
        elif value_type == "formList":
            base[data_index] = []
        else:
            base[data_index] = f"{col.get('title') or data_index}示例"
    return [copy.deepcopy(base) for _ in range(3)]


def _guess_form_key(text: str, current_schema: dict | None) -> str:
    candidates = [
        token.strip("，。！？,.!?\"'()（）")
        for token in text.replace("删除", " ").split()
        if token.strip()
    ]
    for token in candidates:
        if token and registry.is_registered(token) is False and token.isascii():
            return token
    if current_schema and current_schema.get("formKey"):
        return str(current_schema["formKey"])
    return "unknown_form"


def _mock_query_summary(messages: list[dict]) -> str:
    for message in reversed(messages):
        if message["role"] == "tool":
            return f"查询结果：{message['content'][:500]}"
    return "查询完成。"

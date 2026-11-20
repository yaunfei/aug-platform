"""LLM 客户端：OpenAI 兼容协议 + mock，三级降级链。"""

from __future__ import annotations

import asyncio
import copy
import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any, AsyncIterator

from ...config import settings
from ...responses import AppError, ErrorCode

logger = logging.getLogger("aug.ai")

MOCK_SCHEMA: dict = {
    "formKey": "user_feedback",
    "title": "用户反馈表",
    "columns": [
        {
            "dataIndex": "feedback_title",
            "title": "反馈标题",
            "valueType": "text",
            "hideInSearch": True,
            "formItemProps": {"rules": [{"required": True, "message": "请输入反馈标题"}]},
            "fieldProps": {"maxLength": 100},
        },
        {
            "dataIndex": "level",
            "title": "严重程度",
            "valueType": "select",
            "valueEnum": {"p0": {"text": "致命"}, "p1": {"text": "严重"}, "p2": {"text": "一般"}},
            "formItemProps": {"rules": [{"required": True, "message": "请选择严重程度"}]},
        },
        {
            "dataIndex": "occur_range",
            "title": "发生时间",
            "valueType": "dateRange",
            "hideInTable": True,
            "hideInSearch": True,
        },
    ],
}

UNSUPPORTED_KEYWORDS = ("response_format", "json_schema", "tool", "function", "unsupported", "not support")


def strip_code_fence(text: str) -> str:
    text = text.strip()
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.S)
    if fence:
        return fence.group(1)
    return text


def _is_unsupported(exc: Exception) -> bool:
    status = getattr(exc, "status_code", None)
    message = str(exc).lower()
    if status == 400:
        return True
    return any(keyword in message for keyword in UNSUPPORTED_KEYWORDS)


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict


@dataclass
class AssistantMessage:
    content: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)

    def as_dict(self) -> dict:
        payload: dict[str, Any] = {"role": "assistant", "content": self.content or None}
        if self.tool_calls:
            payload["tool_calls"] = [
                {
                    "id": call.id,
                    "type": "function",
                    "function": {"name": call.name, "arguments": json.dumps(call.arguments, ensure_ascii=False)},
                }
                for call in self.tool_calls
            ]
        return payload


class LLMClient:
    def __init__(self, *, provider: str | None = None, timeout: float | None = None, max_retry: int | None = None):
        self.provider = (provider or settings.ai_provider).lower()
        self.timeout = timeout if timeout is not None else settings.ai_timeout_seconds
        self.max_retry = max_retry if max_retry is not None else settings.ai_max_retry
        self._client = None

    @property
    def is_mock(self) -> bool:
        return self.provider == "mock"

    def _openai(self):
        if self._client is None:
            from openai import AsyncOpenAI

            self._client = AsyncOpenAI(
                api_key=settings.ai_api_key or "sk-mock",
                base_url=settings.ai_base_url,
                timeout=self.timeout,
            )
        return self._client

    async def _with_retry(self, factory, *, retries: int | None = None):
        retries = self.max_retry if retries is None else retries
        last_exc: Exception | None = None
        for attempt in range(retries + 1):
            try:
                return await factory()
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                if attempt >= retries or _is_unsupported(exc):
                    raise
                await asyncio.sleep(2**attempt)
        raise last_exc  # pragma: no cover

    async def complete_json(
        self,
        system: str,
        user: str,
        json_schema: dict,
        *,
        mock_payload: dict | None = None,
    ) -> dict:
        if self.is_mock:
            return copy.deepcopy(mock_payload if mock_payload is not None else MOCK_SCHEMA)
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]
        try:
            return await self._with_retry(
                lambda: self._json_schema_call(messages, json_schema)
            )
        except AppError:
            raise
        except Exception as exc:  # noqa: BLE001
            if not _is_unsupported(exc):
                logger.warning("json_schema 调用失败，降级 function calling：%s", exc)
            else:
                logger.info("provider 不支持 json_schema，降级 function calling")

        try:
            return await self._with_retry(lambda: self._function_call_json(messages, json_schema))
        except Exception as exc:  # noqa: BLE001
            logger.warning("function calling 失败，降级纯 prompt：%s", exc)
        try:
            return await self._with_retry(lambda: self._plain_json_call(messages, json_schema))
        except Exception as exc:  # noqa: BLE001
            raise AppError(ErrorCode.AI_GENERATE_FAILED, f"AI 生成失败：{exc}") from exc

    async def _json_schema_call(self, messages: list, json_schema: dict) -> dict:
        client = self._openai()
        response = await client.chat.completions.create(
            model=settings.ai_model,
            messages=messages,
            response_format={
                "type": "json_schema",
                "json_schema": {"name": "schema", "schema": json_schema, "strict": True},
            },
        )
        return self._parse_json_content(response.choices[0].message.content or "")

    async def _function_call_json(self, messages: list, json_schema: dict) -> dict:
        client = self._openai()
        response = await client.chat.completions.create(
            model=settings.ai_model,
            messages=messages,
            tools=[
                {
                    "type": "function",
                    "function": {
                        "name": "emit_json",
                        "description": "输出最终 JSON",
                        "parameters": json_schema,
                    },
                }
            ],
            tool_choice={"type": "function", "function": {"name": "emit_json"}},
        )
        message = response.choices[0].message
        calls = getattr(message, "tool_calls", None) or []
        if not calls:
            raise ValueError("function calling 未返回 tool_calls")
        return self._parse_json_content(calls[0].function.arguments)

    async def _plain_json_call(self, messages: list, json_schema: dict) -> dict:
        client = self._openai()
        prompt = messages + [
            {
                "role": "user",
                "content": "只输出一个 JSON 对象，不要解释、不要 Markdown 围栏。",
            }
        ]
        response = await client.chat.completions.create(model=settings.ai_model, messages=prompt)
        return self._parse_json_content(response.choices[0].message.content or "")

    @staticmethod
    def _parse_json_content(content: str) -> dict:
        parsed = json.loads(strip_code_fence(content))
        if not isinstance(parsed, dict):
            raise ValueError("AI 返回的不是 JSON 对象")
        return parsed

    async def complete_tools(
        self,
        messages: list,
        tools: list[dict],
        tool_choice: Any = "auto",
        *,
        max_retry: int | None = None,
    ) -> AssistantMessage:
        if self.is_mock:
            return AssistantMessage(content="", tool_calls=[])
        client = self._openai()

        async def call():
            response = await client.chat.completions.create(
                model=settings.ai_model,
                messages=messages,
                tools=tools,
                tool_choice=tool_choice,
            )
            return self._to_assistant(response.choices[0].message)

        try:
            return await self._with_retry(call, retries=max_retry)
        except Exception as exc:  # noqa: BLE001
            if not _is_unsupported(exc):
                raise
        # 降级：prompt JSON 信封
        envelope_tools = [t for t in tools if t["function"]["name"] in {
            "generate_schema", "modify_schema", "propose_action", "reply"
        }]
        hint = "请输出 JSON 信封：{\"intent\": \"...\", ...}，可用工具：" + json.dumps(
            [t["function"]["name"] for t in envelope_tools], ensure_ascii=False
        )
        try:
            response = await client.chat.completions.create(
                model=settings.ai_model,
                messages=messages + [{"role": "user", "content": hint}],
            )
            payload = self._parse_json_content(response.choices[0].message.content or "")
            intent = payload.get("intent") or "reply"
            arguments = {k: v for k, v in payload.items() if k != "intent"}
            return AssistantMessage(
                content="", tool_calls=[ToolCall(id="fallback", name=intent, arguments=arguments)]
            )
        except Exception as exc:  # noqa: BLE001
            raise AppError(ErrorCode.AI_GENERATE_FAILED, f"AI 对话失败：{exc}") from exc

    @staticmethod
    def _to_assistant(message: Any) -> AssistantMessage:
        calls = []
        for call in getattr(message, "tool_calls", None) or []:
            try:
                arguments = json.loads(call.function.arguments or "{}")
            except json.JSONDecodeError:
                arguments = {}
            calls.append(ToolCall(id=call.id, name=call.function.name, arguments=arguments))
        return AssistantMessage(content=message.content or "", tool_calls=calls)

    async def stream_tools(
        self,
        messages: list,
        tools: list[dict],
        tool_choice: Any = "auto",
        *,
        mock_reply: str | None = None,
        mock_calls: list[ToolCall] | None = None,
    ) -> AsyncIterator[tuple[str, Any]]:
        """产出 ("delta", text)…，末尾 ("result", (AssistantMessage, calls))。"""
        if self.is_mock:
            reply = mock_reply or ""
            for idx in range(0, len(reply), 8):
                yield "delta", reply[idx : idx + 8]
                await asyncio.sleep(0)
            yield "result", (AssistantMessage(content=reply), mock_calls or [])
            return

        client = self._openai()
        accumulated = ""
        extractor = _ReplyExtractor()
        try:
            stream = await client.chat.completions.create(
                model=settings.ai_model,
                messages=messages,
                tools=tools,
                tool_choice=tool_choice,
                stream=True,
            )
            tool_buffers: dict[int, dict] = {}
            content_buffer = ""
            async for chunk in stream:
                choice = chunk.choices[0]
                delta = choice.delta
                if getattr(delta, "content", None):
                    content_buffer += delta.content
                    extractor.feed(delta.content)
                    new_text = extractor.take()
                    if new_text:
                        yield "delta", new_text
                for call_delta in getattr(delta, "tool_calls", None) or []:
                    slot = tool_buffers.setdefault(
                        call_delta.index, {"id": "", "name": "", "arguments": ""}
                    )
                    if call_delta.id:
                        slot["id"] = call_delta.id
                    if call_delta.function and call_delta.function.name:
                        slot["name"] = call_delta.function.name
                    if call_delta.function and call_delta.function.arguments:
                        slot["arguments"] += call_delta.function.arguments
                        extractor.feed(call_delta.function.arguments)
                        new_text = extractor.take()
                        if new_text:
                            yield "delta", new_text
            calls = []
            for slot in tool_buffers.values():
                try:
                    args = json.loads(slot["arguments"] or "{}")
                except json.JSONDecodeError:
                    args = {}
                calls.append(ToolCall(id=slot["id"] or "call", name=slot["name"], arguments=args))
            yield "result", (AssistantMessage(content=content_buffer, tool_calls=calls), calls)
        except Exception as exc:  # noqa: BLE001
            logger.warning("流式失败，回退非流式：%s", exc)
            message = await self.complete_tools(messages, tools, tool_choice)
            yield "reset", None
            yield "result", (message, message.tool_calls)


class _ReplyExtractor:
    """从流式 JSON arguments 中增量提取 "reply" 字符串值。"""

    _PATTERN = re.compile(r'"reply"\s*:\s*"((?:[^"\\]|\\.)*)"')

    def __init__(self) -> None:
        self.buffer = ""
        self.emitted = ""

    def feed(self, chunk: str) -> None:
        self.buffer += chunk
        if len(self.buffer) > 200_000:
            self.buffer = self.buffer[-100_000:]

    def take(self) -> str:
        match = self._PATTERN.search(self.buffer)
        if not match:
            return ""
        raw = match.group(1)
        try:
            decoded = json.loads(f'"{raw}"')
        except json.JSONDecodeError:
            return ""
        if len(decoded) > len(self.emitted) and decoded.startswith(self.emitted):
            new_text = decoded[len(self.emitted) :]
            self.emitted = decoded
            return new_text
        return ""

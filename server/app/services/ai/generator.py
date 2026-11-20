"""单发 Schema 生成：校验 + 错误回灌重试。"""

from __future__ import annotations

import logging

from ... import contracts
from ...config import settings
from ...contracts import SchemaValidationError
from ...responses import AppError, ErrorCode
from . import prompt
from .client import LLMClient

logger = logging.getLogger("aug.ai.generator")

_exported = False


def ensure_json_schema_exported() -> dict:
    global _exported
    if not _exported:
        contracts.export_json_schema()
        _exported = True
    return contracts.export_json_schema()


class SchemaGenerator:
    def __init__(self, client: LLMClient | None = None):
        self.client = client or LLMClient()
        self.json_schema = ensure_json_schema_exported()

    async def generate(self, prd_text: str, form_key_hint: str | None = None) -> dict:
        system = prompt.build_schema_system_prompt()
        user = prompt.build_user_prompt(prd_text, form_key_hint)
        last_error = ""
        for attempt in range(settings.ai_max_retry + 1):
            payload = await self.client.complete_json(system, user, self.json_schema)
            try:
                schema = contracts.validate_schema(payload)
                return {"schema": contracts.dump_schema(schema), "warnings": []}
            except SchemaValidationError as exc:
                last_error = str(exc)
                logger.info("schema 校验失败（第 %s 次）：%s", attempt + 1, last_error)
                user = prompt.build_retry_user_prompt(user, last_error)
        raise AppError(
            ErrorCode.AI_GENERATE_FAILED,
            f"AI 生成未通过校验（已重试 {settings.ai_max_retry} 次）：{last_error}",
        )


async def generate_schema(
    prd_text: str, form_key_hint: str | None = None, client: LLMClient | None = None
) -> dict:
    return await SchemaGenerator(client).generate(prd_text, form_key_hint)

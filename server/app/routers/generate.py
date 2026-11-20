"""AI 单发生成端点（不落库）。"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..responses import ok
from ..services.ai.generator import generate_schema

router = APIRouter(prefix="/api/schema", tags=["generate"])


class GenerateRequest(BaseModel):
    prdText: str = Field(min_length=1, max_length=20000)
    formKeyHint: str | None = None


@router.post("/generate")
async def generate(body: GenerateRequest):
    result = await generate_schema(body.prdText, body.formKeyHint or None)
    return ok(result)

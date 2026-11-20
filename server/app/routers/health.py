"""健康检查。"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text

from ..db import SessionLocal
from ..responses import ok

router = APIRouter()


@router.get("/health")
async def health():
    try:
        async with SessionLocal() as session:
            await session.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001
        return JSONResponse(
            status_code=503,
            content={"success": False, "errorCode": "INTERNAL_ERROR", "errorMessage": f"数据库不可用：{exc}"},
        )
    return ok({"status": "ok"})

"""统一响应包与业务异常。"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class ErrorCode:
    VALIDATION_ERROR = "VALIDATION_ERROR"
    SCHEMA_INVALID = "SCHEMA_INVALID"
    UNAUTHORIZED = "UNAUTHORIZED"
    SCHEMA_NOT_FOUND = "SCHEMA_NOT_FOUND"
    RECORD_NOT_FOUND = "RECORD_NOT_FOUND"
    PAYLOAD_TOO_LARGE = "PAYLOAD_TOO_LARGE"
    INTERNAL_ERROR = "INTERNAL_ERROR"
    AI_GENERATE_FAILED = "AI_GENERATE_FAILED"
    VIEW_NOT_FOUND = "VIEW_NOT_FOUND"
    VIEW_CONFIG_INVALID = "VIEW_CONFIG_INVALID"
    VIEW_MAPPING_ERROR = "VIEW_MAPPING_ERROR"


STATUS_BY_CODE = {
    ErrorCode.VALIDATION_ERROR: 400,
    ErrorCode.SCHEMA_INVALID: 400,
    ErrorCode.UNAUTHORIZED: 401,
    ErrorCode.SCHEMA_NOT_FOUND: 404,
    ErrorCode.RECORD_NOT_FOUND: 404,
    ErrorCode.PAYLOAD_TOO_LARGE: 413,
    ErrorCode.INTERNAL_ERROR: 500,
    ErrorCode.AI_GENERATE_FAILED: 502,
    ErrorCode.VIEW_NOT_FOUND: 404,
    ErrorCode.VIEW_CONFIG_INVALID: 400,
    ErrorCode.VIEW_MAPPING_ERROR: 500,
}


class AppError(Exception):
    def __init__(self, code: str, message: str, status: int | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status or STATUS_BY_CODE.get(code, 400)


def ok(data: Any = None, **extra: Any) -> dict:
    payload: dict = {"success": True, "data": data}
    payload.update(extra)
    return payload


def page(data: list, total: int, current: int, page_size: int) -> dict:
    return {
        "success": True,
        "data": data,
        "total": total,
        "current": current,
        "pageSize": page_size,
    }


def error_payload(code: str, message: str) -> dict:
    return {"success": False, "errorCode": code, "errorMessage": message}


def install_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status, content=error_payload(exc.code, exc.message))

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=400,
            content=error_payload(ErrorCode.VALIDATION_ERROR, _format_validation(exc)),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = {
            401: ErrorCode.UNAUTHORIZED,
            404: "NOT_FOUND",
            413: ErrorCode.PAYLOAD_TOO_LARGE,
        }.get(exc.status_code, ErrorCode.INTERNAL_ERROR)
        return JSONResponse(
            status_code=exc.status_code,
            content=error_payload(code, str(exc.detail)),
        )


def _format_validation(exc: RequestValidationError) -> str:
    parts = []
    for err in exc.errors():
        loc = ".".join(str(x) for x in err.get("loc", []) if x != "body")
        parts.append(f"{loc}: {err.get('msg', '')}".strip(": "))
    return "; ".join(parts) or "请求参数校验失败"

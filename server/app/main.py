"""FastAPI 入口：日志 → 中间件 → 异常处理器 → 路由。"""

from __future__ import annotations

from fastapi import FastAPI

from .logging_config import setup_logging
from .middleware import AccessLogMiddleware, AuthMiddleware, BodySizeLimitMiddleware, CatchAllMiddleware
from .responses import install_exception_handlers
from .routers import chat, export, generate, health, record, schema, upload, view

setup_logging()

app = FastAPI(title="AI 驱动 Schema 表单平台", version="0.1.0")

# add_middleware 后加者在外层：BodySizeLimit（最内）→ Auth → CatchAll → AccessLog（最外）
app.add_middleware(BodySizeLimitMiddleware)
app.add_middleware(AuthMiddleware)
app.add_middleware(CatchAllMiddleware)
app.add_middleware(AccessLogMiddleware)

install_exception_handlers(app)

app.include_router(health.router)
app.include_router(schema.router)
app.include_router(generate.router)
app.include_router(record.router)
app.include_router(export.router)
app.include_router(upload.router)
app.include_router(chat.router)
app.include_router(view.router)

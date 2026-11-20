"""中间件四件套（外→内）：AccessLog → CatchAll → Auth → BodySizeLimit。"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from .config import settings
from .responses import ErrorCode, error_payload

logger = logging.getLogger("aug.access")
error_logger = logging.getLogger("aug.error")


def _json_bytes(payload: dict) -> bytes:
    return json.dumps(payload, ensure_ascii=False).encode("utf-8")


class AccessLogMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        started = time.perf_counter()
        status_holder: dict[str, Any] = {"status": 500}

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                status_holder["status"] = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            dur = round((time.perf_counter() - started) * 1000, 2)
            logger.info(
                json.dumps(
                    {
                        "method": scope.get("method"),
                        "path": scope.get("path"),
                        "status": status_holder["status"],
                        "durationMs": dur,
                    },
                    ensure_ascii=False,
                )
            )


class CatchAllMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        response_started = False

        async def send_wrapper(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception:  # noqa: BLE001
            error_logger.exception("unhandled error: %s %s", scope.get("method"), scope.get("path"))
            if not response_started:
                body = _json_bytes(error_payload(ErrorCode.INTERNAL_ERROR, "服务器内部错误"))
                await send(
                    {
                        "type": "http.response.start",
                        "status": 500,
                        "headers": [
                            (b"content-type", b"application/json; charset=utf-8"),
                            (b"content-length", str(len(body)).encode()),
                        ],
                    }
                )
                await send({"type": "http.response.body", "body": body})


class AuthMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not settings.auth_enabled:
            await self.app(scope, receive, send)
            return
        path = scope.get("path", "")
        if not path.startswith("/api/"):
            await self.app(scope, receive, send)
            return
        headers = dict(scope.get("headers") or [])
        authorization = headers.get(b"authorization", b"").decode("latin-1")
        expected = f"Bearer {settings.auth_token}"
        if authorization != expected:
            body = _json_bytes(error_payload(ErrorCode.UNAUTHORIZED, "未授权：Bearer Token 无效"))
            await send(
                {
                    "type": "http.response.start",
                    "status": 401,
                    "headers": [
                        (b"content-type", b"application/json; charset=utf-8"),
                        (b"content-length", str(len(body)).encode()),
                    ],
                }
            )
            await send({"type": "http.response.body", "body": body})
            return
        await self.app(scope, receive, send)


class BodySizeLimitMiddleware:
    """纯 ASGI：优先 Content-Length，缺失时接收层流式累计。"""

    def __init__(self, app: ASGIApp):
        self.app = app

    def _limit_for(self, path: str) -> int:
        if path == "/api/upload":
            return settings.upload_max_body_bytes
        return settings.max_body_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        path = scope.get("path", "")
        limit = self._limit_for(path)
        headers = dict(scope.get("headers") or [])
        content_length = headers.get(b"content-length")
        if content_length:
            try:
                if int(content_length) > limit:
                    await self._reject(send)
                    return
            except ValueError:
                pass

        received = 0
        rejected = False

        async def limited_receive() -> Message:
            nonlocal received, rejected
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    rejected = True
                    raise _TooLarge()
            return message

        try:
            await self.app(scope, limited_receive, send)
        except _TooLarge:
            if not rejected:
                raise
            await self._reject(send)

    async def _reject(self, send: Send) -> None:
        body = _json_bytes(error_payload(ErrorCode.PAYLOAD_TOO_LARGE, "请求体超过大小限制"))
        await send(
            {
                "type": "http.response.start",
                "status": 413,
                "headers": [
                    (b"content-type", b"application/json; charset=utf-8"),
                    (b"content-length", str(len(body)).encode()),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})


class _TooLarge(Exception):
    pass

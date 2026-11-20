"""Webhook：提交成功后异步推送，失败退避重试 1s/4s/9s，最终失败仅日志。"""

from __future__ import annotations

import asyncio
import logging

import httpx

from ..config import settings

logger = logging.getLogger("aug.webhook")

RETRY_DELAYS = (1, 4, 9)


async def send_submit_webhook(payload: dict) -> None:
    if not settings.webhook_enabled or not settings.webhook_url:
        return
    attempts = len(RETRY_DELAYS) + 1
    for attempt in range(attempts):
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.post(settings.webhook_url, json=payload)
            if response.status_code < 300:
                logger.info("webhook delivered: recordId=%s", payload.get("recordId"))
                return
            logger.warning("webhook status=%s attempt=%s", response.status_code, attempt + 1)
        except Exception as exc:  # noqa: BLE001
            logger.warning("webhook error attempt=%s: %s", attempt + 1, exc)
        if attempt < len(RETRY_DELAYS):
            await asyncio.sleep(RETRY_DELAYS[attempt])
    logger.error("webhook failed permanently: %s", payload.get("recordId"))

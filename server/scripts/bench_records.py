"""批量压测记录提交：p50/p95/max 与错误率。

用法：
    uv run python scripts/bench_records.py --form-key bench_form --count 500 --concurrency 20
"""

from __future__ import annotations

import argparse
import asyncio
import os
import statistics
import time

import httpx

SCHEMA = {
    "formKey": "bench_form",
    "title": "压测表单",
    "columns": [
        {"dataIndex": "name", "title": "姓名", "valueType": "text"},
        {"dataIndex": "amount", "title": "金额", "valueType": "digit"},
        {
            "dataIndex": "status",
            "title": "状态",
            "valueType": "select",
            "valueEnum": {"paid": {"text": "已支付"}, "pending": {"text": "待支付"}},
        },
    ],
}


def payload(index: int) -> dict:
    return {"name": f"用户{index}", "amount": index % 1000, "status": "paid" if index % 2 else "pending"}


async def ensure_form(client: httpx.AsyncClient, form_key: str) -> None:
    response = await client.get(f"/api/form/{form_key}/schema")
    if response.status_code == 200:
        return
    schema = {**SCHEMA, "formKey": form_key}
    published = await client.post(f"/api/schema/{form_key}/publish", json=schema)
    published.raise_for_status()


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=os.getenv("API_BASE", "http://localhost:8100"))
    parser.add_argument("--form-key", default="bench_form")
    parser.add_argument("--count", type=int, default=500)
    parser.add_argument("--concurrency", type=int, default=20)
    args = parser.parse_args()

    semaphore = asyncio.Semaphore(args.concurrency)
    latencies: list[float] = []
    errors = 0

    async with httpx.AsyncClient(base_url=args.base_url, timeout=30) as client:
        await ensure_form(client, args.form_key)

        async def submit(index: int) -> None:
            nonlocal errors
            async with semaphore:
                start = time.perf_counter()
                try:
                    response = await client.post(
                        f"/api/form/{args.form_key}/submit", json=payload(index)
                    )
                    if response.status_code != 200:
                        errors += 1
                except Exception:  # noqa: BLE001
                    errors += 1
                finally:
                    latencies.append((time.perf_counter() - start) * 1000)

        started = time.perf_counter()
        await asyncio.gather(*[submit(i) for i in range(args.count)])
        elapsed = time.perf_counter() - started

    latencies.sort()
    p50 = statistics.median(latencies)
    p95 = latencies[int(len(latencies) * 0.95) - 1]
    print(f"requests={len(latencies)} errors={errors} elapsed={elapsed:.2f}s qps={len(latencies)/elapsed:.1f}")
    print(f"p50={p50:.1f}ms p95={p95:.1f}ms max={max(latencies):.1f}ms")


if __name__ == "__main__":
    asyncio.run(main())

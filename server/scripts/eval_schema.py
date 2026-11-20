"""Schema 生成质量评测：字段覆盖率 / 类型准确率 / 枚举一致率。

用法：
    uv run python scripts/eval_schema.py                 # mock（校验链路可用性）
    uv run python scripts/eval_schema.py --provider openai
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import contracts
from app.contracts import SchemaValidationError
from app.services.ai import prompt
from app.services.ai.client import LLMClient

ROOT = Path(__file__).resolve().parents[1]
PRD_DIR = ROOT / "tests" / "fixtures" / "prd"
CHAT_DIR = ROOT / "tests" / "fixtures" / "chat_modify"


def flatten(columns: list[dict], out: dict[str, dict] | None = None) -> dict[str, dict]:
    out = out if out is not None else {}
    for column in columns or []:
        if column.get("dataIndex"):
            out[column["dataIndex"]] = column
        if column.get("columns"):
            flatten(column["columns"], out)
    return out


def score(expected: dict, actual: dict) -> dict:
    exp = flatten(expected.get("columns") or [])
    act = flatten(actual.get("columns") or [])
    hit = set(exp) & set(act)
    recall = len(hit) / len(exp) if exp else 0.0
    precision = len(hit) / len(act) if act else 0.0
    type_ok = sum(1 for key in hit if exp[key].get("valueType") == act[key].get("valueType"))
    type_acc = type_ok / len(hit) if hit else 0.0
    enum_exp = {k: set((v.get("valueEnum") or {}).keys()) for k, v in exp.items() if v.get("valueEnum")}
    enum_act = {k: set((v.get("valueEnum") or {}).keys()) for k, v in act.items() if v.get("valueEnum")}
    enum_hit = 0
    enum_total = 0
    for key, keys in enum_exp.items():
        enum_total += 1
        if key in enum_act and enum_act[key] >= keys:
            enum_hit += 1
    enum_acc = enum_hit / enum_total if enum_total else 1.0
    total = 0.5 * recall + 0.3 * type_acc + 0.2 * enum_acc
    return {
        "recall": recall,
        "precision": precision,
        "typeAcc": type_acc,
        "enumAcc": enum_acc,
        "score": total,
    }


def load(name: Path) -> dict:
    return json.loads(name.read_text(encoding="utf-8"))


async def eval_generation(client: LLMClient, provider: str) -> list[dict]:
    results = []
    for prd_path in sorted(PRD_DIR.glob("case*.md")):
        case = prd_path.stem
        expected_path = prd_path.with_suffix(".expected.json")
        expected = load(expected_path)
        response = await client.complete_json(
            prompt.build_schema_system_prompt(),
            prompt.build_user_prompt(prd_path.read_text(encoding="utf-8"), expected["formKey"]),
            contracts.export_json_schema(),
        )
        try:
            schema = contracts.dump_schema(contracts.validate_schema(response))
            metrics = score(expected, schema)
            metrics["valid"] = True
        except SchemaValidationError as exc:
            metrics = {"valid": False, "score": 0.0, "error": str(exc)[:120]}
        metrics["case"] = case
        results.append(metrics)
        print(f"[gen] {case}: score={metrics.get('score', 0):.2f} {metrics}")
    return results


async def eval_chat(client: LLMClient, provider: str) -> list[dict]:
    if provider == "mock":
        print("[chat] mock provider 不做修改类评测（跳过）")
        return []
    results = []
    now = __import__("datetime").datetime.now()
    for case_path in sorted(CHAT_DIR.glob("case*.json")):
        case = load(case_path)
        system = prompt.build_chat_system_prompt(now, "", case["currentSchema"])
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": case["instruction"]},
        ]
        assistant = await client.complete_tools(
            messages,
            [tool for tool in __import__("app.services.ai.chat", fromlist=["TOOLS"]).TOOLS
             if tool["function"]["name"] == "modify_schema"],
            tool_choice={"type": "function", "function": {"name": "modify_schema"}},
        )
        schema = assistant.tool_calls[0].arguments.get("schema") if assistant.tool_calls else {}
        try:
            validated = contracts.dump_schema(contracts.validate_schema(schema))
            metrics = score(case["expected"], validated)
            metrics["valid"] = True
        except Exception as exc:  # noqa: BLE001
            metrics = {"valid": False, "score": 0.0, "error": str(exc)[:120]}
        metrics["case"] = case_path.stem
        results.append(metrics)
        print(f"[chat] {case_path.stem}: score={metrics.get('score', 0):.2f} {metrics}")
    return results


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--provider", default=None, help="mock | openai（默认读 .env）")
    parser.add_argument("--only", choices=["gen", "chat"], default=None)
    args = parser.parse_args()
    client = LLMClient(provider=args.provider)
    provider = client.provider
    print(f"provider={provider}")
    results: list[dict] = []
    if args.only in (None, "gen"):
        results += await eval_generation(client, provider)
    if args.only in (None, "chat"):
        results += await eval_chat(client, provider)
    if results:
        avg = sum(item.get("score", 0) for item in results) / len(results)
        valid = sum(1 for item in results if item.get("valid"))
        print(f"\n汇总：cases={len(results)} 合法={valid} 平均分={avg:.3f}")


if __name__ == "__main__":
    asyncio.run(main())

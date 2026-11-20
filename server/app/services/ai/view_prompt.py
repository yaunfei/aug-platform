"""视图映射生成的 Prompt 构建。"""

from __future__ import annotations

import json

DSL_TYPES = """- string：转字符串
- long：转整数
- double：转浮点数
- decimal：小数（可带 scale，四舍五入）
- boolean：转布尔
- datetime：日期时间（可带 format，Java 风格如 yyyy-MM-dd HH:mm:ss；默认保持 ISO-8601）
- enum：枚举翻译（enumMap: {key: 展示文本}，enumDefault 可选）
- array：数组（itemMappings 逐项转换，from 相对 item，递归深度 ≤2）
- const：固定值（value）"""

FEW_SHOT = {
    "viewKey": "crm_order_v2",
    "title": "CRM 订单接口 v2",
    "formKey": "order_form",
    "description": "对齐 CRM 开放平台《订单查询接口》v2",
    "mappings": [
        {"from": "$.id", "to": "recordId", "type": "long"},
        {"from": "$.data.customer_name", "to": "buyer.name", "type": "string"},
        {"from": "$.data.amount", "to": "payment.amount", "type": "decimal", "scale": 2},
        {
            "from": "$.data.status",
            "to": "orderStatus",
            "type": "enum",
            "enumMap": {"pending": "待支付", "paid": "已支付"},
            "enumDefault": "未知",
        },
        {"from": "$.data.apply_range[0]", "to": "applyStartDate", "type": "string"},
        {"from": "$.data.apply_range[1]", "to": "applyEndDate", "type": "string"},
        {"from": "$.createdAt", "to": "createTime", "type": "datetime", "format": "yyyy-MM-dd HH:mm:ss"},
        {
            "from": "$.data.contacts",
            "to": "contacts",
            "type": "array",
            "itemMappings": [
                {"from": "$.name", "to": "contactName", "type": "string"},
                {"from": "$.phone", "to": "mobile", "type": "string"},
            ],
        },
        {"to": "source", "type": "const", "value": "aug-platform"},
    ],
}


def build_view_system_prompt() -> str:
    return f"""你是下游接口对接专家。你的任务是把「下游接口文档」编译为平台的 View Mapping DSL 配置，供确定性转换引擎在运行时把表单记录转换为下游目标格式。

DSL 结构：
{{
  "viewKey": string, "title": string, "formKey": string, "description"?: string,
  "mappings": [{{ "from"?: JsonPath, "to": string, "type": string, ... }}]
}}

类型表：
{DSL_TYPES}

完整示例：
{json.dumps(FEW_SHOT, ensure_ascii=False, indent=2)}

硬约束：
1. 只输出一个 JSON 对象，不要解释或 Markdown 围栏。
2. 每个目标字段必须有 from 或 const。
3. 禁止臆造源字段：from 只能取「源字段目录」中的 path（含 [i] 数组下标形式），不得自创 dataIndex。
4. enumMap 的 key 必须来自该字段 valueEnum 的 key，value 使用对应 text。
5. to 路径不得重复、不得前缀冲突（例如 a.b 与 a.b.c 不能共存）。
6. dateRange 字段按 [0]/[1] 拆成两个目标字段。
7. formList 数组目标用 "type": "array" + itemMappings，itemMappings 内的 from 相对 item（写 $.childDataIndex）。
8. group 子字段数据扁平存储，直接取 $.data.<childDataIndex>。
9. 未映射的源字段会被丢弃，这是契约的一部分；确需透传时显式映射。
"""


def build_view_user_prompt(form_key: str, catalog: list[dict], doc_text: str) -> str:
    return f"""表单 formKey：{form_key}

<源字段目录>
{json.dumps(catalog, ensure_ascii=False, indent=2)}
</源字段目录>

<接口文档>
{doc_text}
</接口文档>

请输出 View Mapping DSL JSON。"""


def build_view_retry_prompt(base: str, error: str) -> str:
    return f"{base}\n\n上一次输出未通过校验，错误信息：{error}，请修正后重新输出，只输出 JSON。"

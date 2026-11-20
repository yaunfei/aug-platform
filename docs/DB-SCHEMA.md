# 数据库设计

生产数据库为 PostgreSQL 12+；测试使用 SQLite（`aiosqlite`）。ORM 通过 `JSON().with_variant(JSONB, "postgresql")` 与 `BigInteger().with_variant(Integer, "sqlite")` 双适配。

## 迁移链

| 版本 | 内容 |
| --- | --- |
| `0001` | `form_schema`、`form_record` 及索引 |
| `0002` | `chat_session` |
| `0003` | `view_config` 及索引 |
| `0004` | `pg_trgm` 扩展与 `data` 文本 GIN 表达式索引 |

```bash
cd server && uv run alembic upgrade head
```

## form_schema

| 列 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | bigserial | PK | |
| form_key | varchar(64) | not null | 业务表单标识 |
| version | int | not null | 从 1 递增 |
| schema_json | jsonb | not null | 完整 FormSchema |
| status | varchar(20) | not null, default `published` | |
| created_at | timestamptz | not null, default now() | |

- 唯一：`(form_key, version)`
- 索引：`idx_form_schema_key (form_key)`
- 发布：同一 formKey 取 `max(version)+1`；回滚复制历史 `schema_json` 前滚为新版本，不改写历史。

`schema_json` 结构：

```json
{
  "formKey": "order_form",
  "title": "订单登记",
  "description": "可选",
  "columns": [
    {
      "dataIndex": "amount",
      "title": "金额",
      "valueType": "money",
      "formItemProps": { "rules": [{ "required": true, "message": "必填" }] },
      "valueEnum": { "p0": { "text": "P0" } },
      "hideInForm": false,
      "columns": []
    }
  ]
}
```

## form_record

| 列 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | bigserial | PK | |
| form_key | varchar(64) | not null | |
| schema_version | int | not null | 提交时固化的 Schema 版本 |
| data | jsonb | not null | 字段值（group 扁平、formList 对象数组） |
| created_by | varchar(64) | null | 预留 |
| created_at | timestamptz | not null | |
| updated_at | timestamptz | not null | |

- 索引：`idx_form_record_key_created (form_key, created_at DESC)`
- 关键词索引：`idx_form_record_data_trgm USING gin ((data::text) gin_trgm_ops)`
- 更新为全量覆盖 `data`，不修改 `schema_version`（保证历史渲染一致）。
- 查询条件：
  - 等值/布尔：PG 用 `data @> jsonb_build_object(...)`；SQLite 用 `json_extract`
  - 文本：`data->>field ILIKE`
  - 关键词：`cast(data AS text) ILIKE '%kw%'`，≥3 字
  - 分页 `pageSize` 上限 200

## chat_session

| 列 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | bigserial | PK | |
| session_key | varchar(64) | unique, not null | 前端生成 |
| messages | jsonb | not null, default `[]` | 完整消息数组 |
| schema_json | text | not null, default `''` | 当前草稿（字符串） |
| created_at / updated_at | timestamptz | not null | |

会话 key 规则：`^[a-z][a-z0-9_]{1,63}$`；`__draft__` 兼容保留。保存为幂等 upsert；列表按 `updated_at DESC`。

`messages` 元素：

```json
{
  "role": "user | assistant",
  "content": "文本",
  "intent": "modify",
  "schema": {},
  "proposedSchema": {},
  "action": { "type": "publish", "formKey": "order_form" },
  "sampleData": [],
  "warnings": [],
  "suggestions": []
}
```

服务端仅按原样存储，不参与 Schema 校验。

## view_config

| 列 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | bigserial | PK | |
| view_key | varchar(64) | not null | |
| version | int | not null | 同 form_schema 语义 |
| form_key | varchar(64) | not null | 数据来源 |
| title | varchar(128) | not null | |
| description | text | not null, default `''` | |
| mapping_json | jsonb | not null | 完整 ViewConfig |
| status | varchar(20) | not null | |
| created_at / updated_at | timestamptz | not null | |

- 唯一：`(view_key, version)`
- 索引：`idx_view_config_key (view_key)`

`mapping_json` 结构：

```json
{
  "viewKey": "order_view",
  "title": "订单下游视图",
  "formKey": "order_form",
  "description": "",
  "mappings": [
    { "from": "$.data.amount", "to": "payAmount", "type": "decimal", "scale": 2 },
    { "from": "$.data.status", "to": "status", "type": "enum",
      "enumMap": { "pending": "WAIT" }, "enumDefault": "UNKNOWN" },
    { "from": "$.data.items", "to": "lines", "type": "array",
      "itemMappings": [{ "from": "$.sku", "to": "skuCode", "type": "string" }] }
  ]
}
```

## 数据生命周期

- `DELETE /api/schema/{form_key}`：删除全部 Schema 版本与全部记录（会话不级联）
- `DELETE /api/form/{form_key}/records/{id}`：仅删记录
- 上传文件与数据库解耦，存 `server/uploads`（可替换对象存储）

# API 契约

所有业务接口以 `/api` 为前缀；健康检查为 `/health`。默认 JSON，UTF-8。

## 统一响应包

成功：

```json
{ "success": true, "data": {} }
```

分页额外返回 `total` / `current` / `pageSize`：

```json
{ "success": true, "data": [], "total": 0, "current": 1, "pageSize": 20 }
```

失败：

```json
{ "success": false, "errorCode": "SCHEMA_INVALID", "errorMessage": "columns 第 1 项缺少 dataIndex" }
```

## 错误码

| errorCode | HTTP | 说明 |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | 参数/JSON 非法 |
| `SCHEMA_INVALID` | 400 | 表单 Schema 契约校验失败 |
| `UNAUTHORIZED` | 401 | Token 缺失或错误 |
| `SCHEMA_NOT_FOUND` | 404 | formKey 或版本不存在 |
| `RECORD_NOT_FOUND` | 404 | 记录不存在 |
| `PAYLOAD_TOO_LARGE` | 413 | 请求体超限 |
| `AI_GENERATE_FAILED` | 502 | 模型多次重试仍不可用 |
| `VIEW_NOT_FOUND` | 404 | viewKey 或版本不存在 |
| `VIEW_CONFIG_INVALID` | 400 | 视图映射契约校验失败 |
| `VIEW_MAPPING_ERROR` | 500 | 运行时 JsonPath/类型转换失败 |
| `INTERNAL_ERROR` | 500 | 未捕获异常 |

鉴权开启后，`/api/*` 需要 `Authorization: Bearer <AUTH_TOKEN>`；`/health` 与上传文件下载仍走 `/api`（需鉴权）。

## Schema

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/schema/components` | 组件注册表公开字段 |
| GET | `/api/schema?formKey=&title=&startTime=&endTime=` | 各 formKey 最新版本列表 |
| POST | `/api/schema/{form_key}/publish` | 发布 Schema（body 为完整 Schema） |
| GET | `/api/schema/{form_key}/versions` | 版本历史（倒序） |
| POST | `/api/schema/{form_key}/rollback` | body `{ "version": 2 }`，前滚发布 |
| DELETE | `/api/schema/{form_key}` | 级联删除全部版本与记录 |
| POST | `/api/schema/generate` | body `{ "prdText": "...", "formKeyHint": "..." }`，不落库 |
| GET | `/api/form/{form_key}/schema?version=` | 获取指定/最新版本 |

发布校验规则（节选）：`formKey` 正则、`columns` 非空、`dataIndex` 全局命名空间唯一（group 共享、formList 独立）、布局不可嵌套、总列数 ≤80、序列化 ≤256KB、`pattern` 可编译、枚举组件必须有 `valueEnum`、函数字段禁止。

## 记录

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/form/{form_key}/submit` | body 为字段对象；记录固化当前 schemaVersion |
| GET | `/api/form/{form_key}/records?current=&pageSize=&startTime=&endTime=&keyword=&filters=` | 分页查询，`pageSize` 上限 200 |
| GET | `/api/form/{form_key}/records/{id}` | 详情（含记录 version） |
| PUT | `/api/form/{form_key}/records/{id}` | 全量更新 data |
| DELETE | `/api/form/{form_key}/records/{id}` | 删除 |
| GET | `/api/form/{form_key}/export?...` | CSV 流式导出（UTF-8 BOM） |

`filters` 为 JSON 字符串，例如 `{"level":"p0","urgent":true}`；解析失败返回 `VALIDATION_ERROR`。关键词 ≥3 字走索引（生产 PG 使用 pg_trgm GIN）。

## 对话助手

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/assistant/chat` | body `{ messages, currentSchema? }`，一次性返回 |
| POST | `/api/assistant/chat/stream` | 同上，SSE |
| GET | `/api/assistant/sessions` | 会话列表 |
| GET | `/api/assistant/sessions/{key}` | 会话详情 |
| PUT | `/api/assistant/sessions/{key}` | body `{ messages, schemaJson }`，upsert |
| DELETE | `/api/assistant/sessions/{key}` | 删除（幂等） |

对话结果：

```json
{
  "intent": "modify",
  "reply": "已为订单表单新增「期望送达时间」字段。",
  "schema": { "formKey": "order_form", "title": "订单", "columns": [] },
  "action": { "type": "publish", "formKey": "order_form" },
  "sampleData": [{}],
  "suggestions": ["再增加一个备注字段"],
  "warnings": []
}
```

`intent` ∈ `generate | modify | review | sample_data | action | reply`。`action.type` ∈ `delete | publish | rollback | export`。前端必须先展示确认卡片，用户确认后才调用对应 REST。

### SSE 帧格式

每帧 `data: {json}\n\n`，事件类型：

| type | 字段 | 含义 |
| --- | --- | --- |
| `delta` | `text` / `content` | 增量文本 |
| `stage` | `message` / `text` | 阶段提示 |
| `reset` | — | 清空已输出内容 |
| `final` | `data` | 最终完整响应（结构同上） |
| `error` | `errorCode` / `message` | 流内错误 |

Nginx 必须对 `/api/` 关闭 `proxy_buffering`。

## 上传

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/upload` | multipart `file`，png/jpg/jpeg/webp/pag，≤5MB |
| GET | `/api/uploads/{filename}` | 下载/预览 |

## 视图映射

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/view/generate` | body `{ "docText": "...", "formKey": "..." }`，返回映射草案 |
| GET | `/api/view?formKey=` | 各 viewKey 最新版本 |
| POST | `/api/view/{view_key}/publish` | body 为完整 ViewConfig |
| GET | `/api/view/{view_key}` | 最新版本 |
| GET | `/api/view/{view_key}/versions` | 版本历史 |
| POST | `/api/view/{view_key}/rollback` | body `{ "version": 1 }`，前滚 |
| POST | `/api/view/{view_key}/test` | body `{ "recordId": 1 }` 或 `{ "sampleData": {...} }` |
| DELETE | `/api/view/{view_key}` | 删除全部版本 |

返回：`{ "transformed": {}, "warnings": [], "input": {} }`。缺失字段按 `MISSING` 语义直接省略；枚举未命中输出 `enumDefault` 并产生告警。

## 中间件顺序

请求进入顺序：`AccessLog → CatchAll → Auth → BodySizeLimit`。CatchAll 保证任何异常都返回统一 JSON；AccessLog 输出 method/path/status/耗时。

## 契约资产

- `docs/contracts/form-schema.schema.json`：由后端导出，含 `valueType` 枚举
- `docs/contracts/view-mapping.schema.json`：视图映射 DSL
- `server/app/component_registry.json`：50 个组件，prompt 与前端白名单同源

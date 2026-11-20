# AI 驱动 Schema 表单平台

以「组件注册表」为单一事实来源，用 AI 对话生成 / 修改表单 Schema，并即时产出动态表单、查询列表、导出与下游视图映射。后端 FastAPI + PostgreSQL，前端 UmiJS Max + Ant Design ProComponents，另附 Java Dubbo 下游适配示例。

## 核心能力

- **AI 生成 Schema**：PRD → 合法 Schema（组件注册表驱动 prompt / JSON Schema / 契约校验）
- **对话式修改**：7 个工具（查表单、查记录、样例数据、发布/删除/回滚提议等）+ SSE 流式 + 会话持久化
- **动态渲染**：同一份 columns 驱动表单、表格、查询条件、详情；自定义组件（手机号/图片/PAG/附件/人群）注入式渲染
- **可视化编辑**：dnd-kit 多容器拖拽、撤销重做、字段编辑、实时预览
- **契约严谨**：命名空间、布局嵌套、总列数、pattern、枚举、256KB 体积等后端强校验，前端轻校验兜底
- **视图映射 DSL**：JsonPath 子集、类型转换、enum fallback、数组 itemMappings、前缀冲突检测、AI 生成 + 试跑 + 发布回滚
- **工程化**：统一响应包、鉴权/日志/体积中间件、Alembic 迁移、Docker Compose、pytest + vitest

## 目录结构

```
.
├── server/                 FastAPI 应用
│   ├── app/
│   │   ├── component_registry.json   # 50 个组件（单一事实来源）
│   │   ├── contracts.py              # Schema 契约校验
│   │   ├── view_contracts.py         # 视图映射契约校验
│   │   ├── services/ai/              # LLM 客户端 / 生成 / 对话 / 视图映射
│   │   ├── routers/                  # schema / record / chat / view / upload ...
│   │   ├── repositories/             # 数据访问
│   │   └── middleware.py             # 日志 / 兜底 / 鉴权 / 体积
│   ├── migrations/         Alembic 迁移（0001~0004）
│   ├── scripts/            eval_schema.py / bench_records.py
│   └── tests/              134 项 pytest（契约/API/e2e/视图）
├── web/                    UmiJS Max 前端
│   └── src/
│       ├── components/     动态渲染 / 对话 / 可视化编辑
│       ├── pages/          SchemaGenerate / SchemaList / DynamicForm / ViewList
│       ├── services/api.ts 统一 API 层 + SSE 消费
│       └── utils/          hydrateColumns / jsonDiff / summarizeSchemaDiff ...
├── java-provider/          Spring Boot + Dubbo 3 视图分发示例
├── docs/                   契约 / 数据库 / 使用手册 / 路线图
├── deploy/nginx.conf
├── docker-compose.yml
└── Makefile
```

## 快速开始

### 本地开发

```bash
cp .env.example .env
make install          # uv sync + pnpm install
make init-db          # 创建数据库与 pg_trgm（需本机 PostgreSQL）
make migrate
make dev              # 后端 :8100，前端 :8000
```

前端默认代理 `/api` 到 `http://127.0.0.1:8100`。打开 `http://localhost:8000`：

- `/schema-generate` AI 对话生成 / 修改 / 发布
- `/schema-list` Schema 版本管理
- `/form/:formKey` 动态表单 + 查询 + 导出
- `/views` 视图映射生成与测试

### Docker

```bash
docker compose up --build
# 前端 http://localhost:8080 ，后端 http://localhost:8100
```

### 无 PostgreSQL 时跑测试

测试使用 SQLite（`aiosqlite`），无需外部数据库：

```bash
make test             # pytest + vitest + tsc
```

### Dubbo 分发（可选）

`java-provider/` 提供只读 Dubbo 分发与视图映射示例（Spring Boot 3 + Dubbo 3 + MyBatis）：

```bash
make java-test        # 55 项 JUnit（含 12 组共享 fixtures）
make java-build       # 打包 Provider / Consumer 可执行 jar
make java-run         # Provider，Dubbo :20880
make consumer-run     # Consumer Demo，HTTP :8180
```

需要 PostgreSQL 与 ZooKeeper。详细契约、`DUBBO_IP_TO_REGISTRY` 逃生舱与排障见
[docs/dubbo-spike.md](docs/dubbo-spike.md)。

## 配置

见 [.env.example](.env.example)。关键项：

| 变量 | 说明 |
| --- | --- |
| `AI_PROVIDER` | `mock`（默认，无外部依赖）/ `openai` |
| `AI_BASE_URL` `AI_API_KEY` `AI_MODEL` | OpenAI 兼容端点 |
| `AUTH_ENABLED` `AUTH_TOKEN` | 仅 `/api/` 生效，Bearer Token |
| `MAX_BODY_BYTES` / `UPLOAD_MAX_BODY_BYTES` | 1MB / 6MB |
| `WEBHOOK_ENABLED` `WEBHOOK_URL` | 提交后异步回调（1s/4s/9s 退避） |
| `LOG_FILE` | 留空仅控制台；配置后 10MB×5 轮转 |

## AI 三链路降级

`json_schema` → `function_calling` → `prompt_json`，逐级回退并对网络/5xx 指数退避（1s/2s）。契约校验失败会把错误回灌给模型重试，最多 `AI_MAX_RETRY` 次。`mock` 模式用于离线联调与评测。

## 测试与评测

```bash
cd server && uv run pytest -q          # 134 passed
cd web && pnpm test && pnpm tsc        # 工具函数单测 + 类型检查
cd java-provider && mvn test           # 55 passed（Dubbo 分发 + 视图映射）
cd server && uv run python scripts/eval_schema.py   # 生成/修改评测
cd server && uv run python scripts/bench_records.py # 查询压测（需已发布 schema）
```

## 文档

- [API 契约](docs/API-CONTRACT.md)
- [数据库设计](docs/DB-SCHEMA.md)
- [使用手册](docs/USER-GUIDE.md)
- [Dubbo 分发与视图映射](docs/dubbo-spike.md)
- [路线图](docs/ROADMAP.md)
- [Form Schema JSON Schema](docs/contracts/form-schema.schema.json)
- [视图映射 JSON Schema](docs/contracts/view-mapping.schema.json)

## 已知边界

- 生产需 PostgreSQL 12+；SQLite 仅为测试适配
- 上传文件存本地 `server/uploads`，生产建议替换为对象存储
- 视图分发以 Java 示例模块演示，真实下游协议需按需扩展
- `mock` 模式的生成结果为固定样例，评测分数仅验证链路而非模型质量

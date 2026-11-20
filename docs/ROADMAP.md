# 路线图与验收

## 阶段一：后端骨架与契约（已完成）

- FastAPI 应用、配置、日志、统一响应、四件套中间件
- 4 张表 + 4 个 Alembic 迁移
- 组件注册表 50 项，作为 prompt / JSON Schema / 前端白名单单一事实来源
- Schema 契约校验 + JSON Schema 导出

## 阶段二：业务与 AI（已完成）

- Schema 发布/版本/回滚/级联删除
- 记录提交/查询/详情/更新/删除/导出
- LLM 三链路降级 + 重试；生成失败回灌重试
- 对话助手 7 工具 + SSE + 双层上下文 + 会话持久化
- 视图映射 DSL 校验、生成、试跑、版本
- pytest 134 项通过（含 e2e）

## 阶段三：前端动态渲染（已完成）

- hydrateColumns 动态管线（布局/自定义/数值规则/操作列）
- DynamicFormDrawer / RecordDetailDrawer / VersionDrawer / DynamicListPage
- SchemaList、DynamicForm 页面、错误边界
- vitest：hydrateColumns / jsonDiff / summarizeSchemaDiff / validateSchema / chatMessages / columnTreeUtils

## 阶段四：对话与可视化（已完成）

- SchemaGenerate：SSE 消费、applyResponse、diff 摘要、会话侧栏与持久化
- 消息 Markdown + DOMPurify、样例数据、操作确认卡片
- VisualEditor：dnd-kit 多容器拖拽、撤销重做、字段编辑、实时预览
- JSON 直编、预览抽屉、旧 localStorage 迁移

## 阶段五：部署与文档（已完成）

- `.env.example`、Makefile、docker-compose、Nginx、前后端 Dockerfile
- README、API 契约、数据库设计、使用手册、路线图

## 阶段六：视图分发（已完成）

- ViewList 页面：表单选择、文档生成映射、结构化/JSON 编辑、试跑、发布、版本回滚
- Java provider：Spring Boot + Dubbo 3 + MyBatis + ZooKeeper 示例，复用 DSL 语义

## 验收清单

```bash
cd server && uv run pytest -q          # 期望 134 passed
cd web && pnpm test                    # 工具函数单测
cd web && pnpm tsc                     # 类型检查
cd web && pnpm build                   # 生产构建
cd java-provider && mvn test           # 映射转换与 Dubbo 服务测试
docker compose up --build              # 全栈启动
```

## 后续可扩展

- 上传存储对象化（S3/OSS）与图片 CDN
- 记录级权限与操作审计
- AI 工具调用并发化与缓存命中率指标
- 视图映射发布前自动 diff 下游契约
- 多语言（i18n）与暗色主题

# 使用手册

## 1. 生成表单

1. 打开「AI 对话生成」。
2. 输入需求，例如：`生成一个客户投诉表单，包含客户姓名、手机号、投诉类型、详细描述、截图、发生时间、是否紧急`。
3. 助手返回 Schema 后会自动应用为草稿，消息内展示变更摘要。
4. 等待流式输出时可点「停止」；失败会保留错误消息可重试。

生成结果受组件注册表约束：枚举组件必须带选项、布局不可嵌套、字段命名符合正则、总列数 ≤80。

## 2. 修改与操作

对话示例：

- `把「详细描述」改成多行文本并设为必填`
- `增加明细列表，包含 SKU、数量、单价`
- `删除 phone 字段`
- `生成 5 条样例数据`
- `审查当前草稿`

意图说明：

| intent | 前端行为 |
| --- | --- |
| `generate` / `modify` | 自动替换草稿，展示 diff 摘要 |
| `review` | 若带 Schema 显示「提案，待采纳」 |
| `sample_data` | 表格展示样例数据 |
| `action` | 显示确认卡片，用户确认后才执行发布/删除/回滚/导出 |
| `reply` | 纯文本回答 |

## 3. 草稿编辑

- **可视化**：拖拽排序、跨容器移动、添加/编辑/删除字段、撤销重做（Cmd/Ctrl+Z、Shift+Cmd/Ctrl+Z）、右侧实时预览。容器（group/formList）只能在顶层。
- **JSON 直编**：高级用户可直接修改草稿 JSON；保存前做前端轻校验，发布时后端强校验。
- **预览**：打开 DynamicFormDrawer 校验单个表单的必填/pattern 等规则。

## 4. 发布与版本

点击「发布」会展示与上次发布版本的字段级差异摘要，确认后生成新版本。版本抽屉支持：

- 查看任意版本 JSON
- 两个版本行级 diff（红绿高亮）
- 回滚：把历史版本内容前滚发布为新版本，不改写历史

## 5. 动态表单页

进入 `/form/{formKey}`：

- 表格由 Schema 驱动：枚举显示文本、日期区间显示「起 ~ 止」、明细列表显示条数
- 查询表单来自 columns（`hideInSearch` 控制），关键词 ≥3 字走索引
- 新增/编辑/预览三模式抽屉；编辑按当前 Schema 回填
- 详情按记录提交时的 `schemaVersion` 拉历史 Schema 渲染
- 导出 CSV（UTF-8 BOM，枚举转文本，日期区间拆分，最多 5 万行）

## 6. 视图映射

1. 选择来源表单。
2. 粘贴下游文档或接口说明，点「AI 生成映射」。
3. 在结构化表格中调整 `from`（JsonPath）、`to`、`type`；高级字段（enumMap、scale、format、itemMappings）可在 JSON 页编辑。
4. 在「测试结果」输入记录 ID 或样例数据 JSON，点「执行测试」。
5. 测试通过后「发布」按钮点亮；发布后可查看版本并回滚。

映射语义：

- `from` 以 `$.data.` 开头，数组元素用 `$.data.items[0].sku`
- 缺失字段按 `MISSING` 语义省略，不输出 null
- 枚举未命中输出 `enumDefault`，并产生形如 `recordId=1 path=orderStatus raw=pending output=未知（enumDefault fallback）` 的告警
- `decimal` 使用 HALF_UP；`datetime` 支持 Java `SimpleDateFormat` 常用模式

## 7. 会话管理

左侧会话栏支持新建、切换、删除。会话 800ms 防抖自动保存到后端；刷新页面后可从列表恢复消息与草稿。超过 10 万字符自动截断最旧消息，并保证以 user 消息开头。

## 8. 鉴权

后端开启 `AUTH_ENABLED=true` 后，点击右上角「API Token」填入 `AUTH_TOKEN`，请求会自动携带 `Authorization: Bearer`。

## 9. 常见问题

| 现象 | 排查 |
| --- | --- |
| 页面空白 | 检查后端 `/health`；打开控制台查看 Schema 校验错误 |
| 发布 400 | 按 `errorMessage` 修正 dataIndex 重复/枚举缺失/布局嵌套 |
| 流式无输出 | Nginx 需对 `/api/` 关闭 `proxy_buffering` |
| 关键词搜索慢 | 确认已执行迁移 `0004` 且 PostgreSQL 安装 pg_trgm |
| 导出为空 | 确认查询条件与时间范围；导出上限 5 万行 |

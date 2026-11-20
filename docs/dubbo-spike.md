# Dubbo 分发服务（record-provider）技术验证与落地说明

> 对应规格 §8 / §8.1 / §11 阶段六。代码位于 `java-provider/`。

## 1. 目标与边界

- 下游通过 Dubbo 只读分发表单记录，**不感知业务字段**：`data` 以 JSON 字符串透传。
- 可选 `viewKey`：按 `view_config` 中已发布的映射 DSL，把记录转换成下游接口文档要求的目标格式。
- Provider **只读** PostgreSQL（Hikari `read-only=true`），写操作永远留在 FastAPI 侧。
- 永不向 Consumer 抛业务异常：所有错误封装为 `Result{success:false,errorCode,errorMessage}`。
- **不破坏原则**：`viewKey` 为空时输出与改造前逐字节一致；新增 `getDetail(formKey, recordId, viewKey)` 重载，不改 2 参签名。

## 2. 模块结构

```
java-provider/
├── pom.xml                      # 父 pom：Spring Boot 3.2.5 / Dubbo 3.2.14 / MyBatis 3.0.3
├── record-api/                  # 契约 jar：JDK 8 字节码 + 零第三方依赖
│   └── com.aug.record.api       # Result / RecordQuery / DTO / RecordFacade / ErrorCodes
├── record-provider-app/         # Provider：只读 SQL + 视图转换引擎
│   ├── mapper/                  # RecordMapper / ViewConfigMapper（MyBatis XML）
│   ├── query/                   # QueryValidator（clamp / filters / ISO 时间）
│   ├── service/RecordServiceImpl# @DubboService 实现
│   └── view/                    # ViewConfigParser / ViewTransformer / ViewConfigRepository
└── record-consumer-demo/        # HTTP → Dubbo 模拟下游（:8180）
```

### 为什么 record-api 必须零依赖 + JDK 8

Dubbo 2.x 老 Consumer 可能停留在 JDK 8。若 api jar 携带 Jackson / json-path / Lombok，会在下游引发版本冲突甚至 `UnsupportedClassVersionError`。因此：

- `record-api` 只有 JDK 标准库，`maven-compiler-plugin` 固定 `<release>8</release>`；
- DTO 全部 `implements Serializable` + 显式 `serialVersionUID` + 无参构造（hessian2 要求）；
- JsonPath 仅出现在 `record-provider-app`，由 Provider 侧解析配置。

## 3. 契约

```java
public interface RecordFacade {
    Result<RecordPageDTO> listRecords(RecordQuery query);
    Result<RecordDetailDTO> getDetail(String formKey, long recordId);
    Result<RecordDetailDTO> getDetail(String formKey, long recordId, String viewKey);
}
```

`RecordQuery` 字段：`formKey / current / pageSize / startTime / endTime / keyword / filters / viewKey`。

查询语义与 REST 侧逐条对齐：

- 时间闭区间 `created_at >= startTime AND created_at <= endTime`；
- keyword：`CAST(data AS TEXT) ILIKE '%kw%'`（与 pg_trgm GIN 表达式索引同形状）；
- filters：JSON 对象字符串，≤20 字段；字符串 `data->>field ILIKE`，数字/布尔 `data @> jsonb_build_object(...)`；空串跳过；
- 排序恒定 `created_at DESC, id DESC`；pageSize clamp `[1,200]`，current 最小 1。

## 4. 视图映射引擎（§8.1）

### 4.1 类型与语义

| type | 输入示例 | 输出 | 边界 |
| --- | --- | --- | --- |
| `string` | `true` / `1.5` / `null` | `"true"` / `"1.5"` / `""` | JSON 布尔小写 |
| `long` | `true` / `42.9` | `1` / `42` | 布尔转 1/0，浮点截断 |
| `double` | `"3.14"` | `3.14` | — |
| `decimal` | `99.987` + `scale:2` | `99.99` | `BigDecimal` HALF_UP |
| `boolean` | `"yes"` / `1` | `true` | 字符串接受 true/1/yes |
| `datetime` | `2026-07-01T12:00:00Z` | 无 format → `...Z`；有 format → UTC 格式化 | 无时区按 UTC |
| `enum` | `enumMap` 命中 | 映射值 | 未命中 + `enumDefault` → fallback 并写 warning；否则省略 |
| `array` | 数组 | 逐项 `itemMappings` | 非数组 → 省略；嵌套深度 ≤2 |
| `const` | `value` | 原值 | 必须显式提供 `value`（允许 null） |

- 路径：JsonPath 子集（`$`、`.key`、`[n]`），`from` 必须可编译；
- `to`：点分标识符路径，禁止重复、禁止前缀冲突（如 `a` 与 `a.b`）；
- 未命中 / 非数组 / enum 无默认值 → **字段省略**，不输出 null；
- 单条记录任意映射失败 → 整页返回 `VIEW_MAPPING_ERROR`，不静默降级；错误信息包含 `viewKey / recordId / path`。

### 4.2 校验分工

- Python 发布时校验（REST `VIEW_CONFIG_INVALID`）；
- Provider **独立再校验**（`ViewConfigParser`），防止绕过 REST 入库的脏配置在运行时爆炸；
- `ViewConfigRepository` 30s TTL 缓存解析结果；缺失也缓存，避免穿透。

### 4.3 对齐基准

`docs/contracts/view_cases/case01~case12` 是 Python / Java 两侧共享的唯一事实来源。Java 单测直接读取这些 fixture：

- case09 前缀冲突 → 必须 `VIEW_CONFIG_INVALID` 且信息含「前缀冲突」；
- case10 两层数组 → 转换成功；
- case12 历史 enum 不一致 → `enumDefault` fallback + warning。

## 5. 配置与运行

### 5.1 依赖

- ZooKeeper（注册中心 + 元数据中心，`register-mode: all` 同时做接口级/应用级注册，兼容 Dubbo 2.x Consumer）；
- PostgreSQL（复用后端同一实例，Provider 只读）。

关键 `application.yml`：

```yaml
dubbo:
  registry:
    address: zookeeper://${ZK_HOST:127.0.0.1}:${ZK_PORT:2181}
    register-mode: all
  protocol:
    name: dubbo
    serialization: hessian2
    port: 20880
  metadata-report:
    address: zookeeper://${ZK_HOST:127.0.0.1}:${ZK_PORT:2181}
```

数据库连接使用 `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD`，与根 `.env` 同名。

### 5.2 启动

```bash
make java-build                       # 打 Provider / Consumer 可执行 jar
make java-run                         # Provider，Dubbo :20880
make consumer-run                     # Consumer Demo，HTTP :8180
```

或开发态：

```bash
cd java-provider/record-provider-app && mvn spring-boot:run
cd java-provider/record-consumer-demo && mvn spring-boot:run
```

### 5.3 冒烟

```bash
curl 'http://127.0.0.1:8180/demo/records?formKey=order_form&current=1&pageSize=10'
curl 'http://127.0.0.1:8180/demo/records?formKey=order_form&viewKey=erp_order'
curl 'http://127.0.0.1:8180/demo/detail/1?formKey=order_form&viewKey=erp_order'
```

需要真实 ZK / Provider 的集成测试默认不跑：

```bash
RUN_DUBBO_IT=true mvn -pl record-consumer-demo test -Dtest=RecordFacadeSmokeIT
```

## 6. 单测与验收

```bash
cd java-provider && mvn test
# Tests run: 55, Failures: 0, Errors: 0, Skipped: 0
```

覆盖：

- 12 组共享 fixtures（含错误用例 case09）；
- Parser 契约：非法 JSON / 非法 to / type 白名单 / enumMap 非空 / 数组深度 / const value / >100 条 / >64KB；
- QueryValidator：分页 clamp、viewKey/formKey 正则、filters 拆分与上限、ISO 时间；
- Repository：TTL 缓存、缺失缓存、invalidate、非法配置；
- Service：无 viewKey 逐字节透传、有 viewKey 转换、VIEW_NOT_FOUND、VIEW_CONFIG_INVALID、VIEW_MAPPING_ERROR 上下文、详情 2/3 参重载；
- `record-api` 字节码为 `major version 52`（JDK 8），依赖树为空。

## 7. 已知坑与逃生舱

1. **Provider 注册到不可达虚拟网卡**  
   症状：Consumer 全量超时/500，Provider 无请求日志。  
   处理：用真实网卡 IP 重启 Provider：`export DUBBO_IP_TO_REGISTRY=<真实网卡IP>`。  
   **禁止**设置为 `127.0.0.1`（跨机 Consumer 必然不可达）。

2. **只做应用级注册**  
   Dubbo 3 默认应用级注册，Dubbo 2.x Consumer 无法发现。必须 `register-mode: all`。

3. **忘记 hessian2**  
   Consumer 使用 Dubbo 2.x 时，协议 `serialization` 必须显式 `hessian2`。

4. **配置缓存**  
   发布/回滚后最多 30 秒生效；需要立刻生效时重启 Provider 或等待 TTL。

5. **视图转换失败**  
   整页失败而非逐条降级：下游拿到该页数据前应感知配置错误，避免部分字段静默丢失。

# 错误码冗余清理 Spec

## Why

`shared/types/errorCodes.ts` 中存在 123 个错误码，其中包含 4 个完全未使用的死代码、多个前后端不匹配的语义重复码（后端返回无前缀码但前端只检查带前缀版本），以及大量语义完全相同的重复定义。这增加了维护成本，且前后端不匹配可能导致认证错误检测失败。

## What Changes

### 1. 删除 4 个死代码
- `INVALID_JSON` — 零引用，对应 `VALIDATION_INVALID_JSON` 在用
- `INVALID_PARAMS` — 零引用，对应 `VALIDATION_INVALID_PARAMS` 在用
- `DUPLICATE_ENTRY` — 零引用，对应 `DATABASE_DUPLICATE_ENTRY` 在用
- `FOREIGN_KEY_VIOLATION` — 零引用，对应 `DATABASE_FOREIGN_KEY_VIOLATION` 在用

### 2. 合并前后端不匹配的认证错误码
后端 `api/middleware/auth.ts` 使用无前缀码，但前端只检查带前缀版本。统一为带前缀版本：

| 删除（无前缀） | 保留（带前缀） | 后端引用文件 |
|---|---|---|
| `TOKEN_MISSING` | `AUTH_TOKEN_MISSING` | auth.ts (1处) |
| `INVALID_TOKEN` | `AUTH_TOKEN_INVALID` | auth.ts (1处) |
| `TOKEN_EXPIRED` | `AUTH_TOKEN_EXPIRED` | auth.ts (1处) |
| `TOKEN_REVOKED` | `AUTH_TOKEN_REVOKED` | auth.ts (1处) |
| `UNAUTHORIZED` | `AUTH_UNAUTHORIZED` | 9个路由文件 (22处) |

### 3. 合并语义重复的资源错误码
无前缀版本与 `RESOURCE_*` 前缀版本语义完全相同，统一保留 `RESOURCE_*` 前缀版本（更明确）：

| 删除（无前缀） | 保留（带前缀） | 需更新的引用文件数 |
|---|---|---|
| `GRAPH_NOT_FOUND` | `RESOURCE_GRAPH_NOT_FOUND` | 1 (crud.ts) |
| `NODE_NOT_FOUND` | `RESOURCE_NODE_NOT_FOUND` | 3 (studyRouteService, quizSetsService, nodesService) |
| `CARD_NOT_FOUND` | `RESOURCE_CARD_NOT_FOUND` | 1 (study.ts) |
| `TASK_NOT_FOUND` | `RESOURCE_TASK_NOT_FOUND` | 4 (cards.ts, i18n×2, systemTaskService) |

### 4. 合并其他语义重复码

| 删除 | 保留 | 理由 | 需更新的引用 |
|---|---|---|---|
| `MISSING_REQUIRED_FIELDS` | `VALIDATION_MISSING_FIELD` | 语义相同 | 3 (prompts.ts, i18n×2) |
| `NOT_AUTHORIZED` | `AUTH_FORBIDDEN` | 语义相同（无权限） | 3 (aiActions.ts, i18n×2) |
| `PERMISSION_DENIED` | `AUTH_FORBIDDEN` | 语义相同（无权限） | 2 (i18n×2) |
| `FORBIDDEN` | `AUTH_FORBIDDEN` | 语义相同 | 12 (多个路由/中间件) |
| `NOT_FOUND` | `RESOURCE_NOT_FOUND` | 语义相同 | 36 (大量后端文件) |
| `INTERNAL_ERROR` | `SYSTEM_INTERNAL_ERROR` | 语义相同 | 83 (大量后端文件) |

### 5. 保留不合并的码
以下码虽有语义关联但用途不同，保留：
- `AUTH_HEADER_MISSING` vs `AUTH_TOKEN_MISSING`：前者指 HTTP header 缺失，后者指 token 本身缺失
- `RESOURCE_NOT_FOUND` vs `RESOURCE_GRAPH_NOT_FOUND` 等：通用 vs 特定资源，各有用途
- `VALIDATION_ERROR` vs `VALIDATION_MISSING_FIELD` 等：通用 vs 特定验证错误
- `SYSTEM_INTERNAL_ERROR` vs `SERVER_ERROR`：前者用于已知内部错误，后者用于未预期服务器错误

## Impact

- **Affected code**: `shared/types/errorCodes.ts`（核心变更），`api/middleware/auth.ts`，`api/middleware/ownership.ts`，`api/middleware/csrf.ts`，`api/middleware/errorHandler.ts`，约 40+ 后端路由/服务文件，`src/i18n/locales/zh-CN.json`，`src/i18n/locales/en-US.json`
- **BREAKING**: 后端 API 返回的错误码字符串会变化（如 `UNAUTHORIZED` → `AUTH_UNAUTHORIZED`），前端需同步更新
- **Risk**: 中等 — 涉及大量文件修改，但每个修改都是简单的字符串替换

## ADDED Requirements

### Requirement: 错误码唯一性
系统 SHALL 确保每个语义概念只对应一个错误码，消除语义重复定义。

#### Scenario: 后端抛出认证错误
- **WHEN** 后端中间件检测到 token 无效
- **THEN** 抛出 `AUTH_TOKEN_INVALID` 而非 `INVALID_TOKEN`，前端可正确检测并处理

#### Scenario: 后端抛出资源未找到错误
- **WHEN** 后端查询图谱不存在
- **THEN** 抛出 `RESOURCE_GRAPH_NOT_FOUND` 而非 `GRAPH_NOT_FOUND` 或 `NOT_FOUND`

#### Scenario: 后端抛出内部错误
- **WHEN** 后端发生未预期错误
- **THEN** 抛出 `SYSTEM_INTERNAL_ERROR` 而非 `INTERNAL_ERROR`

## REMOVED Requirements

### Requirement: 无前缀认证错误码
**Reason**: 与 `AUTH_*` 前缀版本语义重复，且前端无法识别
**Migration**: `TOKEN_MISSING` → `AUTH_TOKEN_MISSING`，`INVALID_TOKEN` → `AUTH_TOKEN_INVALID`，`TOKEN_EXPIRED` → `AUTH_TOKEN_EXPIRED`，`TOKEN_REVOKED` → `AUTH_TOKEN_REVOKED`，`UNAUTHORIZED` → `AUTH_UNAUTHORIZED`

### Requirement: 无前缀资源错误码
**Reason**: 与 `RESOURCE_*` 前缀版本语义重复
**Migration**: `NOT_FOUND` → `RESOURCE_NOT_FOUND`，`GRAPH_NOT_FOUND` → `RESOURCE_GRAPH_NOT_FOUND`，`NODE_NOT_FOUND` → `RESOURCE_NODE_NOT_FOUND`，`CARD_NOT_FOUND` → `RESOURCE_CARD_NOT_FOUND`，`TASK_NOT_FOUND` → `RESOURCE_TASK_NOT_FOUND`

### Requirement: 死代码错误码
**Reason**: 零业务引用，完全未使用
**Migration**: 无需迁移，直接删除 `INVALID_JSON`、`INVALID_PARAMS`、`DUPLICATE_ENTRY`、`FOREIGN_KEY_VIOLATION`

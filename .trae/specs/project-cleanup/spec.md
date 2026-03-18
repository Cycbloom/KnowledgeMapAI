# 项目清理优化 Spec

## Why

项目经过长期迭代，积累了大量冗余文件和代码：
1. TypeScript 编译产物（.js/.js.map）被错误地提交到仓库
2. 存在重复的模块定义（如 errorCodes 多处定义）
3. 废弃的临时文件和测试数据未清理
4. 开发过程中的中间产物未被正确忽略
5. 部分功能模块存在重复实现

这些问题导致项目体积膨胀、维护困难、构建时间增加。

## What Changes

### 1. 清理 TypeScript 编译产物
- **删除 `api/` 目录下所有 `.js` 和 `.js.map` 文件**（保留 `.ts` 源文件）
- **删除 `src/types/` 目录下所有 `.js` 和 `.js.map` 文件**
- **删除 `shared/types/` 目录下所有 `.js` 和 `.js.map` 文件**
- **更新 `.gitignore`** 确保编译产物不再被提交

### 2. 清理重复模块
- **合并 errorCodes 定义**：删除 `api/config/errorCodes.ts` 和 `api/constants/errorCodes.ts`，统一使用 `shared/types/errorCodes.ts`
- **清理重复的服务文件**：
  - 删除 `api/services/focusService.ts`（使用 `api/services/scheduler/focusService.ts`）
  - 删除 `api/services/taskService.ts`（使用 `api/services/scheduler/taskService.ts`）

### 3. 清理临时/无用文件
- 删除 `api/n`（空文件）
- 删除 `c --noEmit`（命令行错误创建的文件）
- 删除 `test-import.db`（测试数据库）

### 4. 清理开发产物
- 删除 `dev-dist/` 目录（开发时的 PWA 产物，应通过构建生成）
- 删除 `data/knowledgemap.db*` 数据库文件（本地开发数据）

### 5. 清理冗余脚本
- 删除 `scripts/fix-imports.js`（一次性修复脚本）
- 删除 `scripts/update-imports.js`（一次性修复脚本）

### 6. 清理字体文件冗余
- 将 `api/assets/fonts/` 移动到 `public/fonts/`（字体应由前端直接使用）
- 或删除（如果项目已使用 CDN 字体）

### 7. 更新 .gitignore
添加以下忽略规则：
```
# TypeScript 编译产物
api/**/*.js
api/**/*.js.map
src/types/*.js
src/types/*.js.map
shared/types/*.js
shared/types/*.js.map

# 开发产物
dev-dist/

# 本地数据库
data/*.db
data/*.db-shm
data/*.db-wal
```

## Impact

### Affected specs
- 无功能影响，仅清理冗余文件

### Affected code
- `api/` 目录结构
- `shared/types/` 目录结构
- `src/types/` 目录结构
- `.gitignore` 配置
- `scripts/` 目录

## ADDED Requirements

### Requirement: 编译产物管理
系统 SHALL 确保 TypeScript 编译产物不被提交到版本控制。

#### Scenario: 编译产物不提交
- **WHEN** 开发者运行 TypeScript 编译
- **THEN** 生成的 .js 和 .js.map 文件不会被 git 跟踪

### Requirement: 模块单一来源
系统 SHALL 确保每个功能模块只有一个定义来源。

#### Scenario: errorCodes 导入
- **WHEN** 代码需要使用错误码
- **THEN** 从 `shared/types/errorCodes.ts` 统一导入

### Requirement: 临时文件清理
系统 SHALL 不包含临时文件和测试数据。

#### Scenario: 仓库干净
- **WHEN** 检查仓库内容
- **THEN** 不存在空文件、命令行错误创建的文件、本地测试数据库

## MODIFIED Requirements

### Requirement: .gitignore 配置
更新 .gitignore 以正确忽略所有编译产物和开发产物。

## REMOVED Requirements

### Requirement: 编译产物跟踪
**Reason**: TypeScript 编译产物应该通过构建过程生成，不应纳入版本控制
**Migration**: 删除所有已提交的编译产物，更新 .gitignore

### Requirement: 重复模块定义
**Reason**: errorCodes 等模块存在多处重复定义
**Migration**: 统一使用 shared/types 下的定义

---

## 清理文件清单

### 需删除的 .js 文件（共约 150+ 个）
```
api/app.js
api/middleware/*.js
api/routes/*.js
api/routes/ai/*.js
api/routes/scheduler/*.js
api/services/**/*.js
api/utils/*.js
api/config/*.js
api/constants/*.js
api/docs/*.js
api/schemas/*.js
api/models/*.js
api/jobs/*.js
api/shared/types/*.js
src/types/*.js
shared/types/*.js
```

### 需删除的 .js.map 文件（共约 150+ 个）
与上述 .js 文件对应的 .map 文件

### 需删除的临时文件
```
api/n
c --noEmit
test-import.db
```

### 需删除的目录
```
dev-dist/
data/knowledgemap.db
data/knowledgemap.db-shm
data/knowledgemap.db-wal
```

### 需删除的脚本
```
scripts/fix-imports.js
scripts/update-imports.js
```

### 需合并的重复模块
```
api/config/errorCodes.ts -> 删除（使用 shared/types/errorCodes.ts）
api/constants/errorCodes.ts -> 删除（使用 shared/types/errorCodes.ts）
api/services/focusService.ts -> 删除（使用 api/services/scheduler/focusService.ts）
api/services/taskService.ts -> 删除（使用 api/services/scheduler/taskService.ts）
```

---

## 预计效果

| 指标 | 清理前 | 清理后 | 改善 |
|------|--------|--------|------|
| 仓库文件数 | ~1200+ | ~900 | -25% |
| 仓库大小 | 较大 | 显著减小 | -30%+ |
| 编译产物 | 300+ 文件 | 0 | -100% |
| 重复模块 | 6+ 处 | 0 | -100% |

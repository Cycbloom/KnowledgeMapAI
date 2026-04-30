# 清理过时代码和文档 Spec

## Why
项目中存在已弃用的 Redis 相关代码和配置、TypeScript 编译产物未被正确忽略、文档中包含过时的依赖说明，需要在发布到 GitHub 前进行清理，避免误导用户和增加维护负担。

## What Changes
- 删除已弃用的 Redis 相关文件（`api/utils/redis.js`）
- 删除 TypeScript 编译产物（`api/**/*.js` 和 `api/**/*.js.map`）
- 删除无源文件的编译产物目录（`api/constants/`、`api/plugins/`）
- 更新 README.md 移除 Redis、BullMQ、Docker 相关说明
- 更新 `.env.example` 移除 `REDIS_URL` 配置
- 更新 `VERCEL_ENV_SETUP.md` 移除 Redis 相关内容
- 更新 `api/utils/envValidator.ts` 移除 `TTS_SERVICE_URL`（已改用阿里云 TTS）

## Impact
- Affected specs: 无
- Affected code: 
  - `api/utils/redis.js`（删除）
  - `api/utils/envValidator.ts`（修改）
  - `README.md`（修改）
  - `.env.example`（修改）
  - `VERCEL_ENV_SETUP.md`（修改）
  - 所有 `api/**/*.js` 和 `api/**/*.js.map`（删除）

## ADDED Requirements
无

## MODIFIED Requirements
### Requirement: 环境配置文档
文档 SHALL 只包含当前实际使用的依赖和配置说明，不应包含已弃用的 Redis、BullMQ、Docker 等内容。

### Requirement: 环境变量示例
`.env.example` SHALL 只包含当前实际需要的环境变量，移除 `REDIS_URL` 和 `TTS_SERVICE_URL`。

### Requirement: TypeScript 编译产物
项目 SHALL 通过 `.gitignore` 正确忽略 TypeScript 编译产物，且 Git 仓库中不应包含这些文件。

## REMOVED Requirements
### Requirement: Redis 缓存支持
**Reason**: 项目已迁移到 NodeCache 内存缓存，Redis 相关代码和配置已无用。
**Migration**: 无需迁移，NodeCache 已在使用中。

### Requirement: 独立 TTS 服务
**Reason**: TTS 功能已集成到阿里云 AI 提供商中，不再需要独立的 TTS_SERVICE_URL。
**Migration**: 无需迁移，TTS 功能通过阿里云 API 实现。

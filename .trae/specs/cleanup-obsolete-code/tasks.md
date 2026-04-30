# Tasks

- [x] Task 1: 删除 Redis 相关文件
  - [x] SubTask 1.1: 删除 `api/utils/redis.js`
  - [x] SubTask 1.2: 删除 `api/utils/redis.js.map`

- [x] Task 2: 删除 TypeScript 编译产物
  - [x] SubTask 2.1: 删除 `api/routes/**/*.js` 和 `api/routes/**/*.js.map`
  - [x] SubTask 2.2: 删除 `api/utils/**/*.js` 和 `api/utils/**/*.js.map`（保留 logger.ts 等）
  - [x] SubTask 2.3: 删除 `api/jobs/**/*.js` 和 `api/jobs/**/*.js.map`
  - [x] SubTask 2.4: 删除 `api/docs/**/*.js` 和 `api/docs/**/*.js.map`
  - [x] SubTask 2.5: 删除 `api/schemas/**/*.js` 和 `api/schemas/**/*.js.map`
  - [x] SubTask 2.6: 删除 `api/models/**/*.js` 和 `api/models/**/*.js.map`
  - [x] SubTask 2.7: 删除 `api/*.js` 和 `api/*.js.map`
  - [x] SubTask 2.8: 删除 `api/shared/**/*.js` 和 `api/shared/**/*.js.map`

- [x] Task 3: 删除无源文件的目录
  - [x] SubTask 3.1: 删除 `api/constants/` 目录
  - [x] SubTask 3.2: 删除 `api/plugins/` 目录
  - [x] SubTask 3.3: 删除 `api/config/errorCodes.js` 和 `api/config/errorCodes.js.map`

- [x] Task 4: 更新环境变量验证器
  - [x] SubTask 4.1: 从 `api/utils/envValidator.ts` 移除 `TTS_SERVICE_URL` 配置

- [x] Task 5: 更新文档
  - [x] SubTask 5.1: 更新 README.md 移除 Redis、BullMQ、Docker 相关说明
  - [x] SubTask 5.2: 更新 `.env.example` 移除 `REDIS_URL` 和 `TTS_SERVICE_URL`
  - [x] SubTask 5.3: 更新 `VERCEL_ENV_SETUP.md` 移除 Redis 相关内容

- [x] Task 6: 验证清理结果
  - [x] SubTask 6.1: 确认所有 `.js` 和 `.js.map` 文件已从 `api/` 目录删除
  - [x] SubTask 6.2: 确认文档中不再包含过时内容
  - [x] SubTask 6.3: 运行类型检查确认无错误

# Task Dependencies
- Task 6 依赖 Task 1-5 完成

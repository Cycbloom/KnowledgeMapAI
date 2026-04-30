# 清理过时代码和文档 Checklist

## 文件清理
- [x] `api/utils/redis.js` 已删除
- [x] `api/utils/redis.js.map` 已删除
- [x] `api/constants/` 目录已删除
- [x] `api/plugins/` 目录已删除
- [x] `api/config/errorCodes.js` 已删除
- [x] `api/config/errorCodes.js.map` 已删除
- [x] 所有 `api/**/*.js` 编译产物已删除
- [x] 所有 `api/**/*.js.map` 编译产物已删除

## 文档更新
- [x] README.md 中 Redis 相关说明已移除
- [x] README.md 中 BullMQ 相关说明已移除
- [x] README.md 中 Docker 相关说明已移除
- [x] README.md 后端技术栈表格已更新
- [x] `.env.example` 中 `REDIS_URL` 已移除
- [x] `.env.example` 中 `TTS_SERVICE_URL` 已移除
- [x] `VERCEL_ENV_SETUP.md` 中 Redis 相关内容已移除

## 代码更新
- [x] `api/utils/envValidator.ts` 中 `TTS_SERVICE_URL` 已移除

## 验证
- [x] 运行 `npm run check` 无错误
- [x] 运行 `npm run lint` 无错误
- [x] 项目仍可正常启动

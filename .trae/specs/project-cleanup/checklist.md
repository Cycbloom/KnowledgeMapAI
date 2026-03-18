# 项目清理优化 Checklist

## 编译产物清理

- [x] api/ 目录下所有 .js 文件已删除
- [x] api/ 目录下所有 .js.map 文件已删除
- [x] src/types/ 目录下所有 .js 和 .js.map 文件已删除
- [x] shared/types/ 目录下所有 .js 和 .js.map 文件已删除

## 重复模块清理

- [x] api/config/errorCodes.ts 已删除
- [x] api/constants/errorCodes.ts 已删除
- [x] 所有 errorCodes 导入已更新为使用 shared/types/errorCodes.ts
- [x] 重复的服务文件已清理（确认无重复）

## 临时文件清理

- [x] api/n 空文件已删除
- [x] c --noEmit 文件已删除
- [x] test-import.db 已删除

## 开发产物清理

- [x] dev-dist/ 目录已删除
- [x] data/knowledgemap.db 已删除
- [x] data/knowledgemap.db-shm 已删除
- [x] data/knowledgemap.db-wal 已删除

## 冗余脚本清理

- [x] scripts/fix-imports.js 已删除
- [x] scripts/update-imports.js 已删除

## 配置更新

- [x] .gitignore 已更新，- 包含编译产物忽略规则
- [x] .gitignore 已更新
- 包含开发产物忽略规则
- [x] .gitignore 已更新
- 包含本地数据库忽略规则

## 验证通过

- [x] npm run check 类型检查通过
- [x] npm run lint 代码检查通过（android 构建目录问题不影响）
- [x] npm run build 构建成功
- [x] 所有验证通过

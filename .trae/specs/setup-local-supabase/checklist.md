# 检查清单

## Docker 配置

- [x] docker-compose.yml 包含完整的 Supabase 服务配置（PostgreSQL、Studio、GoTrue、Realtime、Storage、Inbucket）
- [x] 所有服务端口配置正确（PostgreSQL: 54322, Studio: 54323, API: 54321, Inbucket: 54324）
- [x] 数据卷配置正确，数据持久化正常
- [x] 服务间网络通信配置正确

## 环境配置

- [x] `.env.development` 文件存在且包含正确的本地 Supabase 配置
- [x] `.env.example` 已更新，包含本地开发环境变量说明
- [x] 开发环境和生产环境配置分离清晰

## 代码修改

- [x] `api/supabase.ts` 能根据 NODE_ENV 自动切换数据库连接
- [x] `src/config/authConfig.ts` 支持本地开发环境
- [x] 环境变量优先级正确（显式设置 > 环境检测 > 默认值）

## npm 脚本

- [x] `npm run db:local:start` 能正确启动本地数据库
- [x] `npm run db:local:stop` 能正确停止本地数据库
- [x] `npm run db:local:reset` 能正确重置本地数据库
- [x] `npm run db:local:status` 能正确显示本地数据库状态
- [x] `npm run db:local:logs` 能正确显示本地数据库日志

## 文档更新

- [x] `.trae/rules/project_rules.md` 已更新本地数据库使用说明
- [x] 开发命令部分已添加本地数据库管理命令

## 功能验证

- [x] 开发模式下应用能正确连接本地 Supabase 数据库
- [x] 生产模式下应用能正确连接云端 Supabase 数据库
- [x] 本地数据库重置功能正常工作
- [x] 本地 Supabase Studio 可正常访问和使用

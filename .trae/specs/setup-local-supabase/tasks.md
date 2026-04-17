# Tasks

- [x] Task 1: 更新 docker-compose.yml 添加本地 Supabase 服务配置
  - [x] SubTask 1.1: 添加 PostgreSQL 数据库服务配置
  - [x] SubTask 1.2: 添加 Supabase Studio 服务配置
  - [x] SubTask 1.3: 添加 GoTrue 认证服务配置
  - [x] SubTask 1.4: 添加 Realtime 服务配置
  - [x] SubTask 1.5: 添加 Storage 服务配置
  - [x] SubTask 1.6: 添加 Inbucket 邮件测试服务配置
  - [x] SubTask 1.7: 配置服务间网络和数据卷

- [x] Task 2: 创建开发环境配置文件
  - [x] SubTask 2.1: 创建 `.env.development` 文件，配置本地 Supabase 连接信息
  - [x] SubTask 2.2: 更新 `.env.example` 添加本地开发环境变量说明

- [x] Task 3: 修改后端数据库连接代码支持环境切换
  - [x] SubTask 3.1: 更新 `api/supabase.ts` 添加环境检测逻辑
  - [x] SubTask 3.2: 实现根据 NODE_ENV 自动选择数据库配置
  - [x] SubTask 3.3: 添加本地开发环境的默认配置值

- [x] Task 4: 修改前端认证配置支持本地开发
  - [x] SubTask 4.1: 更新 `src/config/authConfig.ts` 支持本地开发环境
  - [x] SubTask 4.2: 确保前端能正确连接本地 Supabase 认证服务

- [x] Task 5: 添加 npm 脚本简化本地数据库操作
  - [x] SubTask 5.1: 在 `package.json` 中添加 `db:local:start` 脚本
  - [x] SubTask 5.2: 添加 `db:local:stop` 脚本
  - [x] SubTask 5.3: 添加 `db:local:reset` 脚本
  - [x] SubTask 5.4: 添加 `db:local:status` 脚本
  - [x] SubTask 5.5: 添加 `db:local:logs` 脚本

- [x] Task 6: 更新项目规则文档
  - [x] SubTask 6.1: 更新 `.trae/rules/project_rules.md` 添加本地数据库使用说明
  - [x] SubTask 6.2: 更新开发命令部分，添加本地数据库管理命令

- [x] Task 7: 验证配置正确性
  - [x] SubTask 7.1: 启动本地 Docker 服务验证服务正常运行
  - [x] SubTask 7.2: 验证开发环境能正确连接本地数据库
  - [x] SubTask 7.3: 验证生产环境配置不受影响

# Task Dependencies

- [Task 3] 依赖 [Task 2]
- [Task 4] 依赖 [Task 2]
- [Task 7] 依赖 [Task 1, Task 2, Task 3, Task 4, Task 5]

# 数据库环境分离配置 Spec

## Why

当前项目在开发和部署环境共用同一个云端 Supabase 数据库，导致开发过程中的测试数据与生产数据混合，影响开发效率。开发人员无法自由地重置、重启数据库进行测试，且可能意外影响生产环境数据。需要实现开发环境与部署环境的数据库分离，提高开发效率并保障数据安全。

## What Changes

- 在 `docker-compose.yml` 中添加本地 Supabase 服务配置（PostgreSQL、GoTrue、Realtime、Storage、Studio 等）
- 创建 `.env.development` 文件用于开发环境配置
- 更新 `.env.example` 添加本地开发环境变量说明
- 修改 `api/supabase.ts` 支持根据环境自动切换数据库连接
- 更新 `src/config/authConfig.ts` 支持本地开发环境
- 添加 npm 脚本简化本地数据库操作
- 更新项目规则文档，说明本地数据库使用方式

## Impact

- Affected specs: 数据库连接配置、环境变量管理
- Affected code: 
  - `docker-compose.yml`
  - `api/supabase.ts`
  - `src/config/authConfig.ts`
  - `.env.example`
  - `package.json`
  - `.trae/rules/project_rules.md`

## ADDED Requirements

### Requirement: 本地 Supabase Docker 服务

系统 SHALL 在开发环境中通过 Docker Compose 提供完整的本地 Supabase 服务栈。

#### Scenario: 启动本地开发数据库
- **WHEN** 开发人员执行 `docker-compose up -d` 或 `npm run db:local:start`
- **THEN** 系统应启动以下服务：
  - PostgreSQL 数据库（端口 54322）
  - Supabase Studio（端口 54323）
  - GoTrue 认证服务（端口 54321）
  - Realtime 服务
  - Storage 服务
  - Inbucket 邮件测试服务（端口 54324）

#### Scenario: 停止本地开发数据库
- **WHEN** 开发人员执行 `docker-compose down` 或 `npm run db:local:stop`
- **THEN** 系统应停止所有本地 Supabase 服务，但保留数据卷

#### Scenario: 重置本地开发数据库
- **WHEN** 开发人员执行 `npm run db:local:reset`
- **THEN** 系统应删除所有本地数据并重新初始化数据库 schema 和 seed 数据

### Requirement: 环境自动切换

系统 SHALL 根据 `NODE_ENV` 环境变量自动选择正确的数据库连接配置。

#### Scenario: 开发环境连接
- **WHEN** `NODE_ENV=development` 或未设置 `NODE_ENV`
- **THEN** 系统应连接到本地 Docker Supabase 服务（`http://127.0.0.1:54321`）

#### Scenario: 生产环境连接
- **WHEN** `NODE_ENV=production`
- **THEN** 系统应连接到云端 Supabase 服务（使用 `.env.production` 中的配置）

#### Scenario: 环境变量优先级
- **WHEN** 存在显式设置的环境变量（如 `VITE_SUPABASE_URL`）
- **THEN** 系统应优先使用显式设置的环境变量，而非自动推断

### Requirement: 开发环境配置文件

系统 SHALL 提供独立的开发环境配置文件 `.env.development`。

#### Scenario: 加载开发环境配置
- **WHEN** 系统在开发模式下启动
- **THEN** 系统应加载 `.env.development` 文件中的配置

#### Scenario: 配置文件缺失处理
- **WHEN** `.env.development` 文件不存在
- **THEN** 系统应使用默认的本地开发配置值

### Requirement: 本地数据库管理脚本

系统 SHALL 提供 npm 脚本简化本地数据库操作。

#### Scenario: 数据库操作脚本
- **WHEN** 开发人员需要管理本地数据库
- **THEN** 系统应提供以下脚本：
  - `npm run db:local:start` - 启动本地数据库
  - `npm run db:local:stop` - 停止本地数据库
  - `npm run db:local:reset` - 重置本地数据库
  - `npm run db:local:status` - 查看本地数据库状态
  - `npm run db:local:logs` - 查看本地数据库日志

## MODIFIED Requirements

### Requirement: 数据库连接初始化

系统 SHALL 在初始化 Supabase 客户端时根据当前环境选择正确的连接配置。

原有行为：仅使用 `.env.production` 或环境变量中的固定配置

修改后行为：
1. 检测 `NODE_ENV` 环境变量
2. 如果是开发环境，使用本地 Supabase 配置
3. 如果是生产环境，使用云端 Supabase 配置
4. 支持通过环境变量覆盖自动检测

### Requirement: 前端认证配置

系统 SHALL 在前端认证配置中支持本地开发环境。

原有行为：硬编码云端 Supabase URL 和 Key

修改后行为：
1. 优先使用环境变量 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`
2. 开发环境下使用本地 Supabase 默认配置作为后备值

## REMOVED Requirements

无移除的需求。

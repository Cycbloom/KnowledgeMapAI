# 插件市场 Spec

## Why

微内核架构已将 6 个内置插件（core/graph/ai/study/scheduler/agent）解耦为可插拔模块，但当前所有插件都是硬编码在 server.ts 和 plugins.ts 中的。插件市场让用户可以浏览、安装、卸载、更新第三方插件，将 KnowledgeMap 从"封闭系统"升级为"开放平台"，类似 VS Code 扩展市场。

## What Changes

- **创建插件清单规范（Plugin Manifest）**：定义插件元数据的 JSON Schema，包含名称、版本、入口文件、权限声明、截图等
- **创建插件存储服务（PluginStoreService）**：管理插件的安装、卸载、更新，将插件包存储到本地文件系统
- **创建插件加载器（PluginLoader）**：从文件系统动态加载插件包，验证清单，注册到 Kernel
- **创建插件注册表 API（Plugin Registry API）**：后端 REST API，支持浏览、搜索、安装、卸载插件
- **创建插件市场前端页面**：插件浏览、搜索、详情、安装/卸载/更新 UI
- **创建插件状态持久化**：数据库表记录用户安装的插件及其状态
- **扩展 Plugin 接口**：添加 author、icon、screenshots、permissions、homepage 等市场元数据

## Impact

- Affected specs: plugin-microkernel-architecture（Plugin 接口扩展、Kernel 新增动态加载能力）
- Affected code:
  - `api/services/kernel/types.ts` — Plugin 接口扩展
  - `api/services/kernel/Kernel.ts` — 新增动态加载方法
  - `api/server.ts` — 启动时加载已安装的第三方插件
  - `api/routes/plugins.ts` — 扩展插件管理 API
  - `src/services/kernel/plugins.ts` — 前端动态插件加载
  - `src/App.tsx` — 支持动态插件路由
  - `supabase/migrations/` — 新增插件相关数据库表

## ADDED Requirements

### Requirement: 插件清单规范（Plugin Manifest）

系统 SHALL 定义标准化的插件清单格式，每个插件包必须包含 `plugin.json` 清单文件。

#### Scenario: 清单文件结构
- **WHEN** 一个插件包被提交
- **THEN** 清单文件必须包含以下字段：
  - `name`: 唯一标识符（kebab-case，如 "code-review-toolkit"）
  - `version`: 语义化版本号（如 "1.2.3"）
  - `description`: 功能描述
  - `author`: 作者信息（name + email）
  - `main`: 入口文件路径（如 "./index.js"）
  - `dependencies`: 依赖的其他插件名称列表
  - `permissions`: 权限声明列表（如 ["graph:read", "ai:write"]）
- **AND** 可选字段：
  - `icon`: 图标 URL 或 SVG
  - `screenshots`: 截图 URL 列表
  - `homepage`: 插件主页 URL
  - `repository`: 代码仓库 URL
  - `keywords`: 搜索关键词
  - `category`: 分类（如 "productivity"、"ai"、"visualization"）

#### Scenario: 清单验证
- **WHEN** 插件包被安装
- **THEN** 系统验证清单文件格式正确
- **AND** 验证 `name` 不与内置插件冲突（core/graph/ai/study/scheduler/agent）
- **AND** 验证 `main` 指向的入口文件存在
- **AND** 验证 `permissions` 中的权限项合法

### Requirement: 插件存储服务（PluginStoreService）

系统 SHALL 提供插件存储服务，管理插件包的安装、卸载和更新。

#### Scenario: 安装插件
- **WHEN** 用户请求安装一个插件
- **THEN** 系统下载插件包到 `plugins/` 目录
- **AND** 验证清单文件
- **AND** 解析依赖关系，自动安装缺失的依赖插件
- **AND** 将插件注册到 Kernel
- **AND** 记录安装信息到数据库

#### Scenario: 卸载插件
- **WHEN** 用户请求卸载一个插件
- **THEN** 系统先停用插件（调用 onDeactivate + onUninstall）
- **AND** 从 Kernel 移除插件注册
- **AND** 删除插件包文件
- **AND** 从数据库删除安装记录
- **AND** 如果有其他插件依赖该插件，拒绝卸载并提示

#### Scenario: 更新插件
- **WHEN** 用户请求更新一个已安装的插件
- **THEN** 系统下载新版本插件包
- **AND** 停用旧版本
- **AND** 注册新版本到 Kernel
- **AND** 激活新版本
- **AND** 更新数据库中的版本记录

#### Scenario: 插件包格式
- **WHEN** 插件被打包发布
- **THEN** 插件包为 `.tar.gz` 格式
- **AND** 包内根目录包含 `plugin.json` 清单文件
- **AND** 包内包含 `main` 字段指定的入口 JS 文件
- **AND** 入口文件导出符合 Plugin 接口的对象

### Requirement: 插件加载器（PluginLoader）

系统 SHALL 提供插件加载器，在启动时和运行时动态加载插件。

#### Scenario: 启动时加载已安装插件
- **WHEN** 服务器启动
- **THEN** PluginLoader 读取数据库中所有已安装的第三方插件列表
- **AND** 按依赖顺序加载每个插件的入口文件
- **AND** 验证入口文件导出符合 Plugin 接口
- **AND** 调用 `kernel.registerPlugin()` 注册
- **AND** 调用 `kernel.activatePlugin()` 激活

#### Scenario: 运行时安装插件
- **WHEN** 用户在运行时安装新插件
- **THEN** PluginLoader 动态加载插件入口文件
- **AND** 注册并激活插件
- **AND** 无需重启服务器

#### Scenario: 加载失败处理
- **WHEN** 插件加载失败（文件损坏、接口不匹配等）
- **THEN** 系统记录错误日志
- **AND** 跳过该插件，不影响其他插件加载
- **AND** 在插件列表中标记该插件为 "error" 状态

### Requirement: 插件注册表 API

系统 SHALL 提供插件注册表 REST API，支持浏览、搜索、安装、卸载插件。

#### Scenario: 浏览可用插件
- **WHEN** GET `/api/plugins/registry`
- **THEN** 返回所有可用插件的列表，包含名称、版本、描述、作者、分类、安装数
- **AND** 支持 `category` 和 `keyword` 查询参数过滤

#### Scenario: 搜索插件
- **WHEN** GET `/api/plugins/registry?q=keyword`
- **THEN** 返回匹配关键词的插件列表
- **AND** 搜索范围包括名称、描述、关键词、作者

#### Scenario: 获取插件详情
- **WHEN** GET `/api/plugins/registry/:name`
- **THEN** 返回插件的完整信息，包含清单、截图、版本历史、安装数、评分

#### Scenario: 安装插件
- **WHEN** POST `/api/plugins/registry/:name/install`
- **THEN** 下载并安装指定插件
- **AND** 返回安装结果（成功/失败/依赖缺失）

#### Scenario: 卸载插件
- **WHEN** POST `/api/plugins/registry/:name/uninstall`
- **THEN** 卸载指定插件
- **AND** 如果有依赖插件，返回错误提示

#### Scenario: 更新插件
- **WHEN** POST `/api/plugins/registry/:name/update`
- **THEN** 更新到最新版本

#### Scenario: 检查更新
- **WHEN** GET `/api/plugins/updates`
- **THEN** 返回所有已安装插件中可更新的列表

### Requirement: 插件市场前端页面

系统 SHALL 提供插件市场前端页面，集成到 Settings 页面中。

#### Scenario: 插件市场浏览
- **WHEN** 用户访问 Settings → 插件市场标签
- **THEN** 显示所有可用插件的卡片列表
- **AND** 每个卡片显示图标、名称、描述、作者、安装数、评分
- **AND** 支持按分类筛选和关键词搜索

#### Scenario: 插件详情页
- **WHEN** 用户点击某个插件卡片
- **THEN** 显示插件详情：截图、完整描述、版本历史、权限声明、安装按钮
- **AND** 已安装的插件显示"已安装"状态和"卸载"/"更新"按钮

#### Scenario: 已安装插件管理
- **WHEN** 用户切换到"已安装"标签
- **THEN** 显示所有已安装插件的列表
- **AND** 每个插件显示名称、版本、状态（active/inactive/error）
- **AND** 提供启用/停用/卸载/更新操作

#### Scenario: 安装确认
- **WHEN** 用户点击安装按钮
- **THEN** 弹出确认对话框，显示插件请求的权限列表
- **AND** 用户确认后开始安装
- **AND** 安装过程中显示进度指示器

### Requirement: 插件状态持久化

系统 SHALL 将插件的安装状态持久化到数据库。

#### Scenario: 数据库表结构
- **WHEN** 系统初始化
- **THEN** 以下数据库表存在：
  - `installed_plugins`：记录用户安装的第三方插件（id, user_id, plugin_name, version, state, installed_at, updated_at）
  - `plugin_ratings`：记录用户对插件的评分（id, user_id, plugin_name, rating, review, created_at）

#### Scenario: 启动时恢复状态
- **WHEN** 服务器启动
- **THEN** 从 `installed_plugins` 表读取所有已安装插件
- **AND** 按记录的状态决定是否激活

#### Scenario: 状态同步
- **WHEN** 插件状态变更（安装/卸载/激活/停用）
- **THEN** 数据库记录实时更新

### Requirement: 插件权限系统

系统 SHALL 提供插件权限声明和检查机制。

#### Scenario: 权限声明
- **WHEN** 插件在清单中声明 `permissions`
- **THEN** 安装时向用户展示请求的权限列表
- **AND** 可用权限包括：
  - `graph:read` — 读取知识图谱
  - `graph:write` — 修改知识图谱
  - `ai:read` — 使用 AI 查询
  - `ai:write` — 触发 AI 生成
  - `study:read` — 读取学习数据
  - `study:write` — 修改学习进度
  - `scheduler:read` — 读取任务数据
  - `scheduler:write` — 修改任务
  - `storage:read` — 读取本地存储
  - `storage:write` — 写入本地存储
  - `network` — 访问外部网络

#### Scenario: 权限检查
- **WHEN** 插件调用 Kernel API
- **THEN** 系统检查该插件是否拥有所需权限
- **AND** 无权限时抛出错误

### Requirement: 内置插件注册表

系统 SHALL 提供一个内置的插件注册表，预置若干示例第三方插件信息。

#### Scenario: 内置注册表
- **WHEN** 系统启动
- **THEN** 内置注册表包含以下示例插件元数据：
  - "markdown-exporter" — 将知识图谱导出为 Markdown 文件
  - "daily-digest" — 每日知识摘要邮件推送
  - "graph-themes" — 自定义图谱主题包
- **AND** 内置注册表数据存储在 `api/services/kernel/registry/builtinPlugins.ts`

#### Scenario: 注册表扩展
- **WHEN** 未来需要添加更多插件到注册表
- **THEN** 只需在 `builtinPlugins.ts` 中添加条目
- **AND** 或通过配置文件指定外部注册表 URL

## MODIFIED Requirements

### Requirement: Plugin 接口

原有行为：Plugin 接口包含 name、version、description、dependencies、生命周期钩子

修改后行为：Plugin 接口扩展以下可选字段：
- `author`: 作者信息（`{ name: string; email?: string }`）
- `icon`: 图标 URL 或 SVG 字符串
- `screenshots`: 截图 URL 列表
- `homepage`: 插件主页 URL
- `repository`: 代码仓库 URL
- `keywords`: 搜索关键词列表
- `category`: 分类字符串
- `permissions`: 权限声明列表

### Requirement: Kernel 插件管理 API

原有行为：仅支持查询、激活、停用已注册的插件

修改后行为：扩展支持：
- `kernel.loadPlugin(pluginPath)`: 从文件路径加载插件
- `kernel.unloadPlugin(name)`: 卸载插件并清理所有注册
- `kernel.getPluginState(name)`: 返回详细状态（含 error 信息）

### Requirement: 插件管理路由

原有行为：`api/routes/plugins.ts` 仅支持 GET/POST 查询和激活/停用

修改后行为：扩展支持注册表浏览、搜索、安装、卸载、更新 API

## REMOVED Requirements

无

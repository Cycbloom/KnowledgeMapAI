# Tasks

## Phase 1: 插件清单规范与数据模型

- [x] Task 1: 扩展 Plugin 接口和清单规范
  - [x] SubTask 1.1: 扩展 PluginMeta 接口
  - [x] SubTask 1.2: 创建 manifest.ts（Zod Schema）
  - [x] SubTask 1.3: 创建 permissions.ts

- [x] Task 2: 创建数据库表
  - [x] SubTask 2.1: 创建 17_plugin_marketplace.sql
  - [x] SubTask 2.2: 添加 RLS 策略

## Phase 2: 插件存储与加载

- [x] Task 3: 创建 PluginStoreService
  - [x] SubTask 3.1: install/uninstall/update 方法
  - [x] SubTask 3.2: 清单验证
  - [x] SubTask 3.3: 依赖解析
  - [x] SubTask 3.4: 评分系统

- [x] Task 4: 创建 PluginLoader
  - [x] SubTask 4.1: 启动时加载已安装插件
  - [x] SubTask 4.2: 运行时安装加载
  - [x] SubTask 4.3: 加载失败处理

- [x] Task 5: 扩展 Kernel
  - [x] SubTask 5.1: loadPluginFromManifest
  - [x] SubTask 5.2: unregisterPlugin
  - [x] SubTask 5.3: getPluginState

## Phase 3: 内置插件注册表

- [x] Task 6: 创建内置注册表
  - [x] SubTask 6.1: builtinPlugins.ts
  - [x] SubTask 6.2: PluginRegistry.ts
  - [x] SubTask 6.3: 分类过滤和关键词搜索

- [x] Task 7: 创建示例插件包
  - [x] SubTask 7.1: markdown-exporter
  - [x] SubTask 7.2: daily-digest
  - [x] SubTask 7.3: graph-themes

## Phase 4: 插件管理 API 扩展

- [x] Task 8: 扩展插件路由
  - [x] SubTask 8.1: GET /registry
  - [x] SubTask 8.2: GET /registry/:name
  - [x] SubTask 8.3: POST /registry/:name/install
  - [x] SubTask 8.4: POST /registry/:name/uninstall
  - [x] SubTask 8.5: POST /registry/:name/update
  - [x] SubTask 8.6: GET /updates
  - [x] SubTask 8.7: POST /registry/:name/rate

- [x] Task 9: 修改启动流程
  - [x] SubTask 9.1: server.ts 加载第三方插件

## Phase 5: 前端插件市场页面

- [x] Task 10: 创建插件市场前端
  - [x] SubTask 10.1: plugins.ts API 封装
  - [x] SubTask 10.2: PluginCard 组件
  - [x] SubTask 10.3: PluginMarketplace 组件
  - [x] SubTask 10.4: Settings 页面集成

## Phase 6: 集成测试与验证

- [x] Task 11: 验证
  - [x] SubTask 11.4: npm run check 通过（0 错误）
  - [x] SubTask 11.5: npm run lint 通过（0 错误）

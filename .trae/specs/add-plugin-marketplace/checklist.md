# 插件市场 Checklist

## Phase 1: 插件清单规范与数据模型

- [x] PluginMeta 接口扩展：包含 author、icon、screenshots、homepage、repository、keywords、category、permissions
- [x] PluginManifest Zod Schema 创建：验证 plugin.json 格式
- [x] 权限常量定义：graph:read/write、ai:read/write、study:read/write、scheduler:read/write、storage:read/write、network
- [x] 权限检查函数实现
- [x] installed_plugins 数据库表创建
- [x] plugin_ratings 数据库表创建
- [x] RLS 策略：用户只能管理自己安装的插件

## Phase 2: 插件存储与加载

- [x] PluginStoreService.install()：验证、写入文件、持久化到数据库
- [x] PluginStoreService.uninstall()：停用、清理、删除文件、删除数据库记录
- [x] PluginStoreService.update()：下载新版本、停用旧版、注册新版
- [x] 依赖解析和自动安装
- [x] 插件包文件管理（plugins/ 目录）
- [x] PluginLoader 启动时加载已安装插件
- [x] PluginLoader 运行时安装加载
- [x] PluginLoader 加载失败处理（error 状态）
- [x] Kernel.loadPluginFromManifest() 方法
- [x] Kernel.unregisterPlugin() 方法
- [x] Kernel.getPluginState() 方法

## Phase 3: 内置插件注册表

- [x] builtinPlugins.ts：3 个示例插件元数据
- [x] PluginRegistry 查询方法
- [x] PluginRegistry 搜索方法（关键词 + 分类）
- [x] markdown-exporter 示例插件包
- [x] daily-digest 示例插件包
- [x] graph-themes 示例插件包

## Phase 4: 插件管理 API 扩展

- [x] GET /api/plugins/registry 浏览可用插件
- [x] GET /api/plugins/registry/:name 插件详情
- [x] POST /api/plugins/registry/:name/install 安装插件
- [x] POST /api/plugins/registry/:name/uninstall 卸载插件
- [x] POST /api/plugins/registry/:name/update 更新插件
- [x] GET /api/plugins/updates 检查更新
- [x] POST /api/plugins/registry/:name/rate 评分
- [x] server.ts 启动时加载第三方插件

## Phase 5: 前端插件市场页面

- [x] 插件市场 API 封装（src/services/api/plugins.ts）
- [x] PluginCard 组件
- [x] PluginMarketplace 组件（浏览 + 已安装标签页）
- [x] Settings 页面添加"插件市场"标签页

## Phase 6: 集成测试与验证

- [x] npm run check 通过（0 错误）
- [x] npm run lint 通过（0 错误）

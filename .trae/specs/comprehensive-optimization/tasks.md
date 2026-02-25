# Tasks

## 第一阶段：性能优化 (P0)

- [x] Task 1: 实现大型图谱视口裁剪功能
  - [x] SubTask 1.1: 在 MindMapCanvas 中实现视口边界计算
  - [x] SubTask 1.2: 实现节点和边的视口过滤逻辑
  - [x] SubTask 1.3: 添加视口裁剪的性能测试
  - [x] SubTask 1.4: 优化视口更新频率，使用 requestAnimationFrame

- [x] Task 2: 实现图谱虚拟化渲染
  - [x] SubTask 2.1: 创建 VirtualizedGraphList 组件
  - [x] SubTask 2.2: 实现节点虚拟滚动逻辑
  - [x] SubTask 2.3: 添加虚拟化渲染的缓存机制
  - [x] SubTask 2.4: 测试 500+ 节点的渲染性能

- [x] Task 3: 优化 Three.js 组件性能
  - [x] SubTask 3.1: 将 NODE_COLORS 移到组件外部，使用 Object.freeze
  - [x] SubTask 3.2: 优化 useFrame 钩子，使用 ref 替代 state
  - [x] SubTask 3.3: 实现 Three.js 对象的内存清理
  - [x] SubTask 3.4: 添加 Three.js 渲染性能监控

- [x] Task 4: 为 AI 服务添加超时控制
  - [x] SubTask 4.1: 创建 withTimeout 工具函数
  - [x] SubTask 4.2: 在所有 AI 调用中应用超时控制（30秒）
  - [x] SubTask 4.3: 添加超时错误的友好提示
  - [x] SubTask 4.4: 实现 AI 请求的重试机制（最多3次）

- [x] Task 5: 实现 AI 请求去重
  - [x] SubTask 5.1: 创建请求去重的 Map 缓存
  - [x] SubTask 5.2: 实现 dedupedRequest 函数
  - [x] SubTask 5.3: 在 AI 服务中集成请求去重
  - [x] SubTask 5.4: 添加请求去重的单元测试

## 第二阶段：代码质量优化 (P0-P1)

- [x] Task 6: 启用 TypeScript 严格模式
  - [x] SubTask 6.1: 修改 tsconfig.json，启用 strict: true
  - [x] SubTask 6.2: 修复所有类型错误（noImplicitAny）
  - [x] SubTask 6.3: 修复所有空值检查错误（strictNullChecks）
  - [ ] SubTask 6.4: 启用 noUncheckedIndexedAccess 并修复相关问题
  - [ ] SubTask 6.5: 运行完整的类型检查，确保无错误

- [x] Task 7: 清理调试代码
  - [x] SubTask 7.1: 统计所有 console.log/error/warn 的使用位置
  - [x] SubTask 7.2: 创建统一的日志系统（logger.ts）
  - [x] SubTask 7.3: 替换生产环境的 console 调用为日志系统
  - [x] SubTask 7.4: 配置构建时移除所有 console 调用
  - [x] SubTask 7.5: 保留开发环境的必要调试日志

- [ ] Task 8: 拆分 MindMapCanvas 组件
  - [ ] SubTask 8.1: 分析 MindMapCanvas 的职责和依赖
  - [ ] SubTask 8.2: 创建 CanvasRenderer 子组件
  - [ ] SubTask 8.3: 创建 CanvasControls 子组件
  - [ ] SubTask 8.4: 提取 useCanvasInteraction hook
  - [ ] SubTask 8.5: 重构主组件，使用子组件组合
  - [ ] SubTask 8.6: 测试重构后的组件功能

- [ ] Task 9: 重构 GraphEditor 页面
  - [ ] SubTask 9.1: 创建 GraphEditorContext
  - [ ] SubTask 9.2: 提取 useGraphData hook
  - [ ] SubTask 9.3: 提取 useGraphSelection hook
  - [ ] SubTask 9.4: 创建 GraphViewport 组件
  - [ ] SubTask 9.5: 创建 GraphModals 组件
  - [ ] SubTask 9.6: 创建 GraphSidebars 组件
  - [ ] SubTask 9.7: 重构主页面，使用新组件结构

- [x] Task 10: 统一错误处理机制
  - [x] SubTask 10.1: 创建 AppError 基类
  - [x] SubTask 10.2: 创建 handleApiError 函数
  - [x] SubTask 10.3: 创建全局错误边界组件
  - [x] SubTask 10.4: 在所有 API 调用中应用统一错误处理
  - [x] SubTask 10.5: 添加错误上报机制

## 第三阶段：缓存与性能优化 (P1)

- [x] Task 11: 优化 React Query 缓存策略
  - [x] SubTask 11.1: 创建 usePrefetchGraph hook
  - [x] SubTask 11.2: 在图谱列表页实现预取
  - [x] SubTask 11.3: 创建 useBatchGraphStatus hook
  - [x] SubTask 11.4: 优化查询键设计
  - [x] SubTask 11.5: 添加查询缓存失效策略

- [ ] Task 12: 实现缓存预热
  - [ ] SubTask 12.1: 创建 warmupUserCache 函数
  - [ ] SubTask 12.2: 在用户登录时触发缓存预热
  - [ ] SubTask 12.3: 实现常用数据的预加载
  - [ ] SubTask 12.4: 测试缓存预热效果

- [ ] Task 13: 实现缓存标签系统
  - [ ] SubTask 13.1: 定义缓存标签结构
  - [ ] SubTask 13.2: 实现 invalidateByTag 函数
  - [ ] SubTask 13.3: 在数据变更时按标签失效缓存
  - [ ] SubTask 13.4: 测试缓存标签系统

- [x] Task 14: 优化 Zustand store
  - [x] SubTask 14.1: 添加 persist 中间件
  - [x] SubTask 14.2: 配置状态持久化策略
  - [x] SubTask 14.3: 添加 devtools 中间件
  - [x] SubTask 14.4: 合并相关 store
  - [x] SubTask 14.5: 测试状态持久化功能

## 第四阶段：测试覆盖率提升 (P1)

- [x] Task 15: 添加核心业务逻辑单元测试
  - [x] SubTask 15.1: 为 graphUtils 添加单元测试
  - [x] SubTask 15.2: 为 markdownParser 添加单元测试
  - [x] SubTask 15.3: 为 exportUtils 添加单元测试
  - [x] SubTask 15.4: 为 AI 服务工具函数添加单元测试
  - [x] SubTask 15.5: 确保测试覆盖率达到 60%

- [ ] Task 16: 添加关键组件集成测试
  - [ ] SubTask 16.1: 为 MindMapNode 添加集成测试
  - [ ] SubTask 16.2: 为 TaskCard 添加集成测试
  - [ ] SubTask 16.3: 为 GlobalSearch 添加集成测试
  - [ ] SubTask 16.4: 为 RAGChat 添加集成测试

- [ ] Task 17: 添加 E2E 测试
  - [ ] SubTask 17.1: 设置 E2E 测试环境（Playwright/Cypress）
  - [ ] SubTask 17.2: 编写用户登录流程测试
  - [ ] SubTask 17.3: 编写图谱创建流程测试
  - [ ] SubTask 17.4: 编写任务管理流程测试

## 第五阶段：构建与部署优化 (P2)

- [x] Task 18: 优化 Vite 构建配置
  - [x] SubTask 18.1: 细化 manualChunks 分割策略
  - [x] SubTask 18.2: 启用 terser 压缩
  - [x] SubTask 18.3: 配置生产环境移除 console
  - [x] SubTask 18.4: 优化 experimentalMinChunkSize
  - [x] SubTask 18.5: 测试构建产物大小

- [ ] Task 19: 优化 PWA 缓存策略
  - [ ] SubTask 19.1: 细化 runtimeCaching 配置
  - [ ] SubTask 19.2: 为静态资源使用 CacheFirst
  - [ ] SubTask 19.3: 为 API 请求使用 NetworkFirst
  - [ ] SubTask 19.4: 为 AI 接口使用 NetworkOnly
  - [ ] SubTask 19.5: 测试离线功能

- [ ] Task 20: 优化资源加载
  - [ ] SubTask 20.1: 实现图片懒加载
  - [ ] SubTask 20.2: 优化字体加载策略
  - [ ] SubTask 20.3: 使用现代图片格式（WebP）
  - [ ] SubTask 20.4: 配置资源预加载

## 第六阶段：文档与开发体验 (P2)

- [ ] Task 21: 完善项目文档
  - [ ] SubTask 21.1: 更新 README.md
  - [ ] SubTask 21.2: 编写组件开发指南
  - [ ] SubTask 21.3: 编写 API 文档
  - [ ] SubTask 21.4: 编写部署文档

- [ ] Task 22: 优化开发工具配置
  - [ ] SubTask 22.1: 配置 ESLint 规则
  - [ ] SubTask 22.2: 配置 Prettier 代码格式化
  - [ ] SubTask 22.3: 配置 Git hooks（husky + lint-staged）
  - [ ] SubTask 22.4: 配置 VS Code 工作区设置

- [ ] Task 23: 提取公共工具函数
  - [ ] SubTask 23.1: 分析重复代码模式
  - [ ] SubTask 23.2: 创建公共 hooks 目录
  - [ ] SubTask 23.3: 创建公共组件目录
  - [ ] SubTask 23.4: 创建公共工具函数目录
  - [ ] SubTask 23.5: 重构代码使用公共工具

## Task Dependencies

- [Task 2] depends on [Task 1] - 虚拟化渲染依赖视口裁剪基础
- [Task 8] depends on [Task 1, Task 2] - 组件拆分依赖性能优化完成
- [Task 9] depends on [Task 8] - GraphEditor 重构依赖 MindMapCanvas 拆分
- [Task 11] depends on [Task 10] - React Query 优化依赖错误处理统一
- [Task 12, Task 13] depends on [Task 11] - 缓存优化依赖 React Query 基础
- [Task 16] depends on [Task 8, Task 9] - 组件测试依赖组件重构完成
- [Task 18] depends on [Task 6] - 构建优化依赖 TypeScript 严格模式

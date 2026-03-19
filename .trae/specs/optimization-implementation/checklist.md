# 项目优化实施验证检查清单

## Task 1: 重构 updateTaskStatus 方法
- [ ] `updateTaskStatus` 方法已重构为对象参数模式
- [ ] 保持了向后兼容性
- [ ] TypeScript 编译无错误
- [ ] 所有现有测试通过

## Task 2: 添加数据库索引
- [ ] 已创建索引添加 SQL 脚本
- [ ] 索引脚本可正确执行
- [ ] 已添加到 Supabase 迁移文件
- [ ] 查询分析显示性能提升

## Task 3: 修复 getGraphNodes 缓存
- [ ] `getGraphNodes` 已使用 cacheService
- [ ] 缓存键设计合理
- [ ] 缓存失效逻辑正确
- [ ] 重复查询命中缓存

## Task 4: 优化 useStore 使用
- [ ] 所有 useStore 调用使用 select 函数
- [ ] 只获取需要的状态
- [ ] 减少了不必要的组件重渲染
- [ ] 应用运行正常

## Task 5: 补充认证服务测试
- [ ] jwtService.test.ts 已创建
- [ ] passwordService.test.ts 已创建
- [ ] 测试覆盖主要功能
- [ ] 测试覆盖边界情况
- [ ] 测试能正常运行
- [ ] 测试覆盖率达到 80%+

## Task 6: 补充图服务核心测试
- [ ] graphService.test.ts 已创建
- [ ] graphNodeService.test.ts 已创建
- [ ] 使用了 mock Supabase 客户端
- [ ] 覆盖主要 CRUD 操作
- [ ] 测试能正常运行
- [ ] 测试覆盖率达到 70%+

## Task 7: 清理调试日志
- [ ] 生产环境中的 console.log 已移除
- [ ] 保留了必要的 warn/error/info 日志
- [ ] 错误处理完整
- [ ] lint 检查通过
- [ ] 生产构建无调试代码

## Task 8: 替换部分 any 类型
- [ ] Task 接口中的 any 已替换为 unknown
- [ ] 为常用 payload 定义了具体类型
- [ ] 减少了 any 使用数量
- [ ] TypeScript 编译无错误
- [ ] @typescript-eslint/no-explicit-any 警告减少

## 整体验证
- [ ] npm run check 通过
- [ ] npm run lint 通过
- [ ] npm run test 通过
- [ ] npm run build 通过
- [ ] 应用功能正常运行

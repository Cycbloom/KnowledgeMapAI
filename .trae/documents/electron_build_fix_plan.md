# Electron 构建后加载本地资源问题的修复计划

## 问题分析
在构建 Electron 桌面应用后，出现 "Not allowed to load local resource: file:///D:/KnowledgeMapApp/resources/dist/index.html" 错误。

### 根本原因
1. 主进程代码中的 `getDistPath()` 函数在打包后可能返回错误的路径
2. `package.json` 中的 `build.files` 配置与实际文件位置不匹配
3. 缺少对前端资源打包的正确处理

## [ ] 任务 1: 检查并修复主进程路径解析逻辑
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 修改 `electron/main.ts` 中的 `getDistPath()` 函数
  - 确保在打包后正确解析 dist 目录位置
  - 添加调试日志以便更好地诊断问题
- **Success Criteria**:
  - 打包后能够正确找到并加载 index.html
  - 路径解析逻辑在开发和生产环境都正常工作
- **Test Requirements**:
  - `programmatic` TR-1.1: 通过代码审查确认路径解析逻辑正确
  - `human-judgement` TR-1.2: 主进程日志显示正确的文件路径

## [ ] 任务 2: 检查并修复 package.json 中的 build.files 配置
- **Priority**: P0
- **Depends On**: None
- **Description**:
  - 确保 `dist` 目录被正确包含在打包文件中
  - 验证 `electron-builder` 配置的其他关键部分
- **Success Criteria**:
  - 打包后的应用包含完整的前端资源
  - 文件结构正确
- **Test Requirements**:
  - `programmatic` TR-2.1: 检查 build 配置语法正确
  - `human-judgement` TR-2.2: 验证打包后 app.asar 包含所需文件

## [ ] 任务 3: 创建测试构建并验证修复
- **Priority**: P1
- **Depends On**: [任务 1, 任务 2]
- **Description**:
  - 执行完整的 Electron 构建
  - 运行构建后的应用进行验证
- **Success Criteria**:
  - 应用能够正常启动
  - 不出现 "Not allowed to load local resource" 错误
  - 前端界面正常显示
- **Test Requirements**:
  - `human-judgement` TR-3.1: 验证应用启动和界面显示
  - `programmatic` TR-3.2: 控制台无错误信息

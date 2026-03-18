# Electron 资源路径配置修复 - The Implementation Plan (Decomposed and Prioritized Task List)

## [ ] Task 1: 分析并修复 Vite 配置的 base 路径
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 检查当前 vite.config.ts 的 base 配置
  - 确认在 Electron 构建时使用正确的相对路径
  - 确保 Vite 构建的资源路径是相对于 index.html 的
- **Acceptance Criteria Addressed**: [AC-1, AC-2]
- **Test Requirements**:
  - `programmatic` TR-1.1: Vite 构建后的 index.html 中的资源引用使用相对路径
  - `human-judgement` TR-1.2: 检查 dist/index.html 的资源引用是否正确
- **Notes**: 重点关注 base 配置，对于 Electron 应该使用 "./"

## [ ] Task 2: 检查并修复 Electron Builder 的资源配置
- **Priority**: P0
- **Depends On**: Task 1
- **Description**: 
  - 检查 package.json 中 electron-builder 的配置
  - 确认 dist 目录被正确复制到打包后的应用中
  - 检查 asar 配置是否影响资源加载
- **Acceptance Criteria Addressed**: [AC-1, AC-2]
- **Test Requirements**:
  - `programmatic` TR-2.1: 检查 package.json 中的 build 配置
  - `human-judgement` TR-2.2: 验证资源文件是否被正确打包
- **Notes**: 特别关注 files 和 extraResources 配置

## [ ] Task 3: 移除 fix-relative-paths.cjs 脚本
- **Priority**: P0
- **Depends On**: Task 2
- **Description**: 
  - 从 package.json 的构建脚本中移除对 fix-relative-paths.cjs 的调用
  - 删除 scripts/fix-relative-paths.cjs 文件
- **Acceptance Criteria Addressed**: [AC-3]
- **Test Requirements**:
  - `programmatic` TR-3.1: 确认 build:electron 脚本不再调用该文件
  - `programmatic` TR-3.2: 确认 scripts/fix-relative-paths.cjs 文件已删除
- **Notes**: 确保完全移除这个临时方案

## [ ] Task 4: 重新构建并验证
- **Priority**: P1
- **Depends On**: Task 3
- **Description**: 
  - 运行 npm run electron:build
  - 验证构建过程正常
  - 验证打包后的应用可以正确加载资源
- **Acceptance Criteria Addressed**: [AC-1, AC-2, AC-3]
- **Test Requirements**:
  - `programmatic` TR-4.1: 构建过程没有错误
  - `human-judgement` TR-4.2: 安装并测试应用，确认资源加载正常
- **Notes**: 需要实际安装测试

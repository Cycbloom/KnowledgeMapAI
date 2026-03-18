# Electron 资源路径配置修复 - Product Requirement Document

## Overview
- **Summary**: 修复 Electron 应用打包后安装在其他目录时资源文件找不到的问题，移除临时的 `fix-relative-paths.cjs` 脚本，采用正确的配置方案。
- **Purpose**: 解决 Electron 桌面应用安装在任意目录后，前端资源（JS、CSS、字体等）无法正确加载的问题。
- **Target Users**: KnowledgeMap 桌面应用用户

## Goals
- 彻底解决 Electron 打包后的资源路径问题
- 移除临时的、不可维护的 fix-relative-paths.cjs 脚本
- 确保应用可以安装在任意目录下正常运行
- 使用正确的 Vite 配置和 Electron 打包配置来解决问题

## Non-Goals (Out of Scope)
- 不修改应用的业务逻辑
- 不添加新功能
- 不重构整个应用架构

## Background & Context
- 当前问题：Electron 打包应用安装在其他目录时，前端资源使用绝对路径或错误的相对路径，导致 `file:///D:/assets/vendor-katex-BzjkycI_.css net::ERR_FILE_NOT_FOUND` 等错误
- 临时解决方案：使用 `fix-relative-paths.cjs` 脚本在构建后修改路径，这不是一个好的长期解决方案
- 根本原因：Vite 配置的 base 路径和 Electron 打包配置的资源路径没有正确配合

## Functional Requirements
- **FR-1**: Electron 应用可以安装在任意 Windows 目录下正常运行
- **FR-2**: 所有前端资源（JS、CSS、字体、图标等）都能正确加载
- **FR-3**: 移除 fix-relative-paths.cjs 脚本，不再使用临时修复方案

## Non-Functional Requirements
- **NFR-1**: 构建过程不应该有手动脚本干预
- **NFR-2**: 应用启动时资源加载应该正常，没有控制台错误
- **NFR-3**: 开发模式和生产模式（Electron 打包）都应该正常工作

## Constraints
- **Technical**: 必须使用 Vite + Electron + Electron Builder 技术栈
- **Business**: 必须保持当前的目录结构和架构
- **Dependencies**: 依赖 Vite、Electron、Electron Builder 的正确配置

## Assumptions
- 用户希望从根目录解决问题，而不是用临时脚本
- Vite 配置的 base 参数和 Electron Builder 的配置可以正确配合解决资源路径问题

## Acceptance Criteria

### AC-1: Electron 应用可以安装在任意目录下正常运行
- **Given**: 用户下载并运行 KnowledgeMap 安装程序
- **When**: 用户选择任意目录安装并启动应用
- **Then**: 应用正常启动，所有资源正确加载
- **Verification**: `human-judgment`
- **Notes**: 需要测试安装在不同目录的情况

### AC-2: 所有前端资源都能正确加载
- **Given**: Electron 应用正在运行
- **When**: 检查浏览器控制台
- **Then**: 没有资源加载错误（如 net::ERR_FILE_NOT_FOUND）
- **Verification**: `programmatic`

### AC-3: 不再使用 fix-relative-paths.cjs 脚本
- **Given**: 查看 package.json 中的构建脚本
- **When**: 执行 npm run electron:build
- **Then**: 构建过程不调用 fix-relative-paths.cjs
- **Verification**: `programmatic`

## Open Questions
- [ ] Vite 的 base 配置应该是什么值？
- [ ] Electron Builder 的 asar 配置是否需要调整？
- [ ] 是否需要修改 dist 目录的结构？

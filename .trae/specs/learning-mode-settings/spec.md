# 闯关学习模式设置 - Product Requirement Document

## Overview
- **Summary**: 为闯关学习模式添加阅读设置功能，允许用户自定义字体大小、阅读模式、分页方式等，提供更舒适的学习阅读体验。
- **Purpose**: 解决不同用户在阅读学习资料时的个性化需求，提升阅读体验和学习效率。
- **Target Users**: 所有使用闯关学习模式进行学习的用户。

## Goals
- 提供字体大小调整功能
- 支持阅读模式切换（如护眼模式、深色模式）
- 支持分页方式选择（滚轮滚动、翻页模式）
- 设置自动保存到本地存储
- 提供直观的设置面板 UI

## Non-Goals (Out of Scope)
- 不实现字体类型选择（使用系统默认字体）
- 不实现复杂的排版布局调整
- 不实现云端同步设置功能

## Background & Context
- 当前闯关学习模式位于 `src/pages/LearningMode.tsx`
- 学习资料使用 ReactMarkdown 渲染，位于 `prose prose-lg dark:prose-invert` 容器中
- 项目使用 Zustand 进行状态管理，已有持久化存储的模式
- 项目使用 Tailwind CSS 进行样式开发

## Functional Requirements
- **FR-1**: 用户可以通过滑块或按钮调整字体大小（12px - 24px）
- **FR-2**: 用户可以切换阅读模式（默认/护眼/深色）
- **FR-3**: 用户可以选择分页方式（滚动/翻页）
- **FR-4**: 设置面板可以打开/关闭
- **FR-5**: 所有设置自动保存到 localStorage，下次打开应用时恢复
- **FR-6**: 设置面板包含重置默认设置功能

## Non-Functional Requirements
- **NFR-1**: 设置调整后立即生效，无明显延迟
- **NFR-2**: 设置面板 UI 与现有设计风格一致
- **NFR-3**: 支持移动端和桌面端显示
- **NFR-4**: 持久化存储在 500ms 内完成

## Constraints
- **Technical**: 使用现有的 Zustand 状态管理方案，使用 Tailwind CSS 进行样式，与现有代码风格保持一致
- **Business**: 不引入新的第三方依赖库
- **Dependencies**: 依赖现有的 ReactMarkdown 渲染组件

## Assumptions
- 用户浏览器支持 localStorage
- 现有主题切换功能与阅读模式可以共存
- 所有用户都有个性化阅读设置的需求

## Acceptance Criteria

### AC-1: 字体大小调整
- **Given**: 用户在闯关学习模式页面
- **When**: 用户在设置面板中调整字体大小滑块
- **Then**: 学习资料区域的字体大小立即更新
- **Verification**: `programmatic`

### AC-2: 阅读模式切换
- **Given**: 用户在闯关学习模式页面
- **When**: 用户选择不同的阅读模式选项
- **Then**: 学习资料区域的背景色、文字颜色等样式立即更新
- **Verification**: `programmatic`

### AC-3: 分页方式选择
- **Given**: 用户在闯关学习模式页面
- **When**: 用户选择不同的分页方式
- **Then**: 学习资料区域的滚动行为相应变化
- **Verification**: `programmatic`

### AC-4: 设置持久化
- **Given**: 用户修改了任意设置
- **When**: 用户刷新页面或重新打开应用
- **Then**: 之前的设置被自动恢复
- **Verification**: `programmatic`

### AC-5: 设置面板打开/关闭
- **Given**: 用户在闯关学习模式页面
- **When**: 用户点击设置按钮
- **Then**: 设置面板平滑打开/关闭
- **Verification**: `human-judgment`

### AC-6: 重置默认设置
- **Given**: 用户已修改过设置
- **When**: 用户点击重置按钮
- **Then**: 所有设置恢复到默认值
- **Verification**: `programmatic`

## Open Questions
- [ ] 是否需要实现行间距调整功能？
- [ ] 是否需要实现字重调整功能？

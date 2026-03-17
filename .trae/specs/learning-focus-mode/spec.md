# 闯关学习专注模式 Spec

## Why
用户在闯关学习模式下需要一个沉浸式的学习环境，通过白噪声背景音乐和智能文本高亮功能来提升专注力和学习效率。同时需要与现有的悬浮番茄钟进行联动，形成完整的学习闭环。

## What Changes
- 在闯关学习页面 (`LearningMode.tsx`) 中集成专注模式入口
- 复用并扩展现有的白噪声功能（雨声、咖啡厅、森林、海浪、篝火）
- 实现专注模式与悬浮番茄钟 (`FocusTimer.tsx`) 的双向联动
- 开发 AI 驱动的阅读材料智能高亮功能，自动识别并突出显示重点内容
- 新增专注模式状态管理，与 `useFocusStore` 整合

## Impact
- Affected specs: 闯关学习模式、番茄钟系统、专注模式
- Affected code:
  - `src/pages/LearningMode.tsx` - 集成专注模式入口和阅读高亮
  - `src/components/common/FocusTimer.tsx` - 增强与专注模式的联动
  - `src/components/Scheduler/FocusMode.tsx` - 扩展白噪声功能
  - `src/store/useFocusStore.ts` - 新增专注模式相关状态
  - `src/services/api/ai.ts` - 新增文本重点分析 API
  - `src/components/Learning/HighlightedReader.tsx` - 新增高亮阅读器组件

## ADDED Requirements

### Requirement: 专注模式入口
系统 SHALL 在闯关学习页面的头部工具栏提供专注模式入口按钮。

#### Scenario: 启动专注模式
- **WHEN** 用户点击"进入专注模式"按钮
- **THEN** 系统进入全屏专注模式，显示当前阅读材料
- **AND** 自动启动选定的白噪声背景音乐
- **AND** 与悬浮番茄钟状态同步（若番茄钟正在计时，则保持计时状态）

#### Scenario: 退出专注模式
- **WHEN** 用户按下 ESC 键或点击退出按钮
- **THEN** 系统退出专注模式
- **AND** 白噪声停止播放
- **AND** 番茄钟状态保持不变

### Requirement: 白噪声背景音乐
系统 SHALL 提供多种白噪声选项供用户选择。

#### Scenario: 选择白噪声
- **GIVEN** 用户已进入专注模式
- **WHEN** 用户选择一种白噪声类型（雨声、咖啡厅、森林、海浪、篝火）
- **THEN** 系统开始播放对应的白噪声
- **AND** 用户可调节音量大小

#### Scenario: 记住白噪声偏好
- **GIVEN** 用户选择了某种白噪声
- **WHEN** 用户下次进入专注模式
- **THEN** 系统自动应用上次选择的白噪声设置

### Requirement: 番茄钟联动
系统 SHALL 实现专注模式与悬浮番茄钟的双向联动。

#### Scenario: 专注模式启动番茄钟
- **GIVEN** 番茄钟未启动
- **WHEN** 用户在专注模式中点击"开始专注"按钮
- **THEN** 番茄钟开始计时
- **AND** 悬浮番茄钟组件同步显示计时状态

#### Scenario: 番茄钟状态同步
- **GIVEN** 番茄钟正在计时
- **WHEN** 用户进入专注模式
- **THEN** 专注模式显示当前番茄钟计时状态
- **AND** 用户可在专注模式中暂停/继续计时

#### Scenario: 专注时段完成
- **WHEN** 番茄钟计时结束
- **THEN** 系统播放提示音（若开启）
- **AND** 显示休息提醒
- **AND** 记录本次专注会话到数据库

### Requirement: 智能文本高亮
系统 SHALL 使用 AI 分析阅读材料，自动识别并高亮显示重点内容。

#### Scenario: 自动分析重点
- **GIVEN** 用户正在阅读学习材料
- **WHEN** 用户开启"智能高亮"功能
- **THEN** 系统 AI 分析文本内容
- **AND** 识别关键概念、定义、重要论述
- **AND** 对重点内容应用视觉高亮效果

#### Scenario: 高亮样式
- **GIVEN** AI 已识别出重点内容
- **WHEN** 渲染阅读材料
- **THEN** 重点内容以醒目颜色标记（如黄色背景或红色下划线）
- **AND** 鼠标悬停显示 AI 提供的重点解释
- **AND** 非重点内容保持正常显示

#### Scenario: 高亮范围控制
- **GIVEN** 智能高亮已开启
- **WHEN** 用户调整"高亮强度"滑块
- **THEN** 系统调整高亮内容的数量（高亮强度越高，高亮内容越多）

#### Scenario: 眼睛焦点追踪（可选增强）
- **GIVEN** 用户开启焦点追踪功能
- **WHEN** 用户阅读文本时
- **THEN** 系统检测用户当前阅读位置
- **AND** 当前段落/句子获得视觉焦点
- **AND** 周围内容略微淡化以减少干扰

### Requirement: 专注模式设置持久化
系统 SHALL 持久化用户的专注模式偏好设置。

#### Scenario: 保存设置
- **WHEN** 用户更改专注模式设置（白噪声类型、音量、高亮强度）
- **THEN** 系统将设置保存到本地存储
- **AND** 下次进入时自动应用

## MODIFIED Requirements

### Requirement: FocusTimer 组件增强
现有的悬浮番茄钟组件 SHALL 支持与专注模式的联动。

- 新增 `isInFocusMode` 状态显示
- 在专注模式下隐藏悬浮组件（因为专注模式内有独立计时器）
- 支持从悬浮组件快速进入专注模式

### Requirement: FocusMode 组件增强
现有的专注模式组件 SHALL 支持阅读材料展示和智能高亮。

- 支持嵌入阅读材料组件
- 集成智能高亮功能
- 与番茄钟状态同步

## REMOVED Requirements
无移除的需求。

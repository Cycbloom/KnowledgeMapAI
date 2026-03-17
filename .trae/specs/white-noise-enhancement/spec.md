# 白噪音功能增强 Spec

## Why
当前专注模式的白噪音种类较少（仅5种），且使用简单的 Web Audio API 合成声音，音质和真实感有限。用户需要更丰富、更真实的环境声音来提升专注体验。

## What Changes
- 扩展白噪音类型，从 5 种增加到 15+ 种
- 改进声音合成算法，使声音更加真实自然
- 新增声音混合功能，支持同时播放多种声音
- 新增预设场景组合（如"雨天阅读"、"深夜工作"等）
- 新增声音可视化效果

## Impact
- Affected specs: 闯关学习专注模式、专注模式状态管理
- Affected code:
  - `src/store/useFocusStore.ts` - 扩展白噪音类型定义和混合状态
  - `src/components/Learning/LearningFocusPanel.tsx` - 更新白噪音选择器 UI
  - `src/components/Scheduler/FocusMode.tsx` - 更新白噪音选择器 UI
  - `src/hooks/useWhiteNoise.ts` - 新增白噪音管理 Hook（抽取公共逻辑）
  - `src/utils/audioSynthesis.ts` - 新增声音合成工具函数

## ADDED Requirements

### Requirement: 扩展白噪音类型
系统 SHALL 提供更丰富的白噪音类型选择。

#### Scenario: 白噪音分类
- **GIVEN** 用户进入专注模式设置
- **WHEN** 用户查看白噪音选项
- **THEN** 系统按分类展示白噪音：
  - **自然类**：雨声、雷声、海浪、溪流、风声、森林、篝火
  - **环境类**：咖啡厅、图书馆、夜晚、火车、飞机
  - **冥想类**：钵音、风铃、呼吸引导、白噪声、粉噪声

#### Scenario: 选择白噪音
- **GIVEN** 用户已进入专注模式
- **WHEN** 用户选择一种白噪音类型
- **THEN** 系统播放对应的环境声音
- **AND** 声音循环播放直到用户切换或退出

### Requirement: 声音混合功能
系统 SHALL 支持同时播放多种白噪音并进行混合。

#### Scenario: 混合多种声音
- **GIVEN** 用户已选择一种白噪音
- **WHEN** 用户再选择另一种白噪音
- **THEN** 系统同时播放两种声音
- **AND** 用户可独立调节每种声音的音量

#### Scenario: 调整混合比例
- **GIVEN** 用户已混合多种声音
- **WHEN** 用户调整某一种声音的音量滑块
- **THEN** 该声音的音量相应变化
- **AND** 其他声音不受影响

#### Scenario: 移除混合声音
- **GIVEN** 用户已混合多种声音
- **WHEN** 用户点击某声音的移除按钮
- **THEN** 该声音停止播放
- **AND** 从混合列表中移除

### Requirement: 预设场景组合
系统 SHALL 提供预设的声音组合场景。

#### Scenario: 选择预设场景
- **GIVEN** 用户进入白噪音设置
- **WHEN** 用户选择预设场景（如"雨天阅读"）
- **THEN** 系统自动加载对应的混合声音配置
  - "雨天阅读"：雨声(60%) + 雷声(20%) + 咖啡厅(20%)
  - "深夜工作"：夜晚(70%) + 钵音(30%)
  - "森林冥想"：森林(50%) + 溪流(30%) + 风铃(20%)
  - "海边放松"：海浪(80%) + 海鸥(20%)

#### Scenario: 保存自定义预设
- **GIVEN** 用户已创建满意的声音混合
- **WHEN** 用户点击"保存为预设"
- **THEN** 系统保存当前混合配置
- **AND** 用户可为预设命名
- **AND** 预设出现在预设列表中

### Requirement: 改进声音合成质量
系统 SHALL 使用更高级的合成算法生成更真实的环境声音。

#### Scenario: 雨声合成
- **GIVEN** 用户选择雨声
- **WHEN** 系统播放雨声
- **THEN** 使用多层噪声叠加：
  - 底层：低频雨滴背景
  - 中层：中频雨滴落地声
  - 高层：高频水滴溅射声
- **AND** 添加随机变化模拟真实雨声

#### Scenario: 海浪合成
- **GIVEN** 用户选择海浪
- **WHEN** 系统播放海浪声
- **THEN** 使用周期性滤波模拟海浪起伏
- **AND** 添加随机泡沫声细节

#### Scenario: 森林合成
- **GIVEN** 用户选择森林
- **WHEN** 系统播放森林声
- **THEN** 混合多种元素：
  - 风吹树叶声（低频噪声）
  - 鸟鸣声（随机高频音调）
  - 昆虫声（细微高频）

### Requirement: 声音可视化
系统 SHALL 提供声音波形可视化效果。

#### Scenario: 显示波形
- **GIVEN** 白噪音正在播放
- **WHEN** 用户查看专注模式界面
- **THEN** 显示实时音频波形动画
- **AND** 波形随声音节奏变化

#### Scenario: 波形样式
- **GIVEN** 声音可视化已启用
- **WHEN** 不同类型的白噪音播放
- **THEN** 显示不同风格的波形：
  - 雨声：细密波纹
  - 海浪：缓慢起伏
  - 森林：随机波动

### Requirement: 状态持久化
系统 SHALL 持久化用户的白噪音偏好。

#### Scenario: 保存混合配置
- **WHEN** 用户调整白噪音混合配置
- **THEN** 系统自动保存配置到本地存储
- **AND** 下次进入时自动恢复

#### Scenario: 记住最近使用
- **WHEN** 用户退出专注模式
- **THEN** 系统记录最近使用的声音组合
- **AND** 下次进入时自动应用

## MODIFIED Requirements

### Requirement: useFocusStore 状态扩展
现有的专注模式状态管理 SHALL 支持新的白噪音功能。

- 新增 `mixedNoises` 状态：当前混合的声音列表
- 新增 `customPresets` 状态：用户自定义预设
- 新增 `activePreset` 状态：当前激活的预设
- 扩展 `WhiteNoiseType` 类型定义

### Requirement: 白噪音选择器 UI 更新
现有的白噪音选择器 SHALL 支持分类展示和混合功能。

- 支持分类折叠展示
- 支持多选模式
- 显示每个声音的独立音量控制
- 显示预设场景选择入口

## REMOVED Requirements
无移除的需求。

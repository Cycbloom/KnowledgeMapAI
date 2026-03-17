# Tasks

- [x] Task 1: 扩展白噪音类型定义和状态管理
  - [x] SubTask 1.1: 扩展 `WhiteNoiseType` 类型，新增 10+ 种白噪音类型
  - [x] SubTask 1.2: 在 `useFocusStore` 中添加 `mixedNoises` 状态（混合声音列表）
  - [x] SubTask 1.3: 在 `useFocusStore` 中添加 `customPresets` 状态（自定义预设）
  - [x] SubTask 1.4: 在 `useFocusStore` 中添加 `activePreset` 状态（当前激活预设）
  - [x] SubTask 1.5: 实现混合声音的增删改查方法
  - [x] SubTask 1.6: 实现预设的保存和加载方法

- [x] Task 2: 创建声音合成工具模块
  - [x] SubTask 2.1: 创建 `src/utils/audioSynthesis.ts` 文件
  - [x] SubTask 2.2: 实现基础噪声生成器（白噪声、粉噪声、棕噪声）
  - [x] SubTask 2.3: 实现自然声音合成器（雨声、雷声、海浪、溪流、风声、森林、篝火）
  - [x] SubTask 2.4: 实现环境声音合成器（咖啡厅、图书馆、夜晚、火车、飞机）
  - [x] SubTask 2.5: 实现冥想声音合成器（钵音、风铃、呼吸引导）
  - [x] SubTask 2.6: 实现声音混合器（支持多轨道混合）

- [x] Task 3: 创建白噪音管理 Hook
  - [x] SubTask 3.1: 创建 `src/hooks/useWhiteNoise.ts` 文件
  - [x] SubTask 3.2: 实现音频上下文初始化
  - [x] SubTask 3.3: 实现单声音播放/停止逻辑
  - [x] SubTask 3.4: 实现多声音混合播放逻辑
  - [x] SubTask 3.5: 实现音量控制逻辑
  - [x] SubTask 3.6: 实现预设加载逻辑
  - [x] SubTask 3.7: 实现声音可视化数据输出

- [x] Task 4: 更新 LearningFocusPanel 组件
  - [x] SubTask 4.1: 重构白噪音选择器 UI，支持分类展示
  - [x] SubTask 4.2: 实现多选混合模式 UI
  - [x] SubTask 4.3: 实现每个声音的独立音量控制
  - [x] SubTask 4.4: 实现预设场景选择面板
  - [x] SubTask 4.5: 实现自定义预设保存功能
  - [x] SubTask 4.6: 集成声音可视化组件

- [x] Task 5: 更新 Scheduler FocusMode 组件
  - [x] SubTask 5.1: 重构白噪音选择器 UI，支持分类展示
  - [x] SubTask 5.2: 实现多选混合模式 UI
  - [x] SubTask 5.3: 实现预设场景选择面板
  - [x] SubTask 5.4: 保持与 LearningFocusPanel 的一致性

- [x] Task 6: 创建声音可视化组件
  - [x] SubTask 6.1: 创建 `src/components/common/AudioVisualizer.tsx` 组件
  - [x] SubTask 6.2: 实现波形可视化效果
  - [x] SubTask 6.3: 实现不同声音类型的波形样式
  - [x] SubTask 6.4: 优化性能（使用 requestAnimationFrame）

- [x] Task 7: 测试与优化
  - [x] SubTask 7.1: 测试各种声音合成效果
  - [x] SubTask 7.2: 测试多声音混合功能
  - [x] SubTask 7.3: 测试预设保存和加载
  - [x] SubTask 7.4: 测试状态持久化
  - [x] SubTask 7.5: 性能优化（CPU 占用、内存管理）

# Task Dependencies
- [Task 2] depends on [Task 1] (需要类型定义)
- [Task 3] depends on [Task 1, Task 2] (需要类型定义和合成工具)
- [Task 4] depends on [Task 1, Task 3, Task 6] (需要状态管理、Hook 和可视化组件)
- [Task 5] depends on [Task 1, Task 3] (需要状态管理和 Hook)
- [Task 6] depends on [Task 3] (需要可视化数据)
- [Task 7] depends on [Task 1, Task 2, Task 3, Task 4, Task 5, Task 6]

# 专注模式设置页面 — 实施计划

## 概述

在全局设置页面 (`Settings.tsx`) 中新增"专注模式"配置区块，让用户可以自定义番茄钟的所有参数。同时统一配置来源，消除当前 `useFocusStore`（localStorage）与 `useTimerStore`（硬编码）之间的不一致。

## 当前状态分析

### 问题 1：配置分散且不完整
- **`useFocusStore`**（localStorage）存储了 6 个字段：`focusDuration`、`shortBreakDuration`、`longBreakDuration`、`soundEnabled`、`highlightEnabled`、`highlightIntensity`
- **缺失字段**：`longBreakInterval`（长休间隔）、`autoStartBreak`（自动开始休息）、`autoStartPomodoro`（自动开始专注）、`notificationEnabled`（通知）
- **`useTimerStore`** 中 `longBreakInterval` 硬编码为 `4`（第 154 行：`completedSessions % 4 === 0`）

### 问题 2：已有但废弃的设置组件
- **`PomodoroSettings.tsx`**：一个弹窗式设置组件，UI 较完善但未被任何地方引用
- **关键 bug**：`handleSave` 只保存了 4 个参数到 API（`q0_time_slice`、`break_duration`、`sound_enabled`、`notification_enabled`），`longBreakDuration`、`pomodorosUntilLongBreak`、`autoStartPomodoro`、`autoStartBreak` 未持久化
- 该组件使用 `api.scheduler.updateSettings()` 保存到 Supabase，与 `useFocusStore` 的 localStorage 方案不同

### 问题 3：Settings.tsx 无专注模式区块
- 当前设置页有：外观、主题配色、语言、AI 服务密钥、AI 状态与配置、数据库配置、移动端 AI 配置、学习策略、插件市场
- 没有任何专注模式/番茄钟相关的设置

## 设计决策

### 决策 1：配置存储方式 — 使用 useFocusStore（localStorage）

**理由**：
- 专注模式参数是纯客户端偏好，不需要跨设备同步
- `useFocusStore` 已有 Zustand + persist 基础设施，扩展简单
- `PomodoroSettings.tsx` 的 API 方案需要后端支持且当前只保存了部分参数
- 桌面应用场景下 localStorage 完全够用

**做法**：扩展 `useFocusStore`，新增缺失字段，删除 `PomodoroSettings.tsx`。

### 决策 2：设置 UI — 在 Settings.tsx 中新增区块

**理由**：
- 与其他设置（外观、学习策略等）保持一致的 UI 风格
- 用户习惯在设置页面找配置，而非弹窗
- 参考 `PomodoroSettings.tsx` 的 UI 设计（滑块 + 开关），但适配 Settings.tsx 的卡片风格

### 决策 3：配置生效方式 — 实时生效

**理由**：
- `useFocusStore` 的 Zustand 状态变更会自动触发 React 重渲染
- `useTimerStore` 已通过 `useFocusStore.getState()` 读取配置
- 修改 `transitionToNextMode` 中的硬编码 `% 4` 为读取 `longBreakInterval` 即可

## 实施步骤

### 步骤 1：扩展 useFocusStore — 新增配置字段

**文件**：`src/store/useFocusStore.ts`

新增字段：
```typescript
interface FocusState {
  // 已有
  focusDuration: number;           // 默认 25
  shortBreakDuration: number;      // 默认 5
  longBreakDuration: number;       // 默认 15
  soundEnabled: boolean;           // 默认 true
  highlightEnabled: boolean;       // 默认 false
  highlightIntensity: number;      // 默认 0.5

  // 新增
  longBreakInterval: number;       // 默认 4（几个专注后长休）
  autoStartBreak: boolean;         // 默认 true（专注结束自动开始休息）
  autoStartPomodoro: boolean;      // 默认 false（休息结束自动开始专注）
  notificationEnabled: boolean;    // 默认 true（浏览器通知）

  // ... 其他已有字段不变
}
```

更新 `DEFAULT_DURATIONS` 为 `DEFAULT_SETTINGS`，包含所有默认值。

更新 `partialize` 包含新增字段。

更新 `updateSettings` 的 Pick 类型包含新增字段。

### 步骤 2：修改 useTimerStore — 消除硬编码

**文件**：`src/store/useTimerStore.ts`

修改 `transitionToNextMode` 函数（第 146-180 行）：
```typescript
// 之前
const isLongBreak = completedSessions > 0 && completedSessions % 4 === 0;

// 之后
const { shortBreakDuration, longBreakDuration, focusDuration, longBreakInterval } =
  useFocusStore.getState();
const isLongBreak = completedSessions > 0 && completedSessions % longBreakInterval === 0;
```

同时处理 `autoStartBreak` 逻辑：当专注阶段完成时，如果 `autoStartBreak` 为 false，则设置 `isActive: false` 而非自动开始休息。

### 步骤 3：在 Settings.tsx 新增专注模式设置区块

**文件**：`src/pages/Settings.tsx`

在"外观设置"区块之后、"AI 服务密钥配置"区块之前，新增"专注模式"区块。

UI 设计参考现有 Settings.tsx 的卡片风格 + PomodoroSettings.tsx 的滑块设计：

```
┌─────────────────────────────────────────────┐
│ 🍅 专注模式                                  │
├─────────────────────────────────────────────┤
│                                             │
│ 专注时长                          25 分钟   │
│ ═══════════●═════════════════════           │
│ 5 分钟                    60 分钟           │
│                                             │
│ 短休息时长                          5 分钟   │
│ ═══●═════════════════════════════           │
│ 1 分钟                    15 分钟           │
│                                             │
│ 长休息时长                         15 分钟   │
│ ═══════════●═════════════════════           │
│ 10 分钟                   30 分钟           │
│                                             │
│ 长休息间隔                       4 个番茄钟  │
│ ═══════●═════════════════════════           │
│ 2 个番茄钟              6 个番茄钟          │
│                                             │
│ ─── 自动化选项 ───                          │
│                                             │
│ 自动开始休息                    [开关 ON]    │
│ 专注结束后自动进入休息倒计时                 │
│                                             │
│ 自动开始专注                   [开关 OFF]    │
│ 休息结束后自动进入专注倒计时                 │
│                                             │
│ 声音提示                       [开关 ON]    │
│ 计时结束时播放提示音                         │
│                                             │
│ 浏览器通知                     [开关 ON]    │
│ 计时结束时发送浏览器通知                     │
│                                             │
│              [恢复默认设置]                  │
└─────────────────────────────────────────────┘
```

实现要点：
- 使用 `useFocusStore` 读取和更新配置，实时生效
- 滑块使用与"学习策略"区块相同的样式（`accent-primary-600`）
- 开关使用与"向量化配置"区块相同的 toggle 样式
- "恢复默认设置"按钮参考"学习策略"区块的实现
- 图标使用 `Timer`（lucide-react），颜色用 `text-red-500` 或 `text-orange-500`

### 步骤 4：更新 PomodoroCycleBar — 读取 longBreakInterval

**文件**：`src/components/common/PomodoroCycleBar.tsx`

当前 `longBreakInterval` 通过 props 传入，默认值为 4。更新各使用处从 `useFocusStore` 读取：

**FocusTimer.tsx**：
```tsx
const longBreakInterval = useFocusStore((s) => s.longBreakInterval);
<PomodoroCycleBar mode={mode} completedSessions={completedSessions} longBreakInterval={longBreakInterval} size="sm" />
```

**MobileFocusTimer.tsx**：同上

**LearningFocusPanel.tsx**：同上

### 步骤 5：添加 i18n 翻译

**文件**：`src/i18n/locales/zh-CN.json` 和 `en-US.json`

新增翻译键：
```json
{
  "settings": {
    "focusMode": "专注模式",
    "focusDuration": "专注时长",
    "shortBreakDuration": "短休息时长",
    "longBreakDuration": "长休息时长",
    "longBreakInterval": "长休息间隔",
    "longBreakIntervalUnit": "个番茄钟",
    "autoStartBreak": "自动开始休息",
    "autoStartBreakDesc": "专注结束后自动进入休息倒计时",
    "autoStartPomodoro": "自动开始专注",
    "autoStartPomodoroDesc": "休息结束后自动进入专注倒计时",
    "soundEnabled": "声音提示",
    "soundEnabledDesc": "计时结束时播放提示音",
    "notificationEnabled": "浏览器通知",
    "notificationEnabledDesc": "计时结束时发送浏览器通知",
    "resetFocusDefaults": "恢复默认设置",
    "minutes": "分钟",
    "pomodoros": "个番茄钟"
  }
}
```

### 步骤 6：删除废弃的 PomodoroSettings.tsx

**文件**：`src/components/Scheduler/PomodoroSettings.tsx`

该组件未被任何地方引用，功能已被 Settings.tsx 的新区块替代。确认无引用后删除。

## 验证步骤

1. **类型检查**：`npm run check` 确保无 TypeScript 错误
2. **代码检查**：`npm run lint` 确保无 ESLint 错误
3. **功能验证**：
   - 打开设置页面，确认"专注模式"区块正确显示
   - 修改各参数，确认实时生效（打开专注模式浮动球验证）
   - 修改 `longBreakInterval`，确认 PomodoroCycleBar 正确反映
   - 修改 `longBreakInterval`，确认 `transitionToNextMode` 正确判断长休
   - 点击"恢复默认设置"，确认所有参数恢复默认值
   - 刷新页面，确认配置持久化
4. **i18n 验证**：切换中英文，确认所有标签正确显示

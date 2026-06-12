# 子任务级执行引擎 — 最终方案 (v4)

## 一句话总结

> **调度按大任务，执行按子任务，计时按番茄钟（固定25min），完成靠手动**

---

## 核心模型

```
┌─────────────────────────────────────────────────────────┐
│                    调度层 (不变)                          │
│   智能推荐 → 推荐 UserTask → start(pause/stop)          │
├─────────────────────────────────────────────────────────┤
│                    执行层 (新增)                          │
│   子任务(Subtask) ← 番茄钟(Pomodoro) ← 用户操作(✓)      │
└─────────────────────────────────────────────────────────┘
```

### 关系
- **1个大任务** → N个子任务 → M个番茄钟（M >= N，由用户决定）
- **每个番茄钟**：固定 focusDuration（如25min），到点→进休息
- **actual_duration**：所有番茄时长累加到当前子任务上
- **estimated_duration**：仅作参考展示，超时不限制
- **达到预计时间**：当累计 actual_duration ≥ estimated_duration 时给温和提示
- **子任务切换**：仅通过用户点 ✓ 手动触发

---

## 番茄钟生命周期

```
         ┌──────────────┐     25min到了      ┌──────────────┐
  start  │              │ ──────────────→    │              │
 ───────►│  Focus 25min │                    │   Break      │
         │  (倒计时中)   │   或中途点✓       │  (短/长休息)   │
         │              │ ──────────────→    │              │
         └──────────────┘                     └──────┬───────┘
                                                   │
                                            Break结束
                                                   │
                                                   ▼
                                           ┌──────────────┐
                                           │  新Focus番茄   │
                                           │  (可能同一子任务│
                                           │   或换子任务)  │
                                           └──────────────┘
```

### 三种结束方式

| 触发条件 | 行为 | 子任务状态 |
|---------|------|-----------|
| 25min 自然跑完 | 自动进入 break | **不变**，继续当前子任务 |
| 中途点 ✓（子任务完成）| **立即结束**当前番茄 → 进 break | 标记 completed，break 后换下一子任务 |
| 点 ■（停止）| 停止一切 + 返回智能推荐 | 保持 in_progress（暂停大任务） |

---

## 面板设计

```
┌──────────────────────────────────────────────────────────────┐
│ 🟢 量子比特基础                    ⏱ 15:23    ||  ■  ✓(完成)  │
│     量子计算入门 · 子任务 2/6                                │
│     已专注 · 第2番茄 · 预计30min · 已做18min                 │
├──────────────────────────────────────────────────────────────┤
│ ████████████░░░░░░░░░░░░░░  60%                              │
│                                                              │
│  当前：量子比特基础  [学习]                                     │
│                                                              │
│  ▼ 全部子任务                                                 │
│  ✅ 波函数简介        已28min / 预30min                       │
│  🔵 量子比特基础      已18min / 预30min  ◉ 进行中             │
│  ⬜ 量子叠加态          已 0min / 预45min                       │
│  ⬜ 量子纠缠            已 0min / 预20min                       │
│  ⬜ 量子算法            已 0min / 预40min                       │
│  ⬜ 量子计算应用        已 0min / 预45min                       │
└──────────────────────────────────────────────────────────────┘
```

按钮：
- `||` / `▶` — 暂停/恢复番茄钟
- `■` — 停止（暂停大任务+返回推荐）
- `✓(完成)` — 标记**当前子任务完成** → 当前番茄立即结束 → 进休息 → 休息后自动切下一子任务

---

## 文件修改

### 1. useTimerStore.ts
- 新增 `subtaskId: string | null`
- 新增 `setSubtask(id)` action
- 新增 `nextSubtask(id, duration)` action — 切换子任务，保留 completedSessions
- `complete()` 改为不自动 transitionToNextMode（由调用方控制是进 break 还是其他）

### 2. ActiveTaskPanel.tsx
- **标题**：主标题=子任务名，副标题=大任务+进度，第三行=番茄数+时间信息
- **✓ 按钮** → `handleCompleteSubtask()`:
  1. complete() 保存 focus_session
  2. API 更新子任务 status=completed, actual_duration
  3. 找下一个 pending 子任务，缓存起来
  4. 调用 `transitionToNextMode("focus", ...)` 进入 break
  5. break 结束后（resume/start），检查是否有缓存的下一子任务 → 有则 nextSubtask() 切换
- **停止按钮** → 更新 actual_duration + reset + onStop()
- **子任务列表** → 显示每个子任务的 actual_duration / estimated_duration

### 3. Scheduler.tsx
- handleStartTask() 启动后关联第一个 subtaskId

---

## 实现步骤

1. useTimerStore: subtaskId 字段 + setSubtask + nextSubtask
2. Scheduler.tsx: handleStartTask 关联子任务
3. ActiveTaskPanel: UI升级 + handleCompleteSubtask + 子任务列表增强
4. 验证: check + lint

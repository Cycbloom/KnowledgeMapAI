# ESLint 错误修复计划

## 错误概览

共 20 个错误，分布在 8 个文件中：

| 文件 | 错误类型 | 数量 |
|------|----------|------|
| schedulerService.ts | no-case-declarations | 1 |
| VirtualizedNodeList.tsx | react-hooks/refs | 1 |
| BreakTimer.tsx | react-hooks/immutability | 1 |
| DependencyGraph.tsx | react-hooks/immutability | 1 |
| FocusMode.tsx | react-hooks/immutability + no-empty | 3 |
| TaskTimer.tsx | react-hooks/purity | 1 |
| CurrentTask.tsx | react-hooks/purity | 1 |
| PlanetView.tsx | react-hooks/refs | 11 |

---

## 修复方案

### 1. schedulerService.ts (第1319行)

**问题**: `no-case-declarations` - 在 case 块中直接声明变量

**修复**: 用大括号包裹 case 块内容

```typescript
case 'daily_focus_hours': {
  const todayStats = await this.getDailyFocusStats(client, userId);
  current = Math.floor(todayStats.total_duration / 3600);
  break;
}
```

---

### 2. VirtualizedNodeList.tsx (第227行)

**问题**: `react-hooks/refs` - 在 useMemo 中访问 `transformRef.current`

**修复**: 将 transform 作为参数传入，或使用 state 存储 transform 值

---

### 3. BreakTimer.tsx (第72行)

**问题**: `react-hooks/immutability` - `playNotificationSound` 在声明前被调用

**修复**: 将 `playNotificationSound` 函数声明移到 useEffect 之前

---

### 4. DependencyGraph.tsx (第31行)

**问题**: `react-hooks/immutability` - `calculateLayout` 在声明前被调用

**修复**: 将 `calculateLayout` 函数声明移到 useEffect 之前

---

### 5. FocusMode.tsx (第78行, 160行, 167行)

**问题**: 
- `stopAudio` 在声明前被调用
- 空 catch 块 (`no-empty`)

**修复**: 
- 将 `stopAudio` 函数声明移到 `startAudio` 之前
- 在空 catch 块中添加注释 `// ignore errors on stop`

---

### 6. TaskTimer.tsx (第139行)

**问题**: `react-hooks/purity` - 在渲染期间调用 `Date.now()`

**修复**: 使用 state 存储动画偏移值，用 useEffect 定期更新

---

### 7. CurrentTask.tsx (第477行)

**问题**: `react-hooks/purity` - 在渲染期间调用 `Date.now()`

**修复**: 同 TaskTimer.tsx，使用 state 存储动画偏移值

---

### 8. PlanetView.tsx (第112-200行)

**问题**: `react-hooks/refs` - 在渲染期间访问 refs

**修复**: 
- `scaleRef.current` → 使用 state 或直接使用计算值
- `curveRef.current` → 在 useMemo 中使用局部变量而非 ref，或使用 `useRef` 初始化模式

---

## 执行顺序

1. schedulerService.ts
2. BreakTimer.tsx
3. DependencyGraph.tsx
4. FocusMode.tsx
5. TaskTimer.tsx
6. CurrentTask.tsx
7. VirtualizedNodeList.tsx
8. PlanetView.tsx

完成后运行 `npm run lint` 验证所有错误已修复。

# 设置页面深层链接导航优化

## 摘要

从学习模式设置中的"管理 AI 提示词"跳转到系统设置时，自动定位到左侧导航栏的"AI 提示词管理"区块并高亮。

## 当前状态分析

### 导航入口

| 来源 | 导航方式 | 是否生效 |
|------|----------|----------|
| `LearningSettingsPanel` | `navigate("/settings#prompts")` | 部分生效（hash 方式） |
| `GenerateCardsModal` | `navigate("/settings?tab=ai")` | 不生效（query 参数未处理） |
| `LearningMode`（错误提示） | `navigate("/settings?tab=ai")` | 不生效（query 参数未处理） |
| `NotificationCenter` | `navigate("/settings?tab=notifications")` | 不生效（query 参数未处理） |

### 现有深层链接实现（Settings.tsx 第 138-149 行）

```typescript
useEffect(() => {
  const activate = () => {
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      requestAnimationFrame(() => scrollToSection(hash, "auto"));
    }
  };
  activate();
  window.addEventListener("hashchange", activate);
  return () => window.removeEventListener("hashchange", activate);
}, [scrollToSection]);
```

### 问题根因

1. **嵌套滚动容器**：Layout 有两层 `overflow-y-auto`（第 397 行和第 472 行），Settings 页面自身也有 `overflow-y-auto`（第 168 行），`scrollIntoView` 在多层嵌套滚动容器中可能不生效
2. **使用 `window.location.hash`**：在 SPA 中不如 react-router 的 `useLocation().hash` 可靠
3. **导航方式不一致**：部分使用 hash（`#prompts`），部分使用 query 参数（`?tab=ai`），后者完全未实现
4. **`requestAnimationFrame` 延迟不够**：只延迟一帧（~16ms），sections 可能还未完全渲染

## 修改方案

### 1. Settings.tsx — 增强深层链接机制

**文件**: `d:\KnowledgeMap\src\pages\Settings.tsx`

- 将 `window.location.hash` 替换为 `useLocation().hash`，更可靠地获取 react-router 管理的 hash
- 增加滚动重试机制：如果第一次滚动时 ref 未就绪，延迟重试
- 同时支持 hash 和 search params 两种导航方式（`#prompts` 和 `?section=prompts`）
- 增加对 `?tab=ai` → `prompts` 和 `?tab=notifications` → `notifications` 的映射

具体改动：

```typescript
// 新增导入
import { useNavigate, useLocation } from "react-router-dom";

// 在组件内
const location = useLocation();

// section 映射表（用于 ?tab=xxx 到 section id 的转换）
const tabToSection: Record<string, string> = {
  ai: "prompts",
  notifications: "notifications",
};

// 改写深层链接 effect
useEffect(() => {
  const activate = () => {
    // 优先使用 hash，其次使用 search params
    let targetSection = location.hash.replace("#", "");
    if (!targetSection) {
      const params = new URLSearchParams(location.search);
      const tab = params.get("tab");
      if (tab && tab in tabToSection) {
        targetSection = tabToSection[tab];
      }
    }
    if (targetSection) {
      // 使用 setTimeout 而非 requestAnimationFrame，给渲染更多时间
      const timer = setTimeout(() => {
        const el = sectionRefs.current[targetSection];
        if (el) {
          el.scrollIntoView({ behavior: "auto", block: "start" });
          setActiveSection(targetSection);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  };
  activate();
}, [location.hash, location.search]);
```

移除旧的 `hashchange` 监听，因为 `useLocation()` 的变化会自动触发 effect 重新执行。

### 2. LearningSettingsPanel.tsx — 保持现有导航方式

**文件**: `d:\KnowledgeMap\src\components\Learning\LearningSettingsPanel.tsx`

现有 `navigate("/settings#prompts")` 无需改动，因为 Settings.tsx 会正确处理 hash。

### 3. GenerateCardsModal.tsx — 统一为 hash 方式

**文件**: `d:\KnowledgeMap\src\components\Learning\GenerateCardsModal.tsx`

将 `navigate("/settings?tab=ai")` 改为 `navigate("/settings#prompts")`

### 4. LearningMode.tsx — 统一为 hash 方式

**文件**: `d:\KnowledgeMap\src\pages\LearningMode.tsx`

将两处 `navigate("/settings?tab=ai")` 改为 `navigate("/settings#prompts")`

### 5. NotificationCenter.tsx — 统一为 hash 方式

**文件**: `d:\KnowledgeMap\src\components\Notifications\NotificationCenter.tsx`

将 `navigate("/settings?tab=notifications")` 改为 `navigate("/settings#notifications")`

## 涉及文件

| 文件 | 改动内容 |
|------|----------|
| `src/pages/Settings.tsx` | 使用 `useLocation()` 替代 `window.location.hash`，增加 search params 支持，优化滚动时机 |
| `src/components/Learning/GenerateCardsModal.tsx` | `?tab=ai` → `#prompts` |
| `src/pages/LearningMode.tsx` | `?tab=ai` → `#prompts`（2 处） |
| `src/components/Notifications/NotificationCenter.tsx` | `?tab=notifications` → `#notifications` |

## 验证步骤

1. `npm run check` — 类型检查通过
2. `npm run lint` — 代码检查通过
3. 手动验证：从学习模式设置点击"管理 AI 提示词"→ 跳转到系统设置并定位到"AI 提示词管理"区块，左侧导航高亮正确
4. 手动验证：从通知中心点击跳转 → 定位到通知区块

# 概念聚合面板集成计划

## 问题分析

当前 ConceptAggregationPanel 被实现为**独立的模态框覆盖层**，通过工具栏「设置 → 概念聚合」菜单触发。

用户期望：概念聚合应该作为 **AI 助手面板的一个 Tab/模式**，和以下功能并列：
- **图谱编辑器左侧面板**：自由对话、引导模式、学习路径、文献提取 → **+ 概念聚合**
- **学习模式右侧面板**：AI 助教、学习路径、文献提取 → **+ 概念聚合**

## 现有架构分析

### 1. 图谱编辑器（GraphEditor.tsx）
- **左侧 AI 面板**：`RAGChatPanel`（`src/components/RAGChat/index.tsx`）
  - 通过 `tutorMode` 状态切换子面板
  - 当前值：`"free"` | `"guided"` | `"learning-path"` | `"literature-extract"`
  - Tab 栏位于第 414-476 行，使用 button 组切换
  - 内容区根据 tutorMode 条件渲染不同组件（第 486-508 行）

### 2. 学习模式（LearningMode.tsx）
- **右侧面板**：通过 `rightPanelMode` 切换
  - 当前值：`"chat"` | `"learning-path"` | `"literature-extract"`
  - Tab 栏位于第 1852-1891 行，图标按钮组
  - 内容区条件渲染（第 1827 行附近）

### 3. TutorMode 类型定义
- 定义在 `src/types` 中导出
- 需要扩展添加 `"concept-aggregation"` 值

## 实施步骤

### Step 1: 扩展 TutorMode 类型定义

**文件**: `src/types/index.ts`（或实际定义位置）

在 `TutorMode` 类型中添加新值：
```typescript
export type TutorMode = "free" | "guided" | "learning-path" | "literature-extract" | "concept-aggregation";
```

同时需要检查 LearningMode 中的 `rightPanelMode` 类型：
```typescript
// LearningMode.tsx 第 106-108 行
const [rightPanelMode, setRightPanelMode] = useState<
  "chat" | "learning-path" | "literature-extract" | "concept-aggregation"
>("chat");
```

---

### Step 2: 在 RAGChatPanel 中集成概念聚合 Tab

**文件**: `src/components/RAGChat/index.tsx`

#### 2a. 导入 ConceptAggregationPanel
```typescript
import { ConceptAggregationPanel } from "../ConceptAggregation/ConceptAggregationPanel";
```

#### 2b. 在 Tab 栏添加「概念聚合」按钮（第 461-472 行后）
```tsx
<button
  onClick={() => onSwitchTutorMode?.("concept-aggregation")}
  className={`px-3 py-1 text-xs rounded-md transition-all ${
    tutorMode === "concept-aggregation"
      ? "bg-amber-500 text-white"
      : isDark
        ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
        : "bg-white text-amber-600 hover:bg-amber-100"
  }`}
>
  概念聚合
</button>
```

#### 2c. 在内容区添加渲染分支（第 486-508 行）
```tsx
{isTutorMode && tutorMode === "concept-aggregation" && graphId ? (
  <div className="h-full">
    <ConceptAggregationPanel graphId={graphId} isOpen={true} onClose={() => {}} />
  </div>
) : isTutorMode && tutorMode === "learning-path" && graphId ? (
  // ... existing learning-path
```

> **注意**: ConceptAggregationPanel 需要调整为可嵌入模式（去掉 fixed 定位的外层容器）

---

### Step 3: 调整 ConceptAggregationPanel 为可嵌入模式

**文件**: `src/components/ConceptAggregation/ConceptAggregationPanel.tsx`

当前问题：如果 ConceptAggregationPanel 使用 `fixed/inset` 定位，嵌入 RAGChatPanel 后会出现嵌套滚动问题。

**方案**：添加 `embedded` prop 控制渲染模式
```typescript
interface ConceptAggregationPanelProps {
  graphId: string;
  isOpen: boolean;
  onClose: () => void;
  embedded?: boolean;  // 新增：是否为嵌入模式
}
```

当 `embedded=true` 时：
- 去掉 `fixed`/`absolute` 外层定位容器
- 去掉关闭按钮（由父面板统一管理）
- 使用 `h-full` 填满父容器
- 内部滚动区域使用 `overflow-y-auto`

---

### Step 4: 在 LearningMode 右侧面板中集成

**文件**: `src/pages/LearningMode.tsx`

#### 4a. 扩展 rightPanelMode 类型（第 106-108 行）
```typescript
const [rightPanelMode, setRightPanelMode] = useState<
  "chat" | "learning-path" | "literature-extract" | "concept-aggregation"
>("chat");
```

#### 4b. 在 Tab 栏添加按钮（第 1879-1891 行后）
```tsx
<button
  onClick={() => setRightPanelMode("concept-aggregation")}
  className={`p-1.5 rounded-md transition-colors ${
    rightPanelMode === "concept-aggregation"
      ? "bg-primary-500 text-white"
      : isDark
        ? "hover:bg-slate-700 text-slate-400"
        : "hover:bg-gray-100 text-gray-500"
  }`}
  title="概念聚合"
>
  <GitMerge size={14} />
</button>
```

#### 4c. 更新头部图标和标题（第 1825-1840 行）
```tsx
{rightPanelMode === "concept-aggregation" ? (
  <GitMerge size={18} />
) : rightPanelMode === "chat" ? (
  <Bot size={18} />
) // ... existing
```

```tsx
{rightPanelMode === "concept-aggregation"
  ? "概念聚合"
  : rightPanelMode === "chat"
    ? t("learning.chat.aiTutor")
    // ... existing
}
```

#### 4d. 在内容区添加渲染分支
需要找到右侧面板的条件渲染区域，添加 concept-aggregation 分支。

#### 4e. 导入并懒加载 ConceptAggregationPanel
```typescript
const ConceptAggregationPanel = lazy(() =>
  import("../components/ConceptAggregation/ConceptAggregationPanel").then(
    (module) => ({ default: module.ConceptAggregationPanel })
  )
);
```

---

### Step 5: 清理旧的独立入口（可选）

**涉及文件**:
- `src/components/GraphEditor/toolbar/GraphToolbar.tsx` - 移除设置菜单中的「概念聚合」按钮（第 1604-1608 行）
- `src/pages/GraphEditor.tsx` - 可保留 `isConceptAggregationOpen` 作为后备入口，或移除

**建议**：暂时保留设置菜单入口作为备用访问方式，后续确认不再需要后再移除。

---

### Step 6: 添加国际化（可选）

**文件**: `src/locales/` 相关语言文件

添加新的翻译 key：
```json
{
  "aiChat.modeConceptAggregation": "概念聚合",
  "conceptAggregation.title": "概念聚合",
  "conceptAggregation.subtitle": "智能合并相似概念，构建知识层级"
}
```

---

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/types/index.ts` (或定义位置) | 修改 | TutorMode 添加 `"concept-aggregation"` |
| `src/components/RAGChat/index.tsx` | 修改 | 添加 Tab 按钮 + 渲染分支 |
| `src/components/ConceptAggregation/ConceptAggregationPanel.tsx` | 修改 | 添加 `embedded` prop |
| `src/pages/LearningMode.tsx` | 修改 | 添加 Tab 按钮 + 渲染分支 + 类型扩展 |
| `src/components/GraphEditor/toolbar/GraphToolbar.tsx` | 可选修改 | 清理旧入口 |
| `src/locales/*.json` | 可选修改 | 国际化文本 |

## 验证方式

1. **图谱编辑器测试**：
   - 打开左侧 AI 助手面板
   - 确认 Tab 栏显示「概念聚合」选项
   - 点击切换到概念聚合面板
   - 执行分析流程正常工作
   - 切换到其他 Tab 再切回，状态保持正确

2. **学习模式测试**：
   - 进入学习模式
   - 打开右侧面板
   - 确认 Tab 栏有概念聚合图标
   - 点击切换，面板内容正确渲染

3. **边界情况**：
   - 关闭面板再打开，不报错
   - 分析进行中切换 Tab，进度保持
   - 移动端布局正常

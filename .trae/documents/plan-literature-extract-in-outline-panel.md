# 计划：在大纲视图右侧 AI 助教面板中集成文献提取功能

## 背景分析

从截图和代码分析，LearningMode 页面的布局如下：
- **左侧**：大纲视图（GraphOutline）- 显示节点树
- **中间**：图谱大纲面板 / 文章内容
- **右侧**：AI 助教面板，当前支持两种模式：
  - `chat` - AI 助教聊天模式
  - `learning-path` - 学习路径模式

用户希望在此右侧面板中添加 **"文献提取"** 作为第三种模式。

## 当前代码结构

### 关键位置
1. **状态定义** ([LearningMode.tsx:103-105](file:///d:/KnowledgeMap/src/pages/LearningMode.tsx#L103-L105))
   ```typescript
   const [rightPanelMode, setRightPanelMode] = useState<
     "chat" | "learning-path"
   >("chat");
   ```

2. **头部切换按钮** ([LearningMode.tsx:1814-1840](file:///d:/KnowledgeMap/src/pages/LearningMode.tsx#L1814-L1840))
   - 有两个按钮：聊天和学习路径
   - 需要添加第三个按钮：文献提取

3. **内容区域** ([LearningMode.tsx:1872-1887](file:///d:/KnowledgeMap/src/pages/LearningMode.tsx#L1872-L1887))
   - 根据 `rightPanelMode` 显示不同内容
   - 需要添加文献提取的渲染逻辑

4. **头部标题和图标** ([LearningMode.tsx:1793-1810](file:///d:/KnowledgeMap/src/pages/LearningMode.tsx#L1793-L1810))
   - 根据模式显示不同图标和标题
   - 需要更新以支持新模式

## 实现步骤

### 步骤 1：更新 rightPanelMode 类型定义
**文件**: [src/pages/LearningMode.tsx](file:///d:/KnowledgeMap/src/pages/LearningMode.tsx)

```typescript
// 修改前
const [rightPanelMode, setRightPanelMode] = useState<
  "chat" | "learning-path"
>("chat");

// 修改后
const [rightPanelMode, setRightPanelMode] = useState<
  "chat" | "learning-path" | "literature-extract"
>("chat");
```

### 步骤 2：添加导入语句
在文件顶部添加 LiteratureExtractPanel 的导入：

```typescript
import { LiteratureExtractPanel } from "../components/LiteratureExtract/LiteratureExtractPanel";
```

同时需要添加 FileText 图标导入（用于头部显示）

### 步骤 3：更新头部图标和标题
**位置**: [LearningMode.tsx:1793-1810](file:///d:/KnowledgeMap/src/pages/LearningMode.tsx#L1793-L1810)

```tsx
<div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-primary-600 dark:text-primary-400">
  {rightPanelMode === "chat" ? (
    <Bot size={18} />
  ) : rightPanelMode === "learning-path" ? (
    <Route size={18} />
  ) : (
    <FileText size={18} />  // 新增
  )}
</div>
// ... 标题也需要相应更新
```

### 步骤 4：添加文献提取模式切换按钮
**位置**: [LearningMode.tsx:1827-1840](file:///d:/KnowledgeMap/src/pages/LearningMode.tsx#L1827-L1840)

在学习路径按钮后添加：

```tsx
<button
  onClick={() => setRightPanelMode("literature-extract")}
  className={`p-1.5 rounded-md transition-colors ${
    rightPanelMode === "literature-extract"
      ? "bg-primary-500 text-white"
      : isDark
        ? "hover:bg-slate-700 text-slate-400"
        : "hover:bg-gray-100 text-gray-500"
  }`}
  title="文献提取"
>
  <FileText size={14} />
</button>
```

### 步骤 5：添加内容区域渲染逻辑
**位置**: [LearningMode.tsx:1872-1887](file:///d:/KnowledgeMap/src/pages/LearningMode.tsx#L1872-L1887)

```tsx
<div className="flex-1 overflow-y-auto custom-scrollbar">
  {rightPanelMode === "literature-extract" ? (
    <div className="h-full">
      <LiteratureExtractPanel
        graphId={graphId || ""}
        onExtractComplete={(result) => {
          frontendEventBus.publish("message_show", {
            type: "success",
            content: t("literatureExtract.success.extracted", {
              count: result.concepts.length,
            }),
          });
        }}
        className="h-full"
      />
    </div>
  ) : rightPanelMode === "learning-path" ? (
    // 现有的学习路径逻辑...
  ) : (
    // 现有的聊天逻辑...
  )}
</div>
```

### 步骤 6：（可选）在顶部工具栏添加快捷入口
**位置**: 学习路径按钮附近 ([LearningMode.tsx:1406-1425](file:///d:/KnowledgeMap/src/pages/LearningMode.tsx#L1406-L1425))

可以添加一个"文献提取"按钮，点击后自动打开右侧面板并切换到文献提取模式。

## 修改文件清单

| 文件 | 修改内容 |
|------|----------|
| [src/pages/LearningMode.tsx](file:///d:/KnowledgeMap/src/pages/LearningMode.tsx) | 1. 导入 LiteratureExtractPanel 和 FileText 图标<br>2. 更新 rightPanelMode 类型<br>3. 添加模式切换按钮<br>4. 更新头部图标/标题<br>5. 添加内容渲染逻辑 |

## 验证方式

1. 打开学习模式页面
2. 点击右侧 AI 助教面板的"文献提取"按钮
3. 验证文献提取面板正确显示
4. 测试文本输入、文件上传、URL 抓取三种模式
5. 验证提取完成后有成功提示

## 注意事项

1. LiteratureExtractPanel 已存在且功能完整，直接复用即可
2. 需要确保 graphId 正确传递给组件
3. 移动端适配：确保在小屏幕上也能正常使用
4. 国际化文本已存在于 zh-CN.json 和 en-US.json 中

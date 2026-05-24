# 文献提取 - 来源展示优化计划

## 📋 需求概述

优化文献提取面板中"来源"区域的交互体验：
- **当前状态**：填写前显示"未填写来源"，填写后显示纯文本摘要
- **目标状态**：填写完成后，折叠头部变为**卡片样式**（类似提取结果中的文献卡片）
  - 鼠标悬停：显示详细信息浮层
  - 点击：展开编辑表单

## 🎯 涉及文件

| 文件 | 作用 | 修改内容 |
|------|------|----------|
| `src/components/LiteratureExtract/LiteratureMetadataForm.tsx` | 来源表单组件 | **主要修改**：优化折叠头部展示逻辑 |
| `src/components/LiteratureExtract/LiteratureMetadataCard.tsx` | 文献卡片组件 | 可能需要微调（如需复用） |

## 🔍 当前实现分析

### LiteratureMetadataForm 组件结构
```
┌─────────────────────────────────────┐
│ renderCollapsedHeader()             │  ← 折叠头部（按钮）
│  ├─ 未填写: "📖 未填写来源"         │
│  └─ 已填写: "📖 标题 - 作者 (年份)" │  ← 纯文本
├─────────────────────────────────────┤
│ renderExpandedForm()                │  ← 展开的完整表单
│  ├─ 引用文本输入 + 自动检测          │
│  └─ 手动编辑字段（标题/作者/年份...）│
└─────────────────────────────────────┘
```

### 关键代码位置
- **状态判断函数**: [LiteratureMetadataForm.tsx:56-80](./src/components/LiteratureExtract/LiteratureMetadataForm.tsx#L56-L80) - `getFieldStatus()`
- **折叠头部渲染**: [LiteratureMetadataForm.tsx:149-198](./src/components/LiteratureExtract/LiteratureMetadataForm.tsx#L149-L198) - `renderCollapsedHeader()`
- **元数据类型定义**: [LiteratureMetadataForm.tsx:27-36](./src/components/LiteratureExtract/LiteratureMetadataForm.tsx#L27-L36) - `LiteratureMetadata` 接口

### LiteratureMetadataCard 组件特性（参考）
- 紧凑模式：[LiteratureMetadataCard.tsx:69-161](./src/components/LiteratureExtract/LiteratureMetadataCard.tsx#L69-L161)
- 悬停显示详情：使用 `isHovered` 状态控制浮层显示
- 显示内容：图标 + 标题 + 作者 + 年份（单行）
- 类型图标映射：[LiteratureMetadataCard.tsx:31-41](./src/components/LiteratureExtract/LiteratureMetadataCard.tsx#L31-L41)

## 🛠️ 实施步骤

### Step 1: 修改 `renderCollapsedHeader()` 方法
**文件**: `LiteratureMetadataForm.tsx`  
**位置**: 第 149-198 行

**改动逻辑**:
```typescript
const renderCollapsedHeader = () => {
  if (!status.filled) {
    // 未填写状态：保持原有样式（灰色背景 + "未填写来源"）
    return (
      <button onClick={() => setIsExpanded(true)} ...>
        <BookOpen /> 未填写来源 <ChevronDown />
      </button>
    );
  }

  // ✅ 已填写状态：渲染为卡片样式
  return (
    <div
      className="card-style"
      onMouseEnter={...}
      onMouseLeave={...}
      onClick={() => setIsExpanded(true)}
    >
      <TypeIcon /> {title} {authors} ({year})
      {isHovered && <DetailPopup />}
      <ChevronDown />
    </div>
  );
};
```

### Step 2: 添加必要的导入和状态
**文件**: `LiteratureMetadataForm.tsx`

**新增导入**:
```typescript
import {
  // ...existing imports...
  FileText, BookOpen, Newspaper, BarChart3, Globe, FileType,
  Calendar, Users, Bookmark, Link, Tag,
} from "lucide-react";
```

**新增状态**:
```typescript
const [isHovered, setIsHovered] = useState(false);
```

### Step 3: 复用 LiteratureMetadataCard 的配置
在 `LiteratureMetadataForm` 中添加类型图标映射（或直接从 Card 组件导出）:

```typescript
const LITERATURE_TYPE_CONFIG = {
  paper: { icon: FileText, color: "#3B82F6" },
  book: { icon: BookOpen, color: "#EF4444" },
  article: { icon: Newspaper, color: "#10B981" },
  report: { icon: BarChart3, color: "#F59E0B" },
  webpage: { icon: Globe, color: "#8B5CF6" },
  document: { icon: FileType, color: "#6366F1" },
};
```

### Step 4: 实现卡片样式的折叠头部
**核心样式要求**:
- 背景：白色/深色适配（与 Card 组件一致）
- 边框：圆角 + 浅色边框
- 布局：图标(16px) + 标题(截断) + 作者(小字) + 年份(灰)
- 悬停效果：背景变浅 + 显示详情浮层
- 详情浮层：绝对定位，z-index: 50，包含完整信息

**悬停浮层内容**:
```
┌─────────────────────────────┐
│ 📄 标题                      │
│ 👥 作者列表                  │
│ 📅 年份  📰 期刊  🏷️ 类型   │
│ 🔗 DOI链接                   │
│ 🏷️ 关键词标签               │
└─────────────────────────────┘
```

### Step 5: 调整交互细节
- **点击行为**: 保持原有展开/收起逻辑
- **悬停时机**: 仅在 `status.filled` 时启用悬停效果
- **动画过渡**: 使用 CSS transition 或 Framer Motion
- **响应式**: 移动端适配（字体大小、间距）

## 📐 视觉规范

### 卡片头部（已填写状态）
| 属性 | 值 |
|------|-----|
| 内边距 | px-3 py-2 |
| 圆角 | rounded-lg |
| 边框 | border-gray-200 (light) / border-slate-700 (dark) |
| 背景 | bg-white / bg-slate-800/50 |
| 悬停背景 | hover:bg-gray-50 / hover:bg-slate-700/50 |

### 图标和文字
| 元素 | 样式 |
|------|------|
| 类型图标 | 16px，根据类型着色 |
| 标题 | font-medium text-sm，max-width 截断 |
| 作者 | text-xs text-gray-500，显示首作者+et al. |
| 年份 | text-xs text-gray-400 |

### 详情浮层
| 属性 | 值 |
|------|-----|
| 定位 | absolute, top-full, mt-1 |
| z-index | z-50 |
| 内边距 | p-3 |
| 最小宽度 | min-w-[300px] |
| 动画 | opacity transition 200ms |

## ⚠️ 注意事项

1. **保持向后兼容**: 未填写时仍显示原始的"未填写来源"样式
2. **避免重复代码**: 可考虑将公共配置提取到共享模块
3. **国际化**: 所有文本必须使用 `t()` 函数
4. **无障碍**: 保持键盘可访问性（focus 状态）
5. **性能**: 悬停浮层使用条件渲染，避免不必要的 DOM

## ✅ 验证清单

- [ ] 未填写时显示原始"未填写来源"按钮
- [ ] 填写标题后立即切换为卡片样式
- [ ] 鼠标悬停显示详细信息浮层
- [ ] 点击卡片展开编辑表单
- [ ] 表单数据正确回显到输入框
- [ ] 编辑后卡片实时更新
- [ ] 深色模式正确适配
- [ ] 移动端布局正常
- [ ] 无 TypeScript 错误
- [ ] ESLint 检查通过

## 🔄 后续优化建议（可选）

1. **提取公共组件**: 将卡片头部逻辑抽取为可复用组件
2. **添加过渡动画**: 使用 Framer Motion 优化展开/收起动画
3. **支持拖拽排序**: 如果有多个来源的情况
4. **快捷操作**: 悬停时显示复制引用、打开链接等按钮

---

**预计影响范围**: 仅 `LiteratureMetadataForm.tsx` 一个文件  
**复杂度**: 中等（主要是 UI 逻辑调整）  
**测试重点**: 交互状态切换、悬停浮层定位、表单数据同步

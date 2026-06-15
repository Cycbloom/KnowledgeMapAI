# 叙事播放按钮不可见问题修复计划

## 问题总结

用户无法在 UI 中找到"叙事播放"按钮。根本原因是 `RAGChatButtonWrapper` 组件未将 `onStartNarrative` 和 `onLearningPathNodeClick` 两个 props 透传给内部的 `RAGChatPanel`，导致 `LearningPathPanel` 收到的 `onStartNarrative` 为 `undefined`，条件渲染 `isSelected && onStartNarrative` 永远为 `false`，按钮永远不会出现。

## 当前状态分析

### Props 传递链路

```
GraphEditor.tsx (line 2004-2005)
  ↓ 传递 onStartNarrative + onLearningPathNodeClick
RAGChatButtonWrapper (line 801-890)
  ✗ 未解构这两个 props
  ✗ 未传递给 RAGChatPanel
RAGChatPanel (line 77-102)
  ✓ 解构了这两个 props
  ✓ 传递给 LearningPathPanel (line 539, 542)
LearningPathPanel (line 723)
  条件: isSelected && onStartNarrative
  → onStartNarrative 为 undefined → 按钮不渲染
```

### 关键代码位置

| 文件 | 行号 | 问题 |
|------|------|------|
| `src/components/RAGChat/index.tsx` | 801-826 | 解构时缺少 `onStartNarrative` 和 `onLearningPathNodeClick` |
| `src/components/RAGChat/index.tsx` | 859-883 | 传递给 `RAGChatPanel` 时缺少这两个 props |
| `src/components/Learning/LearningPathPanel.tsx` | 723 | 条件渲染依赖 `onStartNarrative` |

## 修复方案

### 修改 1：RAGChatButtonWrapper 解构添加缺失的 props

**文件**: `src/components/RAGChat/index.tsx`
**位置**: 第 801-826 行（解构部分）

在解构中添加：
```tsx
onLearningPathNodeClick,
onStartNarrative,
```

### 修改 2：RAGChatButtonWrapper 传递缺失的 props 给 RAGChatPanel

**文件**: `src/components/RAGChat/index.tsx`
**位置**: 第 859-883 行（`<RAGChatPanel>` 渲染部分）

在传递给 `<RAGChatPanel>` 的 props 中添加：
```tsx
onLearningPathNodeClick={onLearningPathNodeClick}
onStartNarrative={onStartNarrative}
```

## 验证步骤

1. 运行 `npm run check` 确认类型检查通过
2. 运行 `npm run lint` 确认代码规范通过
3. 启动开发服务器，按以下路径验证按钮可见：
   - 打开图谱编辑器
   - 点击左下角浮动按钮打开 RAGChat 面板
   - 切换到导师模式（学位帽图标）
   - 切换到"学习路径"标签
   - 选中一条学习路径
   - 确认"叙事播放"蓝色按钮出现在路径卡片的按钮行中

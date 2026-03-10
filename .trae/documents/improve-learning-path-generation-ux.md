# 学习路径生成用户体验改进计划

## 问题描述

用户反馈：在思维导图中生成学习路径时，点击"生成学习路径"按钮后：
1. 用户感知不到正在生成
2. 没有消息提示"已收到请求"
3. 缺少进度指示

## 当前实现分析

### LearningPathWizard.tsx

**当前流程：**
```tsx
const handleComplete = async () => {
  setIsGenerating(true);
  try {
    onComplete({...}); // 调用父组件的回调
  } finally {
    setIsGenerating(false);
  }
};
```

**问题：**
1. 只在按钮上显示"生成中..."文字
2. 没有调用 `addMessage` 显示消息提示
3. 没有进度指示器

### LearningPathPanel.tsx

**handleWizardComplete 函数：**
```tsx
const handleWizardComplete = async (data) => {
  setIsGenerating(true);
  try {
    const result = await api.learningPath.generate({...});
    setTempPath(result);
    addMessage({ type: 'success', content: 'AI 学习路径已生成！...' });
  } catch (error) {
    handleError(error, {...});
  } finally {
    setIsGenerating(false);
  }
};
```

**问题：**
1. 只在成功后才显示消息
2. 没有在开始时显示"已收到请求"的消息
3. 没有进度反馈

## 解决方案

### 1. 添加即时反馈消息

**修改位置：** `LearningPathWizard.tsx` 的 `handleComplete` 函数

**改进内容：**
- 点击按钮后立即显示消息："正在为您生成学习路径，请稍候..."
- 使用 `addMessage` 显示 info 类型的消息

### 2. 添加进度指示器

**修改位置：** `LearningPathPanel.tsx`

**改进内容：**
- 在生成过程中显示进度模态框或覆盖层
- 显示动画和进度文字
- 可能显示预计时间

### 3. 改进消息提示

**修改位置：** `LearningPathPanel.tsx` 的 `handleWizardComplete` 函数

**改进内容：**
- 开始时：显示"已收到请求，AI 正在分析图谱..."
- 进行中：显示进度状态
- 完成时：显示"学习路径生成完成！"

## 实施步骤

### 步骤 1: 修改 LearningPathWizard.tsx

1. 在 `handleComplete` 函数中添加消息提示
2. 传递 `addMessage` 函数到组件

### 步骤 2: 修改 LearningPathPanel.tsx

1. 在 `handleWizardComplete` 开始时添加消息
2. 添加进度覆盖层组件
3. 显示生成状态

### 步骤 3: 添加进度指示器组件（可选）

创建一个 `GenerationProgress` 组件：
- 显示动画
- 显示当前步骤
- 显示预计时间

## 需要修改的文件

1. `src/components/LearningPath/LearningPathWizard.tsx`
   - 添加 `addMessage` prop
   - 在 `handleComplete` 中添加即时反馈

2. `src/components/LearningPath/LearningPathPanel.tsx`
   - 在 `handleWizardComplete` 开始时添加消息
   - 添加进度覆盖层

## 验证方法

1. 进入学习模式页面
2. 点击"学习路径" → "AI 规划"
3. 完成向导步骤
4. 点击"生成学习路径"
5. 应该看到：
   - 消息栏显示"已收到请求..."
   - 进度指示器
   - 完成后的成功消息

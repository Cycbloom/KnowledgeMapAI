# 学习路径面板重构 Spec

## Why

当前学习路径面板存在以下问题需要优化：

1. **UI 重复问题**：标题"学习路径"在面板中显示两次（一次是面板头部，一次是内容区），造成视觉冗余
2. **操作入口不统一**：AI 规划按钮、设置按钮分散在不同位置，缺乏统一的工具栏入口
3. **交互体验不一致**：与文献提取面板等其他面板的 UI 风格不统一，用户学习成本高
4. **功能可发现性差**：核心功能（AI 规划、路径管理）的入口不够醒目

## What Changes

### 核心改动

1. **引入固定顶部工具栏**（参考文献提取面板的实现）
   - 移除重复的标题显示
   - 将 AI 规划、设置、统计等功能整合到统一工具栏
   - 使用 sticky 定位 + glass morphism 效果

2. **优化布局结构**
   - 工具栏始终固定在顶部
   - 内容区域可滚动
   - 状态信息独立显示

3. **保留现有功能**
   - AI 规划向导（LearningPathWizard）
   - 学习路径列表/详情/预览
   - 学习风格和每日时间设置
   - 路径的增删改查操作

### UI 布局设计

```
┌─────────────────────────────────────────────────────┐ ← sticky toolbar
│ [图标] 学习路径          [✨ AI 规划] [⚙️] [📊]    │
├─────────────────────────────────────────────────────┤
│ (可滚动区域)                                        │
│ - 空状态：引导用户使用 AI 规划                       │
│ - 列表状态：显示已保存的学习路径                      │
│ - 预览状态：显示 AI 生成的路径预览                    │
│ - 向导状态：显示 AI 规划向导                         │
└─────────────────────────────────────────────────────┘
```

**工具栏按钮说明**：

| 按钮 | 图标 | 功能 | 显示条件 |
|------|------|------|----------|
| ✨ AI 规划 | `Wand2` 或 `Sparkles` | 打开 AI 规划向导 | 始终显示 |
| ⚙️ 设置 | `Settings2` 或 `Sliders` | 展开/收起学习偏好设置 | 始终显示 |
| 📊 统计 | `BarChart3` | 查看学习统计数据 | 有路径时显示 |

## Impact

- Affected specs:
  - 无（新功能）
- Affected code:
  - `src/components/Learning/LearningPathPanel.tsx` - 主要修改文件
  - `src/components/Learning/LearningPathWizard.tsx` - 可能微调样式
  - `src/i18n/locales/zh-CN.json` - 新增/调整国际化文本
  - `src/i18n/locales/en-US.json` - 新增/调整国际化文本

## ADDED Requirements

### Requirement: 统一顶部工具栏

系统 SHALL 在学习路径面板的**最顶部**提供一个**固定定位（sticky）**的工具栏。

#### 场景 1: 默认状态（无路径时）

**WHEN** 用户打开学习路径面板且没有已保存的学习路径

**THEN** 工具栏 SHALL 显示：

```
[Route 图标] 学习路径              [✨ AI 规划] [⚙️]
```

- 左侧：图标 + 标题"学习路径"
- 右侧：AI 规划按钮（主要操作，突出显示）+ 设置按钮

#### 场景 2: 有路径时

**WHEN** 用户有已保存的学习路径

**THEN** 工具栏 SHALL 显示：

```
[Route 图标] 学习路径 (N条)        [✨ AI 规划] [⚙️] [📊]
```

- 标题旁显示路径数量
- 右侧增加统计按钮

#### 场景 3: 生成中状态

**WHEN** AI 正在生成学习路径

**THEN** 工具栏 SHOULD 保持不变

**AND** 在内容区域显示加载动画和进度提示

#### 场景 4: 滚动固定

**WHEN** 面板内容超出可视区域并向下滚动

**THEN** 工具栏 SHALL 保持固定在顶部可见位置（`position: sticky; top: 0; z-index: 20`）

**AND** 工具栏 SHOULD 有半透明背景 + 模糊效果（`backdrop-blur-md`）

### Requirement: AI 规划功能保持不变

系统的 AI 规划功能 SHALL 保持现有的完整实现。

**WHEN** 用户点击"AI 规划"按钮

**THEN** 系统 SHALL 打开 LearningPathWizard 向导组件

**AND** 向导流程保持不变：
1. 选择学习目标
2. 评估前置知识
3. （可选）创建前置知识图谱
4. 设置学习偏好

**AND** 完成后调用 `api.learningPath.generate()` 生成路径

### Requirement: 设置面板优化

系统 SHALL 提供学习偏好设置的快捷访问。

**WHEN** 用户点击设置按钮（⚙️）

**THEN** 系统 SHALL 在工具栏下方展开设置面板（使用 AnimatePresence 动画）

**AND** 设置面板包含：
- 学习风格选择（顺序/探索/专注）
- 每日学习时间滑块（10-120 分钟）
- "生成预览"按钮（仅当无临时路径时显示）

### Requirement: 移除重复标题

系统 SHALL NOT 在内容区域重复显示"学习路径"标题。

**当前问题**：
- 第 544 行：`<h2>{t("learning.learningPath.title")}</h2>` 在列表视图中显示
- 外层容器可能也有标题

**解决方案**：
- 仅在工具栏显示一次标题
- 内容区域直接显示路径列表或空状态引导

## MODIFIED Requirements

### Requirement: 空状态引导优化

之前的空状态引导应更加突出 AI 规划功能。

**WHEN** 没有学习路径且不在生成中

**THEN** 内容区域 SHALL 显示：

```
        🎯
   暂无学习路径
 让 AI 为你定制个性化学习路径
 
[✨ 开始 AI 规划]
```

**AND** "开始 AI 规划"按钮 SHOULD 使用渐变背景色（`bg-gradient-to-r from-primary-500 to-pink-500`）

**AND** 点击后触发 AI 规划向导

### Requirement: 列表视图优化

已保存的学习路径列表 SHALL 采用更紧凑的卡片式布局。

**WHEN** 有多个学习路径

**THEN** 每个路径卡片 SHALL 包含：
- 路径名称 + 状态标签
- 进度条（如有）
- 统计信息（节点数、预估时间、完成度）
- 操作按钮组（选择、暂停/继续、删除）

**AND** 卡片之间间距为 `space-y-2`

## Implementation Notes

### 1. 工具栏实现参考

```tsx
const renderToolbar = () => (
  <div className="sticky top-0 z-20 rounded-lg border bg-gray-50 dark:bg-slate-900/95 backdrop-blur-md border-gray-200 dark:border-slate-700 shadow-sm mx-0 mb-4">
    <div className="flex items-center justify-between px-3 py-2">
      {/* 左侧：标题 */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg">
          <Route className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {t("learning.learningPath.title")}
          </h2>
          {graphPaths.length > 0 && (
            <p className="text-xs text-gray-500">
              {t("learning.learningPath.pathCount", { count: graphPaths.length })}
            </p>
          )}
        </div>
      </div>

      {/* 右侧：操作按钮 */}
      <div className="flex items-center gap-2">
        <button onClick={() => setViewMode("wizard")} className="...">
          <Wand2 size={14} />
          {t("learning.learningPath.aiPlan")}
        </button>
        <button onClick={() => setShowSettings(!showSettings)} className="...">
          <Settings2 size={20} />
        </button>
        {graphPaths.length > 0 && (
          <button onClick={() => ...} className="...">
            <BarChart3 size={20} />
          </button>
        )}
      </div>
    </div>

    {/* 设置面板展开区域 */}
    <AnimatePresence>
      {showSettings && (
        <motion.div ...>
          {/* 学习风格 + 每日时间 */}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);
```

### 2. 关键改动点

**LearningPathPanel.tsx**:

1. **移除第 538-571 行的重复标题区块**，替换为工具栏组件
2. **将第 573-625 行的设置面板**移入工具栏内部
3. **优化第 832-850 行的空状态**，使其更简洁
4. **保持所有业务逻辑不变**（API 调用、状态管理等）

### 3. 样式一致性

- 工具栏样式与文献提取面板保持一致
- 使用相同的圆角（`rounded-lg`）、阴影（`shadow-sm`）、内边距（`px-3 py-2`）
- 按钮统一样式：`px-2.5 py-1.5 text-xs font-medium rounded-md`
- 分隔线：`w-px h-5 bg-gray-300 dark:bg-slate-600`

### 4. 国际化新增键值

```json
{
  "learning": {
    "learningPath": {
      "toolbar": {
        "aiPlan": "AI 规划",
        "settings": "设置",
        "statistics": "统计"
      },
      "emptyState": {
        "title": "暂无学习路径",
        "description": "让 AI 为你定制个性化学习路径",
        "startPlanning": "开始 AI 规划"
      }
    }
  }
}
```

## 当前代码分析总结

### 现有实现优点
1. ✅ 功能完整：支持 AI 规划、路径 CRUD、进度追踪
2. ✅ 向导流程合理：4 步引导，包含前置知识检测
3. ✅ 状态管理清晰：viewMode 区分不同视图
4. ✅ 错误处理完善：useError hook 统一处理

### 需要优化的问题
1. ❌ 标题重复：工具栏和内容区都显示"学习路径"
2. ❌ 操作分散：AI 规划按钮在内容区，不够醒目
3. ❌ 缺少固定工具栏：滚动时操作按钮不可见
4. ❌ 与其他面板风格不统一

### AI 规划流程（现状）
```
用户点击 "AI 规划"
    ↓
打开 LearningPathWizard (viewMode = "wizard")
    ↓
Step 1: 调用 api.learningPath.getQuestions() 获取建议目标
    ↓
Step 2: 用户选择目标 + 评估前置知识
    ↓
Step 3: (可选) 为不了解的知识创建前置图谱
    ↓
Step 4: 设置学习风格 + 每日时间
    ↓
调用 handleWizardComplete()
    ↓
调用 api.learningPath.generate() 生成路径
    ↓
显示预览 (viewMode = "create")
    ↓
用户保存或重新规划
```

## 下一步行动

建议分阶段实施：

**Phase 1**（本次）：工具栏重构 + 移除重复标题
**Phase 2**（后续）：优化空状态和列表样式
**Phase 3**（可选）：添加统计面板功能

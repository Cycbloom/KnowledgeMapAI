# 学习中心题目 UI 优化计划

## 用户需求确认

根据用户反馈：
- **选项布局**：紧凑单列 - 保持单列，减小内边距和间距
- **题目高度**：动态缩小 - 题目超过 2 行时自动缩小字体
- **UI 风格**：卡片式 - 选项卡片使用渐变背景和阴影，更有层次感

---

## 实施计划

### 1. 选项区域优化

**当前代码**（第 765-800 行）：
```tsx
<div className="grid grid-cols-1 gap-4 mt-8">
  {currentOptions.map((option, idx) => (
    <button className="p-5 rounded-2xl border-2 ...">
      <span className="w-8 h-8 ...">A</span>
      <span className="flex-1 pt-0.5 font-medium">{option}</span>
    </button>
  ))}
</div>
```

**优化后**：
```tsx
<div className="flex flex-col gap-2 mt-4">
  {currentOptions.map((option, idx) => (
    <button className="group p-3 rounded-xl border transition-all duration-200
                       bg-gradient-to-r from-white to-gray-50
                       hover:from-indigo-50 hover:to-white
                       shadow-sm hover:shadow-md ...">
      <span className="w-7 h-7 rounded-lg ... text-sm">A</span>
      <span className="flex-1 text-sm">{option}</span>
    </button>
  ))}
</div>
```

**改动点**：
- 间距：`gap-4` → `gap-2`（更紧凑）
- 内边距：`p-5` → `p-3`（更紧凑）
- 圆角：`rounded-2xl` → `rounded-xl`（更精致）
- 字母标签：`w-8 h-8` → `w-7 h-7`（更小）
- 添加渐变背景和阴影效果

### 2. 题目区域优化

**当前代码**（第 717-726 行）：
```tsx
<div className="flex flex-col items-start text-left">
  <h3 className="uppercase tracking-widest text-[11px] font-bold mb-4 ...">问题</h3>
  <div className="text-xl md:text-2xl font-semibold leading-relaxed ...">
    {currentCard.question}
  </div>
</div>
```

**优化后**：
```tsx
<div className="flex flex-col items-start text-left">
  <h3 className="uppercase tracking-widest text-[11px] font-bold mb-3 ...">问题</h3>
  <div className="text-lg md:text-xl font-semibold leading-snug line-clamp-4 
                  [&:nth-line(n+3)]:text-base ...">
    {currentCard.question}
  </div>
</div>
```

**改动点**：
- 字体大小：`text-xl md:text-2xl` → `text-lg md:text-xl`（稍小）
- 行高：`leading-relaxed` → `leading-snug`（更紧凑）
- 添加 `line-clamp-4` 限制最大 4 行
- 长题目时动态缩小字体

### 3. 卡片式 UI 美化

**选项卡片样式**：
```css
/* 默认状态 */
bg-gradient-to-r from-white to-slate-50
border-slate-200
shadow-sm

/* 悬停状态 */
hover:from-indigo-50 hover:to-white
hover:border-indigo-300
hover:shadow-md

/* 选中状态 */
bg-gradient-to-r from-indigo-100 to-indigo-50
border-indigo-400
shadow-md

/* 正确状态 */
bg-gradient-to-r from-emerald-100 to-emerald-50
border-emerald-400
shadow-md

/* 错误状态 */
bg-gradient-to-r from-red-100 to-red-50
border-red-400
shadow-md
```

### 4. 多选题同步优化

多选题（第 802-841 行）应用相同的优化逻辑。

### 5. 判断题优化

判断题（第 843-875 行）保持当前的两列布局，但应用卡片式样式。

---

## 修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `src/pages/Study.tsx` | 选项布局、题目区域、卡片样式 |

---

## 预期效果

1. **选项更紧凑**：四个选项可以在一屏内显示
2. **题目自适应**：长题目自动缩小字体，不影响选项显示
3. **视觉更美观**：渐变背景、阴影效果，更有层次感

# 修复工具栏二级菜单交互问题

## 问题描述

工具栏"设置"菜单中的"导出图谱"二级菜单存在两个问题：

1. **鼠标移不到子菜单上**：鼠标从父菜单项移向右侧子菜单时，子菜单会自动关闭
2. **子菜单溢出窗口**：窗口较小时，子菜单显示在窗口右侧外部，无法看到完整内容

## 当前实现分析

关键文件：[GraphToolbar.tsx](file:///d:/KnowledgeMap/src/components/GraphEditor/toolbar/GraphToolbar.tsx)

### MenuItem 组件（第 1083-1183 行）

- 外层容器 `div.relative` 绑定 `onMouseEnter`/`onMouseLeave`
- 子菜单面板定位：`absolute top-0 left-full ml-1`（在父项右侧，4px 间距）
- hover 模式：鼠标进入展开，鼠标离开立即关闭

### 根因分析

**问题1**：`ml-1`（4px）在父菜单项和子菜单之间创建了间隙。鼠标斜向移动时，会短暂离开 `div.relative` 容器边界，触发 `onMouseLeave`，导致子菜单立即关闭。

**问题2**：子菜单始终使用 `left-full` 定位到右侧，未检测窗口边界，当右侧空间不足时溢出。

## 修改方案

### 修改文件

仅修改 `d:\KnowledgeMap\src\components\GraphEditor\toolbar\GraphToolbar.tsx`

### 改动1：添加鼠标离开延迟，解决子菜单关闭问题

在 `MenuItem` 组件中引入关闭延迟机制：

- 新增 `closeTimerRef = useRef<ReturnType<typeof setTimeout>>()` 用于存储关闭定时器
- `onMouseLeave` 时设置 150ms 延迟后再关闭子菜单
- `onMouseEnter` 时清除延迟定时器，防止误关闭

具体改动：
```tsx
// 在 MenuItem 组件内部
const closeTimerRef = useRef<ReturnType<typeof setTimeout>>();

const handleClose = useCallback(() => {
  if (children && !keepOpenOnChildClick) {
    closeTimerRef.current = setTimeout(() => {
      setInternalSubMenuOpen(false);
    }, 150);
  }
}, [children, keepOpenOnChildClick]);

const handleOpen = useCallback(() => {
  if (children && !keepOpenOnChildClick) {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    setInternalSubMenuOpen(true);
  }
}, [children, keepOpenOnChildClick]);

// 清理定时器
useEffect(() => {
  return () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
  };
}, []);
```

将 `onMouseEnter`/`onMouseLeave` 替换为 `handleOpen`/`handleClose`。

### 改动2：自动检测空间并翻转子菜单方向

在 `MenuItem` 组件中添加位置检测逻辑：

- 新增 `subMenuRef = useRef<HTMLDivElement>(null)` 和 `menuContainerRef = useRef<HTMLDivElement>(null)`
- 新增 `subMenuPosition` 状态（`'right' | 'left'`），默认 `'right'`
- 当子菜单打开时，检测父菜单项的位置：
  - 如果父菜单项右边缘 + 子菜单宽度 > 窗口宽度，则设置为 `'left'`
  - 否则保持 `'right'`
- 根据位置状态动态切换 CSS 类：
  - `'right'`：`left-full ml-1`（原样式）
  - `'left'`：`right-full mr-1`（翻转到左侧）

具体改动：
```tsx
const [subMenuPosition, setSubMenuPosition] = useState<'right' | 'left'>('right');
const menuContainerRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (isOpen && menuContainerRef.current) {
    const rect = menuContainerRef.current.getBoundingClientRect();
    const submenuWidth = 192; // w-48 = 12rem = 192px
    const shouldFlipLeft = rect.right + submenuWidth > window.innerWidth;
    setSubMenuPosition(shouldFlipLeft ? 'left' : 'right');
  }
}, [isOpen]);
```

子菜单 div 的 className 根据位置动态变化：
```tsx
className={`absolute top-0 ${
  subMenuPosition === 'right'
    ? 'left-full ml-1'
    : 'right-full mr-1'
} p-2 rounded-xl shadow-2xl border w-48 z-50 flex flex-col gap-1 ${themeClasses.dropdown} animate-in fade-in ${
  subMenuPosition === 'right'
    ? 'slide-in-from-left-2'
    : 'slide-in-from-right-2'
} duration-150`}
```

同时，对一级 DropdownButton 的下拉面板也做类似的空间检测（下拉面板定位在 `top-full left-0 mt-2`），如果右侧空间不足，翻转到左侧 `right-0`。

### 改动3：一级下拉菜单也做溢出检测

DropdownButton 的下拉面板当前固定 `left-0`，当工具栏在最右侧时，面板可能溢出。

- 给 DropdownButton 的下拉面板添加类似的检测逻辑
- 当右侧空间不足时，改为 `right-0` 对齐

## 验证步骤

1. `npm run check` — 类型检查通过
2. `npm run lint` — 代码规范检查通过
3. 手动测试：
   - 打开知识图谱 → 设置 → 导出图谱：鼠标从父项移向子菜单，子菜单不应关闭
   - 缩小窗口宽度，使右侧空间不足 → 打开导出子菜单：子菜单应翻转到左侧显示
   - 不同窗口大小下测试一级下拉菜单的位置是否正确

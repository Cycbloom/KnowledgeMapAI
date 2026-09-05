# 移动端（Android）需求文档 — 端上学习闭环

> 状态：需求评审 | 日期：2026-09-05 | 平台：Android（Capacitor）| 优先级：P0

## 1. 背景与现状

### 1.1 项目形态
- 目标平台：Electron 桌面（主）+ Web（辅）。当前**已是响应式 Web App**，窄屏下已能渲染移动端 UI。
- Android 通过 **Capacitor** 将同一套 React 代码渲染进 WebView 打包（`package.json` 已有 `mobile:*` 脚本）。
- **结论**：本项目不是"从零做手机端"，而是**在已有移动壳层上做功能裁剪 + 首屏定制 + 窄屏打磨**。

### 1.2 移动壳层已具备的能力
| 能力 | 现状 | 位置 |
|---|---|---|
| 响应式壳层 | `useIsMobile()` 区分移动/桌面，窄屏走抽屉+底部 Tab | `src/hooks/common/useIsMobile.ts` |
| 底部 Tab + More | 按 `navItems` 的 `main`/`more` 分类渲染；含 `--safe-area-inset-bottom` 刘海适配 | `src/components/Layout/MobileBottomNav.tsx` |
| 移动侧边抽屉 | 抽屉入口已有 | `src/components/Layout/MobileSidebarDrawer.tsx` |
| 番茄钟（移动版） | 已存在，Layout 按 isMobile 切换 `MobileFocusTimer`/`FocusTimer` | Layout.tsx:822 |
| 移动手势 | 返回滑动、导航返回已接好 | `useSwipeBack` / `useNavigateBack` |
| 答题窄屏适配 | 闪卡/专注布局、答题侧边栏展开/折叠已做 | `QuizFlashLayout`/`QuizFocusLayout` |
| Capacitor 打包 | `mobile:build / open android / run` | package.json |

### 1.3 关键缺口
1. **手机端无功能裁剪**：所有路由在窄屏都可达——底部 Tab 主项 `/`、`/graph-map`、`/notes`、`/study`、`/statistics`，其中 `graph-map`（大图）正是手机端不适用的功能。
2. **首屏未定制**：首页 `/` 是桌面 Dashboard（仪表盘），不是移动端"今日该学什么"的主线入口。
3. 保留页面在**真实 Android WebView** 下的适配未经实测打磨。

## 2. 目标 / 非目标

**目标**
- 手机端只做"**把题做对**"这条学习主线：今日该做 → 做题 → 掌握度反馈 → 激励。
- 底部 Tab 重构为移动学习主线，砍掉大图等创作/高密度视觉功能的导航主入口。
- 首屏定制为「今日任务 + 知识点列表」，点卡片直接进入该知识点做题。
- 番茄钟简单版随进入做题自动启动（复用既有链路）。

**非目标**
- 不做图谱地图 / 图编辑器 / 思维导图的移动端画布级交互。
- 不做笔记编辑、模板管理、图谱样式面板等创作型/维护型功能。
- 不删除任何路由（Web 与桌面共用），仅调整移动端导航暴露入口。
- 不重构移动端壳层与数据层（复用现有全部逻辑）。

## 3. 设计决策

| # | 决策 | 理由 |
|---|---|---|
| A | **技术形态：Capacitor 复用现有 Web App**（保留） | 复用全部后端/FSRS/调度/状态，成本最低、最快见效 |
| B | **首屏定位：今日任务 + 知识点列表** | 决定用户从哪开始，是最贴近学习闭环的入口 |
| C | **番茄钟：简单版，端上做** | 复用 `MobileFocusTimer` + `ExecutionSessionBridge`/`focusTimerLink`，无需新造 |
| D | 导航裁剪改 `routeConfig` 的 `category` 字段即可，不删路由 | Web/桌面共用，只调移动端暴露入口，成本低 |
| E | 保留页面（学习/日历/统计）均为**只读/轻交互**优先 | 手机碎片时间定位，编辑类回桌面 |

## 4. 信息架构：底部 Tab 结构

移动端底部 Tab（`MobileBottomNav`）目标结构：

| Tab | 路由 | 说明 |
|---|---|---|
| 今日 | `/` | **改造首屏**：今日任务 + 知识点列表 + 番茄钟入口 |
| 图谱列表 | `/graphs` | 2026-09-06 追加：进入具体图谱/学习上下文前的中间态选择页 |
| 学习 | `/study` | 闪卡 / 专注模式 / 错题重练 / 题库入口 |
| 日历 | `/calendar` | 排期窗口、知识点聚合展示（只读） |
| 统计 | `/statistics` | 掌握度、连续打卡、经验等级 |
| 更多 | `More` | notes / learning-paths / achievements 等收进 |

共 6 项（5 个 `main` tab + 更多按钮）。

**分类变更**（`src/config/routeConfig.ts`）：
- `graph-map`：`category` 从 `main` 改为 `more`（大图不作主入口）
- `graphs`：`category` 从 `more` 改为 `main`（图谱列表中间态上提为主 tab，位于今日与学习之间）
- `calendar`：`category` 从 `more` 改为 `main`（排期主线上提）

**导航收敛**：`MobileSidebarDrawer` 的更多菜单仅保留移动端适用项，隐藏 semantics 上不适合移动端的入口（如 graph-map 的画布类工具定位弱化）。

## 5. 端上核心闭环

```
今日(调度/到期/排期命中) → 进入知识点做题(答题/闪卡) → 判题/对答案/错题重练
      ↑                                                    ↓
   成就/统计(掌握度/打卡/经验) ←──── 掌握度反馈(稳定性可视化)
```

## 6. 分模块需求

### 6.1 今日首屏（核心新增，唯一的"新增页面"）

**需求**
- 打开 App 第一屏即展示「今天该学什么」。
- 数据聚合来源：`schedulerDecisionService` 的到期复习 / 待复习 / 排期命中知识点;按时序优先级排序。
- 知识点卡片：标题、所属图、到期时间/排序、掌握度徽章；**点卡片直接进入该知识点做题**。
- 顶部/角落放番茄钟入口（进入做题自动启动）。
- 移动优先布局：单列卡片流，无整页滚动负担（滚动下沉到卡片列表内部）。

**交互**
- 切换"全部 / 到期 / 待复习 / 今日排期"过滤。
- 空态引导：无任务 → 提示去图谱创建/导入学习任务。

### 6.2 学习 / 做题（P0）
- 复用 `Study.tsx` / `LearningMode` 现有窄屏适配与闪卡/专注布局。
- 强调**单卡做对闭环**：判题、答案对照、错题重练。
- 题库入口：轻量列表 + 可导入卡组（只读浏览，不做编辑）。

### 6.3 日历（P0）
- 复用 `CalendarPage` + `learning_path_schedule` 排期数据。
- 移动端只读展示：按知识点聚合、当日任务数、窗口状态。
- 保留拖拽守卫（不可改期，列入后续补丁）。

### 6.4 统计 + 成就 / 我的（P1）
- `StatisticsCenter` / `Achievements`：掌握度、连续打卡、经验等级。
- 移动端做图标化聚合视图，弱化长表格。

### 6.5 更多（More）
- 只读入口：学习路径 `learning-paths`（目标/进度）、笔记 `notes`（只读查看）、成就 `achievements`。
- 维护向（设置、回收站、模板）不在移动端导航主链路，保留 More 可达但不强化。

### 6.6 番茄钟（简单版）
- 进入做题（有挂靠任务）自动启动 25 分钟番茄钟，走 `startFocusTimerForTask`。
- 状态栏移动版展示（`MobileFocusTimer` 已有），离开暂停保留进度。

## 7. 不做清单（桌面保留）

图谱地图 / 图编辑器 / 思维导图创建、笔记**编辑**、模板管理、图谱样式面板、图关系发现/构建类操作、系统级设置。理由：大图显示不全、创作/拖拽/高密度视觉、或维护型需求，均不适合手机。

## 8. 里程碑

| 阶段 | 内容 | 优先级 |
|---|---|---|
| A | **导航 Tab 重排**（graph-map 下移、calendar 上提、drawer 收敛）+ Capacitor 打包跑通 | 高 |
| B | **今日首屏**（任务+知识点聚合、点卡进入做题、番茄钟入口） | 高 |
| C | 保留页面（学习/日历/统计）在真实 Android WebView 的**适配打磨** | 中 |
| D | 成就/我的、学习路径只读、notes 只读（可选迭代） | 低 |

## 9. 验收要点
- 移动端底部 Tab 为「今日 / 学习 / 日历 / 统计 / 更多」，`graph-map` 不再是主入口。
- 打开 App 首屏为「今日任务 + 知识点列表」，点卡片进入对应知识点做题。
- 进入做题自动启动番茄钟，离开暂停；状态栏可见。
- 保留页面在 Android WebView（含刘海、触摸、状态栏）下布局正常、无横向溢出。
- 桌面/Web 端行为不受导航裁剪影响（路由未删除）。

## 10. 参考资料
- 移动壳层：`src/components/Layout/Layout.tsx`、`MobileBottomNav.tsx`、`MobileSidebarDrawer.tsx`
- 导航配置：`src/config/routeConfig.ts`
- 答题窄屏适配：`src/components/Study/QuizFlashLayout.tsx`、`QuizFocusLayout.tsx`
- 番茄钟链路：`src/utils/focusTimerLink.ts` + `ExecutionSessionBridge`
- 排期：`learning_path_schedule`（`supabase/migrations/41_learning_path_scheduling.sql`、`calendarService.ts`）
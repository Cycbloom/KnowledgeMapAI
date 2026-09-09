# 离线版（Mobile Offline Mode）构建指南

> 适用场景：服务器因备案等原因手机暂不可达时，先在电脑上把学习数据打包进 APK，
> 手机端完全离线学习（今日 / 学习 / 做题 / 统计 / 学习资料阅读），学习记录先存本地，
> 备案通过后一键回传服务器。

---

## 一、离线版是什么

离线版与普通手机版使用同一套代码，通过**构建开关 + 内置数据包**切换：

```
电脑端（有数据，可联网）                    手机端（完全离线）
┌──────────────────────────┐            ┌──────────────────────────────┐
│ 生成图谱/卡片/题目/学习资料 │            │ IndexedDB (KnowledgeMapOffline)│
│      │                  │            │  · 图谱/知识点/卡片/题库       │
│ npm run db:export:offline│  打进APK    │  · 复习日志/答题会话/操作日志   │
│      ▼                  │ ────────▶  │                              │
│ public/offline/bundle.json│           │ 客户端 FSRS 调度（ts-fsrs）     │
└──────────────────────────┘            │ 免登录本地身份                 │
                                        └──────────────┬───────────────┘
                                             备案通过、联网后
                                        「同步离线记录」回传服务器
```

关键机制：

| 机制 | 说明 |
|---|---|
| 离线模式检测 | Capacitor 移动端（`isCapacitorMobile()`）且内置数据包存在时自动激活；构建时 `VITE_OFFLINE_MODE=true` 显式开启，设 `false` 可强制关闭 |
| 数据包导入 | 首次启动/数据包版本升级时导入 IndexedDB；**本地记录表永不随数据包覆盖** |
| 卡片合并规则 | 重新导入时本地卡与数据包卡按 `last_reviewed` 取新者——离线复习进度不会因更新数据包而丢失 |
| 免登录 | 离线模式写入本地伪身份，绕过登录守卫，不访问网络 |
| 记录回传 | 复习/答题写入 `op_log`（含 `clientOpId`），联网后 POST `/api/v1/offline-sync`，服务端幂等落库 |

---

## 二、前置条件

### 工具链

| 工具 | 说明 |
|---|---|
| Node.js 18+ / npm | 项目开发环境 |
| Capacitor CLI + Android SDK | `npx cap` 系列命令依赖；Android Studio / JDK 17+ 用于打 APK |
| Supabase 可访问 | 导出脚本需要连数据库（本地 `npm run db:local:start` 或远程实例 + service role key） |

### 环境变量

**`.env`（导出数据包用，PC 端脚本读取）**

```dotenv
VITE_SUPABASE_URL=https://你的-supabase
SUPABASE_SERVICE_ROLE_KEY=你的-service-role-key   # 导出需要，前端不暴露
```

**`.env.mobile`（构建 APK 用）** —— 沿用现有手机版配置即可：

```dotenv
VITE_SUPABASE_URL=https://你的-supabase            # 离线模式不真正调用，可保留真实值
VITE_SUPABASE_ANON_KEY=你的-anon-key
VITE_API_BASE_URL=https://你的服务器/api/v1        # 回传同步必须指向真实服务器
```

> 注意：
> - `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` 即使离线也必须存在（应用启动时 `authConfig` 会读取，
>   缺失会在生产构建直接抛错）。可填占位值，但保持真实值最省事。
> - `VITE_API_BASE_URL` 决定手机回传同步时请求哪个服务器；不填则回退 `/api/v1`，在手机上无法用于同步。

---

## 三、构建步骤（在电脑上）

### 第 1 步：导出离线数据包

确保数据库可访问后执行：

```bash
npm run db:export:offline
```

导出范围：`users`（owner）/ `knowledge_graphs` / `knowledge_points` / `graph_nodes` / `edges` /
`study_cards` / `quiz_sets` / `quiz_set_cards`，输出到 **`public/offline/bundle.json`**（已 gitignore，含个人数据不入库）。

常用参数：

```bash
npm run db:export:offline -- --user <ownerId>      # 指定用户（默认取第一个用户）
npm run db:export:offline -- --output xxx.json     # 自定义输出路径
```

### 第 2 步：构建 Web 资源并同步到 Android 工程

```bash
npm run mobile:sync:offline
# 等价于：npm run mobile:build:offline && npx cap sync
```

- `mobile:build:offline` = `cross-env MOBILE_BUILD=true VITE_OFFLINE_MODE=true vite build --mode mobile`
- 产物在 `dist/`（含 `offline/bundle.json`），`cap sync` 拷贝到 `android/` 工程。

> 不要用 `npm run mobile:build` / `mobile:sync`（普通在线版）或 `mobile:build:debug`（它内部走 `mobile:sync`），
> 否则不会内置数据包、无法激活离线模式。

### 第 3 步：产出 APK

方式 A：命令行（推荐）

```bash
node scripts/run-gradlew.mjs assembleDebug     # 调试包（直接装手机测试）
node scripts/run-gradlew.mjs assembleRelease    # 发布包（需配置签名）
```

APK 输出位置：`android/app/build/outputs/apk/<variant>/`。

方式 B：Android Studio

```bash
npx cap open android
```

在 Studio 里 Build → Build APK(s)，或直接 Run 到已连接的手机/模拟器。

### 第 4 步：安装到手机

- 命令行：`npx cap run android`（需手机开 USB 调试），或把 APK 拷贝到手机安装。
- **更新 App 时用覆盖安装（`adb install -r` 或应用内更新），不要先卸载再装**——卸载会清空本地学习记录。

---

## 四、更新数据（内容变动时）

数据在电脑上有变动（新增图谱/卡片/学习资料等）后：

```bash
npm run db:export:offline          # 1. 重新导出（bundle.version 不变则沿用，建议内容大改前自行确认）
npm run mobile:sync:offline        # 2. 重新构建 + 同步
node scripts/run-gradlew.mjs assembleDebug   # 3. 重新打 APK
# 4. 覆盖安装到手机
```

**本地记录保留规则**：
- 重新导入数据包会刷新内容表（图谱/卡片/题库），
- `study_cards` 按 `last_reviewed` 合并：手机上复习过的卡保留本地新进度，未复习的卡采用数据包新版；
- `review_logs` / `quiz_sessions` / `op_log` 本地记录表永远不清空。
- 若手机端已产生大量待回传记录，建议先联网同步再更新数据包，避免记录堆积。

---

## 五、离线记录回传服务器（备案通过后）

### 前置条件

1. 手机能访问服务器；
2. APK 构建时 `.env.mobile` 的 `VITE_API_BASE_URL` 指向真实服务器；
3. 手机上有真实登录态（首次同步会引导登录）。

### 操作

1. 打开 App → 「今日」页底部 → **同步离线记录**（显示待同步条数）；
2. 若提示需要登录：先登录（用与导出数据包相同的 owner 账号），再点同步；
3. 成功后待同步数归零。

### 服务端如何落库

- `POST /api/v1/offline-sync`（`requireAuth`）接收 `{ operations: [{ clientOpId, table, action, recordId, data, timestamp }] }`；
- `study_cards` 更新：仅应用 FSRS 白名单字段，`last_reviewed` 时间守卫防回滚；
- `quiz_sessions`：落 `learning_sessions` + `learning_session_results`（与线上答题同表）；
- **幂等**：以 `clientOpId` 写入 `sync_operations`，重复提交自动跳过，不会产生重复记录。

---

## 六、离线功能覆盖矩阵

| 功能 | 离线支持 | 说明 |
|---|---|---|
| 今日首屏（到期知识点/今日概览） | ✅ | 纯本地计算 |
| 学习中心（卡片浏览/筛选/语义分组空态） | ✅ | 读 IndexedDB |
| 闪卡复习 + 客户端 FSRS 进度 | ✅ | 本地调度 + 本地记录 |
| 测验（客观题判分/答题记录） | ✅ | AI 主观题判分降级为「请人工核对」 |
| 统计中心 | ✅ | 基于本地卡片/日志聚合 |
| 学习模式（大纲 + 学习资料阅读） | ✅ | `nodes.get`/`graphs.getNodes` 离线实现 |
| 图谱列表浏览 | ✅ | 只读 |
| 日历页 | ⚠️ 有限 | 依赖调度器接口，离线为空/报错态 |
| 图谱编辑器（画布） | ⚠️ 有限 | 只读浏览，编辑类操作不可用 |
| AI 生成（学习资料/题目/扩图） | ❌ | 需联网服务 |
| 学习路径/任务中心 | ❌ | 依赖调度器 |

---

## 七、常见问题

| 现象 | 原因与解决 |
|---|---|
| `Gradle requires JVM 17 or later` | 默认 `java`/`JAVA_HOME` 指向旧 JDK（如 JDK 8）。安装 JDK 21（如解压版 Temurin 到 `D:\jdk21`），并在 `android/gradle.properties` 加 `org.gradle.java.home=D\:\\jdk21\\jdk-21.x.x+x` 指向它 |
| `无效的源发行版：21`（编译失败） | JDK 版本低于 21：Capacitor 7 库按 Java 21 编译，**必须用 JDK 21**（JDK 17 也不行） |
| 离线版升级后图谱节点/连线全空 | 旧版 IndexedDB 缺少 `graph_nodes`/`edges` 表导致导入中断。DB 版本已升级（v2）会自动补建表，**覆盖安装新 APK** 即可；若仍异常（很少见），清除应用数据后重装（会丢失本地记录） |
| 离线模式还在提示「加载未读数失败」等联网错误 | 旧版 APK 未禁用联网组件。新版已：离线包无条件进入离线模式（`VITE_OFFLINE_MODE=true`）、隐藏通知/同步状态等联网组件、禁用恢复联网提示。重新安装新 APK 即可 |
| 构建报 `authConfig` 找不到 URL | `.env.mobile` 缺 `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`，补上即可（离线也不真正调用） |
| 导出脚本报连接失败 | 数据库未启动或 key 错误：本地跑 `npm run db:local:start`；确认 `.env` 的 `SUPABASE_SERVICE_ROLE_KEY` |
| 手机装上后仍是在线模式（请求失败） | 数据包未内置：确认用 `mobile:sync:offline` 构建、`public/offline/bundle.json` 存在于 `dist/` |
| 离线版打开卡在加载页 | 伪身份未写入：多为旧版本覆盖安装异常，清除 App 数据重装一次 |
| 同步按钮提示「请先联网登录」 | 服务器不可达或未登录；备案通过且 `VITE_API_BASE_URL` 正确后，登录再同步 |
| 更新数据包后手机进度没了 | 卸载重装清空了 IndexedDB；应覆盖安装，且合并规则只保护「同一安装内的版本升级」 |
| 学习模式里点开节点没有资料 | 导出前该节点没生成过学习资料（`learning_material` 为空）；先在电脑端大纲多选「📖 批量生成学习资料」再重新导出 |

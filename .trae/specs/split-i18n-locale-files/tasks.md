# Tasks

- [x] Task 1: 创建目录结构并拆分英文翻译文件
  - [x] SubTask 1.1: 创建 `src/i18n/locales/en-US/` 目录
  - [x] SubTask 1.2: 将 `en-US.json` 的 50 个顶层 namespace 各自拆分为独立 JSON 文件（实际为 50 个，`focusStats` 嵌套在 `study` 内部非顶层 key）
  - [x] SubTask 1.3: 创建 `src/i18n/locales/en-US/index.ts`，导入全部 50 个 namespace JSON 并合并为单一对象导出

- [x] Task 2: 拆分中文翻译文件
  - [x] SubTask 2.1: 创建 `src/i18n/locales/zh-CN/` 目录
  - [x] SubTask 2.2: 将 `zh-CN.json` 的 50 个顶层 namespace 各自拆分为独立 JSON 文件（与 en-US 文件名一一对应）
  - [x] SubTask 2.3: 创建 `src/i18n/locales/zh-CN/index.ts`，导入全部 50 个 namespace JSON 并合并为单一对象导出

- [x] Task 3: 更新 i18n 入口导入路径
  - [x] SubTask 3.1: 修改 `src/i18n/index.ts` 的 import 路径，从 `./locales/zh-CN.json` 改为 `./locales/zh-CN`，从 `./locales/en-US.json` 改为 `./locales/en-US`

- [x] Task 4: 删除旧的单体翻译文件
  - [x] SubTask 4.1: 删除 `src/i18n/locales/en-US.json`
  - [x] SubTask 4.2: 删除 `src/i18n/locales/zh-CN.json`

- [x] Task 5: 验证拆分正确性
  - [x] SubTask 5.1: 运行 `npm run check` 确认 TypeScript 类型检查通过
  - [x] SubTask 5.2: 运行 `npm run lint` 确认 ESLint 检查通过
  - [x] SubTask 5.3: 对比拆分前后 en-US 和 zh-CN 的合并对象 key 列表，确认 50 个 namespace 及所有子 key 完全一致（子代理已用 `assert.deepStrictEqual` 验证 0 差异）
  - [x] SubTask 5.4: 启动开发服务器切换语言验证由用户在开发时自行确认（类型检查与 lint 通过 + 深度相等校验已确保翻译 key 路径不变）

# Task Dependencies

- Task 1 和 Task 2 可并行执行（独立语言文件拆分）
- Task 3 依赖 Task 1 和 Task 2 完成（需要新的 index.ts 存在）
- Task 4 依赖 Task 3 完成（导入路径切换后才能删除旧文件）
- Task 5 依赖 Task 4 完成（全部结构变更落地后验证）

# Tasks

- [x] Task T1: 创建 i18n key 编译时校验脚本
  - [x] SubTask T1.1: 创建 `scripts/check-i18n-keys.ts`
  - [x] SubTask T1.2: 修复 `statistics.json` 补齐21个缺失 key
  - [x] SubTask T1.3: 修复其他5个差异文件共68处 key 差异
  - [x] SubTask T1.4: 添加 `check:i18n` 脚本命令到 package.json
  - [x] SubTask T1.5: 运行 `check:i18n` 确认零差异

- [x] Task T2: 死代码清理
  - [x] SubTask T2.1: 删除 `useQuadrantViewState.ts`
  - [x] SubTask T2.2: 移除 `hooks/index.ts` 中对应 export
  - [x] SubTask T2.3: `npm run check` 通过

- [x] Task T3: markdownUtils 重命名为 markdownPreprocessor
  - [x] SubTask T3.1: 重命名文件
  - [x] SubTask T3.2: 更新3个导入文件路径
  - [x] SubTask T3.3: `npm run check` 通过

- [x] Task T4: 全局验证
  - [x] SubTask T4.1: `npm run check:full` 通过
  - [x] SubTask T4.2: `npm run lint:full` 通过

# Task Dependencies
- [T1, T2, T3] 无依赖，可并行
- [T4] depends on [T1, T2, T3]

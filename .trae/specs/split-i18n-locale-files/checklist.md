# Checklist

- [x] `src/i18n/locales/en-US/` 目录存在，包含 50 个 JSON 文件和 1 个 `index.ts`（实际 50 个，`focusStats` 嵌套在 `study` 内部）
- [x] `src/i18n/locales/zh-CN/` 目录存在，包含 50 个 JSON 文件和 1 个 `index.ts`
- [x] `en-US/` 和 `zh-CN/` 目录下的 JSON 文件名列表完全一致（均为 50 个同名文件）
- [x] 每个 namespace JSON 文件内容为该 namespace 对象的内部结构（不再包含顶层 namespace 名作为 key）
- [x] `en-US/index.ts` 导入全部 50 个 JSON 文件并合并为单一对象 default 导出
- [x] `zh-CN/index.ts` 导入全部 50 个 JSON 文件并合并为单一对象 default 导出
- [x] `src/i18n/index.ts` 的 import 路径已从 `./locales/zh-CN.json` / `./locales/en-US.json` 改为 `./locales/zh-CN` / `./locales/en-US`
- [x] 原 `src/i18n/locales/en-US.json` 文件已删除
- [x] 原 `src/i18n/locales/zh-CN.json` 文件已删除
- [x] `npm run check` 通过，无类型错误
- [x] `npm run lint` 通过，无 lint 错误
- [x] 拆分后合并的 translation 对象与原 JSON 的 key 结构完全一致（子代理已用 `assert.deepStrictEqual` 验证 0 差异）
- [x] 所有使用 `useTranslation` 的组件代码无任何修改（key 路径不变）

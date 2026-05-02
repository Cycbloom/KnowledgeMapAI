# Tasks

- [x] Task 1: 修改 `authConfig.ts` 移除硬编码凭证
  - [x] SubTask 1.1: 将 `getDefaultUrl()` 和 `getDefaultAnonKey()` 中的生产环境硬编码值改为空字符串
  - [x] SubTask 1.2: 确保开发环境仍使用本地 Supabase 默认值
  - [x] SubTask 1.3: 新增 `isSupabaseConfigured()` 辅助函数

- [x] Task 2: 重写 `Login.tsx` 为配置页面
  - [x] SubTask 2.1: 移除邮箱/密码登录表单
  - [x] SubTask 2.2: 添加"连接 Supabase"卡片区域（URL、Anon Key、Service Role Key、Database URL 输入框）
  - [x] SubTask 2.3: 添加"配置 AI 服务"卡片区域（AI 服务商选择 + API Key 输入）
  - [x] SubTask 2.4: 实现连接测试功能（调用 PUT /api/ai/config/database 测试 Supabase 连接）
  - [x] SubTask 2.5: 实现 AI 配置保存功能（调用 PUT /api/ai/config/providers）
  - [x] SubTask 2.6: 连接成功后自动认证（使用 Supabase Auth 匿名登录或自动注册）
  - [x] SubTask 2.7: 认证成功后跳转主界面
  - [x] SubTask 2.8: 自动填充已保存的配置（从 localStorage 和 Electron config 读取）
  - [x] SubTask 2.9: 显示当前连接状态和 Schema 状态

- [x] Task 3: 修改 `App.tsx` 路由和认证逻辑
  - [x] SubTask 3.1: 移除 `/register` 路由和 Register 懒加载导入
  - [x] SubTask 3.2: 修改 `ProtectedRoute`：未配置 Supabase 时跳转 `/login`（配置页）
  - [x] SubTask 3.3: 修改认证恢复逻辑：未配置 Supabase 时不尝试恢复会话

- [x] Task 4: 国际化与收尾
  - [x] SubTask 4.1: 在 `zh-CN.json` 和 `en-US.json` 中新增配置页面相关翻译（configPage 前缀，46 个 key）
  - [x] SubTask 4.2: 运行 `npm run check` 和 `npm run lint` 确保无错误

# Task Dependencies

- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 2]
- [Task 4] depends on [Task 2, Task 3]

# Tasks

- [x] Task 1: 安装 i18next 依赖并创建基础配置
  - [x] SubTask 1.1: 安装 i18next 和 react-i18next 依赖
  - [x] SubTask 1.2: 创建 src/i18n/index.ts 配置
  - [x] SubTask 1.3: 创建 locales/zh-CN.json 中文翻译文件
  - [x] SubTask 1.4: 创建 locales/en-US.json 英文翻译文件

- [x] Task 2: 扩展错误码定义
  - [x] SubTask 2.1: 在 shared/types/errorCodes.ts 添加登录相关错误码
  - [x] SubTask 2.2: 为每个错误码添加中英文消息映射

- [x] Task 3: 修改 API 错误响应格式
  - [x] SubTask 3.1: 修改 api/middleware/errorHandler.ts 返回错误码
  - [x] SubTask 3.2: 修改 api/routes/auth.ts 使用错误码

- [x] Task 4: 前端集成 i18n
  - [x] SubTask 4.1: 在 App.tsx 初始化 i18n
  - [x] SubTask 4.2: 修改 src/utils/errors.ts 支持翻译
  - [x] SubTask 4.3: 在 Login.tsx 使用翻译后的错误消息

- [x] Task 5: 添加语言切换功能
  - [x] SubTask 5.1: 在用户设置中添加语言选择
  - [x] SubTask 5.2: 持久化语言设置

- [x] Task 6: 验证和测试
  - [x] SubTask 6.1: 运行类型检查
  - [x] SubTask 6.2: 测试中英文错误消息显示

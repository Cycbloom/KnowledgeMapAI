# Tasks

## 阶段一：清理编译产物

- [x] Task 1: 删除 api/ 目录下的编译产物
  - [x] SubTask 1.1: 删除 api/middleware/*.js 和 *.js.map 文件
  - [x] SubTask 1.2: 删除 api/routes/*.js 和 *.js.map 文件
  - [x] SubTask 1.3: 删除 api/routes/ai/*.js 和 *.js.map 文件
  - [x] SubTask 1.4: 删除 api/routes/scheduler/*.js 和 *.js.map 文件
  - [x] SubTask 1.5: 删除 api/services/**/*.js 和 *.js.map 文件
  - [x] SubTask 1.6: 删除 api/utils/*.js 和 *.js.map 文件
  - [x] SubTask 1.7: 删除 api/config/*.js 和 *.js.map 文件
  - [x] SubTask 1.8: 删除 api/constants/*.js 和 *.js.map 文件
  - [x] SubTask 1.9: 删除 api/docs/*.js 和 *.js.map 文件
  - [x] SubTask 1.10: 删除 api/schemas/*.js 和 *.js.map 文件
  - [x] SubTask 1.11: 删除 api/models/*.js 和 *.js.map 文件
  - [x] SubTask 1.12: 删除 api/jobs/*.js 和 *.js.map 文件
  - [x] SubTask 1.13: 删除 api/*.js 和 *.js.map 文件
  - [x] SubTask 1.14: 删除 api/shared/types/*.js 文件

- [x] Task 2: 删除 src/types/ 目录下的编译产物
  - [x] SubTask 2.1: 删除 src/types/*.js 和 *.js.map 文件

- [x] Task 3: 删除 shared/types/ 目录下的编译产物
  - [x] SubTask 3.1: 删除 shared/types/*.js 和 *.js.map 文件

## 阶段二：清理重复模块

- [x] Task 4: 合并 errorCodes 模块
  - [x] SubTask 4.1: 更新所有导入 api/config/errorCodes 的文件，改为从 shared/types/errorCodes 导入
  - [x] SubTask 4.2: 更新所有导入 api/constants/errorCodes 的文件，改为从 shared/types/errorCodes 导入
  - [x] SubTask 4.3: 删除 api/config/errorCodes.ts
  - [x] SubTask 4.4: 删除 api/constants/errorCodes.ts

- [x] Task 5: 清理重复的服务文件
  - [x] SubTask 5.1: 检查 api/services/focusService.ts 的使用情况
  - [x] SubTask 5.2: 确认是独立服务，保留
  - [x] SubTask 5.3: 检查 api/services/taskService.ts 的使用情况
  - [x] SubTask 5.4: 确认是独立服务，保留

## 阶段三：清理临时文件

- [x] Task 6: 删除临时/无用文件
  - [x] SubTask 6.1: 删除 api/n（空文件）
  - [x] SubTask 6.2: 删除 c --noEmit（命令行错误创建的文件）
  - [x] SubTask 6.3: 删除 test-import.db（测试数据库）

## 阶段四：清理开发产物

- [x] Task 7: 删除开发产物目录
  - [x] SubTask 7.1: 删除 dev-dist/ 目录
  - [x] SubTask 7.2: 删除 data/knowledgemap.db 文件
  - [x] SubTask 7.3: 删除 data/knowledgemap.db-shm 文件
  - [x] SubTask 7.4: 删除 data/knowledgemap.db-wal 文件

## 阶段五：清理冗余脚本

- [x] Task 8: 删除一次性修复脚本
  - [x] SubTask 8.1: 删除 scripts/fix-imports.js
  - [x] SubTask 8.2: 删除 scripts/update-imports.js

## 阶段六：更新配置

- [x] Task 9: 更新 .gitignore
  - [x] SubTask 9.1: 添加 TypeScript 编译产物忽略规则
  - [x] SubTask 9.2: 添加开发产物忽略规则
  - [x] SubTask 9.3: 添加本地数据库忽略规则

## 阶段七：验证

- [x] Task 10: 验证清理结果
  - [x] SubTask 10.1: 运行 npm run check 确保类型检查通过
  - [x] SubTask 10.2: 运行 npm run lint 确保代码检查通过（android 构建目录问题不影响）
  - [x] SubTask 10.3: 运行 npm run build 确保构建成功
  - [x] SubTask 10.4: 所有验证通过

# Task Dependencies

- [Task 4] 依赖 [Task 1, Task 2, Task 3]（先清理编译产物，再处理源文件）
- [Task 5] 依赖 [Task 1]（先清理编译产物）
- [Task 10] 依赖 [Task 1-9]（所有清理完成后验证）

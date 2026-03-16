# Tasks

## Phase 1: Electron 基础架构搭建

- [x] Task 1: 初始化 Electron 项目结构
  - [x] SubTask 1.1: 安装 Electron 及相关依赖
  - [x] SubTask 1.2: 创建 electron/ 目录结构
  - [x] SubTask 1.3: 创建主进程入口文件 (main.ts)
  - [x] SubTask 1.4: 创建预加载脚本 (preload.ts)
  - [x] SubTask 1.5: 配置 TypeScript 编译选项

- [x] Task 2: 集成本地服务器
  - [x] SubTask 2.1: 将 Express 服务器嵌入 Electron 主进程
  - [x] SubTask 2.2: 配置服务器端口管理
  - [x] SubTask 2.3: 实现服务器生命周期管理（启动/关闭）
  - [x] SubTask 2.4: 处理开发模式与生产模式的差异

- [x] Task 3: 配置构建流程
  - [x] SubTask 3.1: 安装 electron-builder
  - [x] SubTask 3.2: 配置 electron-builder 打包选项
  - [x] SubTask 3.3: 更新 package.json 脚本命令
  - [x] SubTask 3.4: 配置 Vite 构建输出适配 Electron

## Phase 2: 本地数据库迁移

- [x] Task 4: SQLite 数据库集成
  - [x] SubTask 4.1: 安装 better-sqlite3 或 sqlite3
  - [x] SubTask 4.2: 创建数据库连接管理模块
  - [x] SubTask 4.3: 将 Supabase schema 转换为 SQLite schema
  - [x] SubTask 4.4: 创建数据库迁移系统

- [x] Task 5: 数据库适配层实现
  - [x] SubTask 5.1: 创建数据库抽象接口
  - [x] SubTask 5.2: 实现 SQLite 适配器
  - [x] SubTask 5.3: 保留 Supabase 适配器（可选云端模式）
  - [x] SubTask 5.4: 实现适配器切换逻辑

- [x] Task 6: 数据迁移工具
  - [x] SubTask 6.1: 创建从 Supabase 导出数据的工具
  - [x] SubTask 6.2: 创建导入数据到 SQLite 的工具
  - [x] SubTask 6.3: 实现数据格式转换逻辑

## Phase 3: 认证系统本地化

- [x] Task 7: 本地认证系统
  - [x] SubTask 7.1: 创建本地用户模型
  - [x] SubTask 7.2: 实现密码加密存储
  - [x] SubTask 7.3: 创建本地 JWT 生成/验证
  - [x] SubTask 7.4: 实现登录/注册 API

- [x] Task 8: 认证模式切换
  - [x] SubTask 8.1: 添加认证模式配置（本地/云端）
  - [x] SubTask 8.2: 更新前端认证逻辑
  - [x] SubTask 8.3: 实现认证状态持久化

## Phase 4: 数据同步功能

- [x] Task 9: 同步服务基础架构
  - [x] SubTask 9.1: 设计同步数据格式
  - [x] SubTask 9.2: 创建同步服务模块
  - [x] SubTask 9.3: 实现增量同步逻辑
  - [x] SubTask 9.4: 添加同步状态管理

- [x] Task 10: 局域网同步
  - [x] SubTask 10.1: 实现设备发现服务
  - [x] SubTask 10.2: 创建同步 API 端点
  - [x] SubTask 10.3: 实现同步认证机制
  - [x] SubTask 10.4: 添加同步 UI 界面

- [x] Task 11: 冲突处理
  - [x] SubTask 11.1: 实现冲突检测算法
  - [x] SubTask 11.2: 创建冲突解决 UI
  - [x] SubTask 11.3: 实现自动合并策略

## Phase 5: 应用打包与发布

- [x] Task 12: Windows 打包
  - [x] SubTask 12.1: 配置 NSIS 安装程序
  - [x] SubTask 12.2: 创建便携版
  - [x] SubTask 12.3: 添加应用图标和元数据
  - [x] SubTask 12.4: 测试安装流程

- [x] Task 13: macOS 打包
  - [x] SubTask 13.1: 配置 DMG 打包
  - [x] SubTask 13.2: 处理代码签名（可选）
  - [x] SubTask 13.3: 添加应用图标
  - [x] SubTask 13.4: 测试安装流程

- [x] Task 14: 应用优化
  - [x] SubTask 14.1: 优化应用启动速度
  - [x] SubTask 14.2: 减小应用体积
  - [x] SubTask 14.3: 添加自动更新功能
  - [x] SubTask 14.4: 添加崩溃报告

## Phase 6: 移动端支持

- [x] Task 15: 移动端同步客户端
  - [x] SubTask 15.1: 优化移动端 PWA 体验
  - [x] SubTask 15.2: 添加同步配置界面
  - [x] SubTask 15.3: 实现移动端同步功能

# Task Dependencies

- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 1
- Task 5 depends on Task 4
- Task 6 depends on Task 5
- Task 7 depends on Task 4
- Task 8 depends on Task 7
- Task 9 depends on Task 5
- Task 10 depends on Task 9
- Task 11 depends on Task 10
- Task 12 depends on Task 3, Task 5, Task 7
- Task 13 depends on Task 3, Task 5, Task 7
- Task 14 depends on Task 12, Task 13
- Task 15 depends on Task 10

# 建议实施顺序

**第一阶段（最小可用版本）**:
1. Task 1 → Task 3 → Task 2（基础 Electron 应用）
2. Task 4 → Task 5（本地数据库）
3. Task 7（本地认证）
4. Task 12（Windows 打包）

**第二阶段（功能完善）**:
5. Task 6（数据迁移）
6. Task 9 → Task 10（同步功能）
7. Task 11（冲突处理）

**第三阶段（跨平台与优化）**:
8. Task 13（macOS 支持）
9. Task 14（应用优化）
10. Task 15（移动端支持）

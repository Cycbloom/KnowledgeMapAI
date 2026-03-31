# Agent Session 执行失败问题修复计划

## 问题分析

### 错误信息
```
Failed to execute agent session
at AgentService.executeSession (D:\KnowledgeMap\api\services\agent\AgentService.ts:42:13)
```

错误发生在第 42 行：`throw new Error('Session not found');`

### 根本原因

**问题核心：每次 HTTP 请求都创建新的 `AgentService` 实例**

在 `api/routes/agent.ts` 中：
```typescript
// POST /sessions - 创建 session
const agentService = new AgentService(req.supabase!);  // 实例 A
const session = agentService.createSession(userId, {...});

// POST /sessions/:id/execute - 执行 session  
const agentService = new AgentService(req.supabase!);  // 实例 B
const result = await agentService.executeSession(id, ...);
```

**问题链路**：
1. `AgentService` 构造函数创建新的 `SessionManager` 实例
2. `SessionManager` 使用内存 `Map` 存储 session
3. 创建 session 时存入实例 A 的 Map
4. 执行 session 时在实例 B 的 Map 中查找 → **找不到！**

```
请求 1: POST /sessions
  └─ new AgentService() → SessionManager A → Map A
       └─ createSession() → session 存入 Map A

请求 2: POST /sessions/:id/execute  
  └─ new AgentService() → SessionManager B → Map B
       └─ executeSession() → 从 Map B 查找 → 找不到！
```

## 解决方案

### 方案：将 SessionManager 改为单例模式

修改 `SessionManager.ts`，使其成为全局单例，所有 `AgentService` 实例共享同一个 `SessionManager`。

## 实施步骤

### 步骤 1：修改 SessionManager.ts
将 `SessionManager` 改为单例模式：
- 添加私有静态实例
- 添加静态获取方法
- 私有化构造函数

### 步骤 2：修改 AgentService.ts
更新 `AgentService` 使用单例 `SessionManager`：
- 使用 `SessionManager.getInstance()` 获取实例

### 步骤 3：验证修复
运行测试确保功能正常

## 代码修改

### 修改 1: SessionManager.ts

```typescript
import type { AgentSession, AgentMessage, ToolCall } from './types';

export class SessionManager {
  private static instance: SessionManager;
  private sessions: Map<string, AgentSession> = new Map();
  
  private constructor() {}
  
  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }
  
  // ... 其他方法保持不变
}
```

### 修改 2: AgentService.ts

```typescript
export class AgentService {
  private toolRegistry: ToolRegistry;
  private sessionManager: SessionManager;
  private supabase: SupabaseClient;
  
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.toolRegistry = new ToolRegistry();
    this.sessionManager = SessionManager.getInstance();  // 使用单例
    
    graphTools.forEach(tool => this.toolRegistry.register(tool));
  }
  
  // ... 其他方法保持不变
}
```

## 风险评估

- **低风险**：这是一个简单的重构，只改变实例获取方式
- **向后兼容**：所有公共 API 保持不变
- **测试覆盖**：现有测试应该继续通过

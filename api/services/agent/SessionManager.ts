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
  
  create(userId: string, options: { skillId?: string; graphIds?: string[] }): AgentSession {
    const session: AgentSession = {
      id: crypto.randomUUID(),
      userId,
      status: 'pending',
      skillId: options.skillId,
      graphIds: options.graphIds,
      messages: [],
      toolCalls: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.sessions.set(session.id, session);
    return session;
  }
  
  get(sessionId: string): AgentSession | undefined {
    return this.sessions.get(sessionId);
  }
  
  update(sessionId: string, updates: Partial<AgentSession>): AgentSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    
    Object.assign(session, updates, { updatedAt: new Date() });
    return session;
  }
  
  addMessage(sessionId: string, message: Omit<AgentMessage, 'id' | 'timestamp'>): AgentMessage | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    
    const fullMessage: AgentMessage = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };
    session.messages.push(fullMessage);
    session.updatedAt = new Date();
    return fullMessage;
  }
  
  addToolCall(sessionId: string, toolCall: Omit<ToolCall, 'id' | 'timestamp'>): ToolCall | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    
    const fullToolCall: ToolCall = {
      ...toolCall,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };
    session.toolCalls.push(fullToolCall);
    session.updatedAt = new Date();
    return fullToolCall;
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentSession, AgentMessage, ToolCall, StructuredAnalysisResult } from './types';
import { logger } from '../../utils/logger';

interface DbAgentSession {
  id: string;
  user_id: string;
  status: AgentSession['status'];
  skill_id: string | null;
  graph_ids: string[] | null;
  result: string | null;
  structured_result: StructuredAnalysisResult | null;
  created_at: string;
  updated_at: string;
}

interface DbAgentMessage {
  id: string;
  session_id: string;
  role: AgentMessage['role'];
  content: string;
  tool_name: string | null;
  tool_args: Record<string, unknown> | null;
  tool_result: unknown;
  timestamp: string;
}

interface DbToolCall {
  id: string;
  session_id: string;
  tool_name: string;
  args: Record<string, unknown>;
  result: unknown;
  status: ToolCall['status'];
  timestamp: string;
}

function mapDbToSession(db: DbAgentSession, messages: AgentMessage[] = [], toolCalls: ToolCall[] = []): AgentSession {
  return {
    id: db.id,
    userId: db.user_id,
    status: db.status,
    skillId: db.skill_id ?? undefined,
    graphIds: db.graph_ids ?? undefined,
    result: db.result ?? undefined,
    structuredResult: db.structured_result ?? undefined,
    messages,
    toolCalls,
    createdAt: new Date(db.created_at),
    updatedAt: new Date(db.updated_at),
  };
}

function mapDbToMessage(db: DbAgentMessage): AgentMessage {
  return {
    id: db.id,
    role: db.role,
    content: db.content,
    toolName: db.tool_name ?? undefined,
    toolArgs: db.tool_args ?? undefined,
    toolResult: db.tool_result ?? undefined,
    timestamp: new Date(db.timestamp),
  };
}

function mapDbToToolCall(db: DbToolCall): ToolCall {
  return {
    id: db.id,
    toolName: db.tool_name,
    args: db.args,
    result: db.result ?? undefined,
    status: db.status,
    timestamp: new Date(db.timestamp),
  };
}

export class SessionManager {
  private supabase: SupabaseClient;
  private sessions: Map<string, AgentSession> = new Map();

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async create(userId: string, options: { skillId?: string; graphIds?: string[] }): Promise<AgentSession> {
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

    try {
      const { error } = await this.supabase.from('agent_sessions').insert({
        id: session.id,
        user_id: userId,
        status: 'pending',
        skill_id: options.skillId ?? null,
        graph_ids: options.graphIds ?? [],
      });
      if (error) {
        logger.error('Failed to insert agent session to DB', { error: error.message, sessionId: session.id });
      }
    } catch (e) {
      logger.error('Failed to insert agent session to DB', { error: (e as Error).message, sessionId: session.id });
    }

    this.sessions.set(session.id, session);
    return session;
  }

  async get(sessionId: string): Promise<AgentSession | undefined> {
    const cached = this.sessions.get(sessionId);
    if (cached) return cached;

    try {
      const [sessionRes, messagesRes, toolCallsRes] = await Promise.all([
        this.supabase.from('agent_sessions').select('*').eq('id', sessionId).single(),
        this.supabase.from('agent_messages').select('*').eq('session_id', sessionId).order('timestamp', { ascending: true }),
        this.supabase.from('agent_tool_calls').select('*').eq('session_id', sessionId).order('timestamp', { ascending: true }),
      ]);

      if (sessionRes.error) {
        logger.error('Failed to query agent session from DB', { error: sessionRes.error.message, sessionId });
        return undefined;
      }
      if (!sessionRes.data) return undefined;

      const messages = (messagesRes.data ?? []).map(mapDbToMessage);
      const toolCalls = (toolCallsRes.data ?? []).map(mapDbToToolCall);
      const session = mapDbToSession(sessionRes.data as DbAgentSession, messages, toolCalls);

      this.sessions.set(session.id, session);
      return session;
    } catch (e) {
      logger.error('Failed to query agent session from DB', { error: (e as Error).message, sessionId });
      return undefined;
    }
  }

  async update(sessionId: string, updates: Partial<AgentSession>): Promise<AgentSession | undefined> {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    const updatedSession: AgentSession = {
      ...session,
      ...updates,
      updatedAt: new Date(),
    };

    try {
      const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.result !== undefined) dbUpdates.result = updates.result;
      if (updates.structuredResult !== undefined) dbUpdates.structured_result = updates.structuredResult;

      const { error } = await this.supabase
        .from('agent_sessions')
        .update(dbUpdates)
        .eq('id', sessionId);
      if (error) {
        logger.error('Failed to update agent session in DB', { error: error.message, sessionId });
      }
    } catch (e) {
      logger.error('Failed to update agent session in DB', { error: (e as Error).message, sessionId });
    }

    this.sessions.set(sessionId, updatedSession);
    return updatedSession;
  }

  async addMessage(sessionId: string, message: Omit<AgentMessage, 'id' | 'timestamp'>): Promise<AgentMessage | undefined> {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    const fullMessage: AgentMessage = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };

    try {
      const { error } = await this.supabase.from('agent_messages').insert({
        id: fullMessage.id,
        session_id: sessionId,
        role: message.role,
        content: message.content,
        tool_name: message.toolName ?? null,
        tool_args: message.toolArgs ?? null,
        tool_result: message.toolResult ?? null,
        timestamp: fullMessage.timestamp.toISOString(),
      });
      if (error) {
        logger.error('Failed to insert agent message to DB', { error: error.message, sessionId, messageId: fullMessage.id });
      }
    } catch (e) {
      logger.error('Failed to insert agent message to DB', { error: (e as Error).message, sessionId, messageId: fullMessage.id });
    }

    session.messages.push(fullMessage);
    session.updatedAt = new Date();
    return fullMessage;
  }

  async addToolCall(sessionId: string, toolCall: Omit<ToolCall, 'id' | 'timestamp'>): Promise<ToolCall | undefined> {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    const fullToolCall: ToolCall = {
      ...toolCall,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };

    try {
      const { error } = await this.supabase.from('agent_tool_calls').insert({
        id: fullToolCall.id,
        session_id: sessionId,
        tool_name: toolCall.toolName,
        args: toolCall.args,
        result: toolCall.result ?? null,
        status: toolCall.status,
        timestamp: fullToolCall.timestamp.toISOString(),
      });
      if (error) {
        logger.error('Failed to insert agent tool call to DB', { error: error.message, sessionId, toolCallId: fullToolCall.id });
      }
    } catch (e) {
      logger.error('Failed to insert agent tool call to DB', { error: (e as Error).message, sessionId, toolCallId: fullToolCall.id });
    }

    session.toolCalls.push(fullToolCall);
    session.updatedAt = new Date();
    return fullToolCall;
  }

  async getByUserId(userId: string): Promise<Omit<AgentSession, 'messages' | 'toolCalls'>[]> {
    try {
      const { data, error } = await this.supabase
        .from('agent_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to query agent sessions by userId from DB', { error: error.message, userId });
        return [];
      }

      return (data as DbAgentSession[]).map((db) => {
        const session = mapDbToSession(db);
        const { messages: _messages, toolCalls: _toolCalls, ...metadata } = session;
        return metadata;
      });
    } catch (e) {
      logger.error('Failed to query agent sessions by userId from DB', { error: (e as Error).message, userId });
      return [];
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('agent_sessions')
        .delete()
        .eq('id', sessionId);
      if (error) {
        logger.error('Failed to delete agent session from DB', { error: error.message, sessionId });
        return false;
      }

      this.sessions.delete(sessionId);
      return true;
    } catch (e) {
      logger.error('Failed to delete agent session from DB', { error: (e as Error).message, sessionId });
      return false;
    }
  }
}

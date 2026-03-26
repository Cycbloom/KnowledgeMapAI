import { SupabaseClient } from '@supabase/supabase-js';
import { getPaginationParams, PaginationOptions } from '../utils/pagination';

export interface FocusSession {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  duration: number;
  mode: 'focus' | 'shortBreak' | 'longBreak';
  completed: boolean;
  created_at: string;
}

export interface FocusStats {
  total: {
    sessions: number;
    minutes: number;
  };
  today: {
    sessions: number;
    minutes: number;
  };
  byMode: {
    focus: number;
    shortBreak: number;
    longBreak: number;
  };
  daily: Array<{
    date: string;
    minutes: number;
    count: number;
  }>;
}

export interface CreateSessionData {
  duration: number;
  mode: 'focus' | 'shortBreak' | 'longBreak';
  start_time: string;
  end_time: string;
  completed?: boolean;
}

export class FocusService {
  async createSession(
    supabase: SupabaseClient,
    userId: string,
    data: CreateSessionData
  ): Promise<FocusSession> {
    const { data: session, error } = await supabase
      .from('focus_sessions')
      .insert({
        user_id: userId,
        duration: data.duration,
        mode: data.mode,
        start_time: data.start_time,
        end_time: data.end_time,
        completed: data.completed ?? true,
      })
      .select()
      .single();

    if (error) throw error;
    return session;
  }

  async getStats(supabase: SupabaseClient, userId: string): Promise<FocusStats> {
    const { data: sessions, error } = await supabase
      .from('focus_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('completed', true)
      .order('start_time', { ascending: false });

    if (error) throw error;

    const totalSessions = sessions.length;
    const totalDuration = sessions.reduce((acc, curr) => acc + curr.duration, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySessions = sessions.filter(s => new Date(s.start_time) >= today);
    const todayDuration = todaySessions.reduce((acc, curr) => acc + curr.duration, 0);

    const byMode = sessions.reduce((acc: any, curr) => {
      acc[curr.mode] = (acc[curr.mode] || 0) + curr.duration;
      return acc;
    }, { focus: 0, shortBreak: 0, longBreak: 0 });

    const last7Days = new Array(7).fill(0).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const dateStr = d.toISOString().split('T')[0];
      
      const daySessions = sessions.filter(s => {
        const sDate = new Date(s.start_time);
        sDate.setHours(0, 0, 0, 0);
        return sDate.toISOString().split('T')[0] === dateStr;
      });

      return {
        date: dateStr,
        minutes: daySessions.filter(s => s.mode === 'focus').reduce((acc, s) => acc + s.duration, 0),
        count: daySessions.filter(s => s.mode === 'focus').length
      };
    }).reverse();

    return {
      total: {
        sessions: totalSessions,
        minutes: totalDuration,
      },
      today: {
        sessions: todaySessions.length,
        minutes: todayDuration,
      },
      byMode,
      daily: last7Days
    };
  }

  async getSessions(
    supabase: SupabaseClient,
    userId: string,
    options?: PaginationOptions
  ): Promise<FocusSession[]> {
    let query = supabase
      .from('focus_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: false });

    if (options?.limit && !options?.offset) {
      query = query.limit(options.limit);
    } else if (options?.offset !== undefined) {
      const { offset, end } = getPaginationParams(options);
      query = query.range(offset, end);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  }

  async getTodayStats(
    supabase: SupabaseClient,
    userId: string
  ): Promise<{ sessions: number; minutes: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: sessions, error } = await supabase
      .from('focus_sessions')
      .select('duration')
      .eq('user_id', userId)
      .eq('completed', true)
      .eq('mode', 'focus')
      .gte('start_time', today.toISOString());

    if (error) throw error;

    return {
      sessions: sessions.length,
      minutes: sessions.reduce((acc, curr) => acc + curr.duration, 0),
    };
  }
}

export const focusService = new FocusService();

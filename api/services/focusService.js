import { getPaginationParams } from '../utils/pagination.js';
export class FocusService {
    async createSession(supabase, userId, data) {
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
        if (error)
            throw error;
        return session;
    }
    async getStats(supabase, userId) {
        const { data: sessions, error } = await supabase
            .from('focus_sessions')
            .select('*')
            .eq('user_id', userId)
            .eq('completed', true)
            .order('start_time', { ascending: false });
        if (error)
            throw error;
        const totalSessions = sessions.length;
        const totalDuration = sessions.reduce((acc, curr) => acc + curr.duration, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todaySessions = sessions.filter(s => new Date(s.start_time) >= today);
        const todayDuration = todaySessions.reduce((acc, curr) => acc + curr.duration, 0);
        const byMode = sessions.reduce((acc, curr) => {
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
    async getSessions(supabase, userId, options) {
        let query = supabase
            .from('focus_sessions')
            .select('*')
            .eq('user_id', userId)
            .order('start_time', { ascending: false });
        if (options?.limit && !options?.offset) {
            query = query.limit(options.limit);
        }
        else if (options?.offset !== undefined) {
            const { offset, end } = getPaginationParams(options);
            query = query.range(offset, end);
        }
        const { data, error } = await query;
        if (error)
            throw error;
        return data;
    }
    async getTodayStats(supabase, userId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { data: sessions, error } = await supabase
            .from('focus_sessions')
            .select('duration')
            .eq('user_id', userId)
            .eq('completed', true)
            .eq('mode', 'focus')
            .gte('start_time', today.toISOString());
        if (error)
            throw error;
        return {
            sessions: sessions.length,
            minutes: sessions.reduce((acc, curr) => acc + curr.duration, 0),
        };
    }
}
export const focusService = new FocusService();
//# sourceMappingURL=focusService.js.map
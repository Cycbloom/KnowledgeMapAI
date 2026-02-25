import { SupabaseClient } from '@supabase/supabase-js';
import { ScheduledTask } from './schedulerService.js';
import { logger } from '../utils/logger.js';

export interface TaskRecommendation {
  task: ScheduledTask;
  score: number;
  reasons: string[];
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  suggestedTimeSlot?: TimeSlot;
}

export interface TimeSlot {
  start: Date;
  end: Date;
  label: string;
  type: 'morning' | 'afternoon' | 'evening' | 'night';
}

export interface EfficiencyData {
  hourlyEfficiency: Record<number, number>;
  tagEfficiency: Record<string, { avgDuration: number; completionRate: number }>;
  queueEfficiency: Record<number, { avgDuration: number; completionRate: number }>;
  peakHours: number[];
  lowHours: number[];
}

export interface RecommendationContext {
  currentTime: Date;
  userPreferences?: {
    workStartTime?: number;
    workEndTime?: number;
    preferredTaskTypes?: string[];
  };
}

export interface PrioritySuggestion {
  suggestedPriority: number;
  suggestedQueue: number;
  confidence: number;
  reasons: string[];
  keywords: string[];
}

const TIME_SLOT_CONFIG = {
  morning: { start: 6, end: 12, label: '上午', recommendedTypes: ['学习', '编程', '写作', '阅读'] },
  afternoon: { start: 12, end: 18, label: '下午', recommendedTypes: ['工作', '会议', '项目', '复习'] },
  evening: { start: 18, end: 22, label: '傍晚', recommendedTypes: ['复习', '阅读', '运动', '休息'] },
  night: { start: 22, end: 6, label: '夜间', recommendedTypes: ['休息', '阅读', '学习'] },
};

const PRIORITY_KEYWORDS = {
  critical: {
    keywords: ['紧急', 'urgent', 'asap', '立即', '马上', '紧急处理', '紧急修复', 'critical', '火急', '急'],
    priority: 4,
    queue: 0,
  },
  high: {
    keywords: ['重要', 'important', '优先', '关键', '核心', '必须', 'high', '今天', '今日', 'deadline', '截止'],
    priority: 3,
    queue: 0,
  },
  medium: {
    keywords: ['需要', '待办', '计划', '本周', '安排', 'medium', '中等'],
    priority: 2,
    queue: 1,
  },
  low: {
    keywords: ['有空', '闲时', '不急', '慢慢', 'low', '以后', '稍后', '可选'],
    priority: 1,
    queue: 2,
  },
};

export class TaskRecommendationService {
  calculateUrgencyScore(task: ScheduledTask, now: Date = new Date()): number {
    let score = 0;

    if (task.deadline) {
      const deadline = new Date(task.deadline);
      const timeUntilDeadline = deadline.getTime() - now.getTime();
      const hoursUntilDeadline = timeUntilDeadline / (1000 * 60 * 60);

      if (hoursUntilDeadline < 0) {
        score += 100;
      } else if (hoursUntilDeadline < 4) {
        score += 90;
      } else if (hoursUntilDeadline < 24) {
        score += 70;
      } else if (hoursUntilDeadline < 72) {
        score += 50;
      } else if (hoursUntilDeadline < 168) {
        score += 30;
      } else {
        score += 10;
      }
    } else {
      score += 20;
    }

    score += (task.priority || 1) * 15;

    score += (3 - task.queue_level) * 10;

    if (task.estimated_duration) {
      if (task.estimated_duration <= 25) {
        score += 15;
      } else if (task.estimated_duration <= 60) {
        score += 10;
      } else {
        score += 5;
      }
    }

    return Math.min(100, score);
  }

  getUrgencyLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  async calculateEfficiencyData(
    client: SupabaseClient,
    userId: string,
    days: number = 30
  ): Promise<EfficiencyData> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: executions, error } = await client
      .from('task_executions')
      .select(`
        *,
        scheduled_tasks!inner(tags, queue_level)
      `)
      .eq('user_id', userId)
      .gte('started_at', startDate.toISOString())
      .not('duration', 'is', null);

    if (error) {
      logger.error('Failed to fetch executions for efficiency data:', error);
      return this.getDefaultEfficiencyData();
    }

    const hourlyEfficiency: Record<number, number[]> = {};
    const tagEfficiency: Record<string, { durations: number[]; completed: number; total: number }> = {};
    const queueEfficiency: Record<number, { durations: number[]; completed: number; total: number }> = {};

    for (let i = 0; i < 24; i++) {
      hourlyEfficiency[i] = [];
    }

    for (const exec of executions || []) {
      const hour = new Date(exec.started_at).getHours();
      const duration = exec.duration || 0;

      hourlyEfficiency[hour].push(duration);

      const task = exec.scheduled_tasks as { tags?: string[]; queue_level?: number };
      if (task?.tags) {
        for (const tag of task.tags) {
          if (!tagEfficiency[tag]) {
            tagEfficiency[tag] = { durations: [], completed: 0, total: 0 };
          }
          tagEfficiency[tag].durations.push(duration);
          tagEfficiency[tag].total++;
          if (exec.status === 'completed') {
            tagEfficiency[tag].completed++;
          }
        }
      }

      if (task?.queue_level !== undefined) {
        const qLevel = task.queue_level;
        if (!queueEfficiency[qLevel]) {
          queueEfficiency[qLevel] = { durations: [], completed: 0, total: 0 };
        }
        queueEfficiency[qLevel].durations.push(duration);
        queueEfficiency[qLevel].total++;
        if (exec.status === 'completed') {
          queueEfficiency[qLevel].completed++;
        }
      }
    }

    const avgHourlyEfficiency: Record<number, number> = {};
    for (let i = 0; i < 24; i++) {
      const durations = hourlyEfficiency[i];
      avgHourlyEfficiency[i] = durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;
    }

    const processedTagEfficiency: Record<string, { avgDuration: number; completionRate: number }> = {};
    for (const [tag, data] of Object.entries(tagEfficiency)) {
      processedTagEfficiency[tag] = {
        avgDuration: data.durations.length > 0
          ? data.durations.reduce((a, b) => a + b, 0) / data.durations.length
          : 0,
        completionRate: data.total > 0 ? data.completed / data.total : 0,
      };
    }

    const processedQueueEfficiency: Record<number, { avgDuration: number; completionRate: number }> = {};
    for (const [level, data] of Object.entries(queueEfficiency)) {
      processedQueueEfficiency[Number(level)] = {
        avgDuration: data.durations.length > 0
          ? data.durations.reduce((a, b) => a + b, 0) / data.durations.length
          : 0,
        completionRate: data.total > 0 ? data.completed / data.total : 0,
      };
    }

    const sortedHours = Object.entries(avgHourlyEfficiency)
      .sort(([, a], [, b]) => b - a);

    const peakHours = sortedHours.slice(0, 4).map(([h]) => Number(h));
    const lowHours = sortedHours.slice(-4).map(([h]) => Number(h));

    return {
      hourlyEfficiency: avgHourlyEfficiency,
      tagEfficiency: processedTagEfficiency,
      queueEfficiency: processedQueueEfficiency,
      peakHours,
      lowHours,
    };
  }

  private getDefaultEfficiencyData(): EfficiencyData {
    const hourlyEfficiency: Record<number, number> = {};
    for (let i = 0; i < 24; i++) {
      hourlyEfficiency[i] = 0;
    }
    return {
      hourlyEfficiency,
      tagEfficiency: {},
      queueEfficiency: {},
      peakHours: [9, 10, 14, 15],
      lowHours: [0, 1, 2, 3],
    };
  }

  getCurrentTimeSlot(now: Date = new Date()): TimeSlot {
    const hour = now.getHours();

    for (const [type, config] of Object.entries(TIME_SLOT_CONFIG)) {
      if (type === 'night') {
        if (hour >= config.start || hour < config.end) {
          return {
            start: new Date(now),
            end: new Date(now),
            label: config.label,
            type: type as TimeSlot['type'],
          };
        }
      } else {
        if (hour >= config.start && hour < config.end) {
          return {
            start: new Date(now),
            end: new Date(now),
            label: config.label,
            type: type as TimeSlot['type'],
          };
        }
      }
    }

    return {
      start: new Date(now),
      end: new Date(now),
      label: '上午',
      type: 'morning',
    };
  }

  getTimeSlotRecommendations(
    tasks: ScheduledTask[],
    timeSlot: TimeSlot
  ): ScheduledTask[] {
    const config = TIME_SLOT_CONFIG[timeSlot.type];
    if (!config) return tasks;

    return tasks.sort((a, b) => {
      const aTags = a.tags || [];
      const bTags = b.tags || [];

      const aMatch = aTags.some(tag => config.recommendedTypes.includes(tag)) ? 1 : 0;
      const bMatch = bTags.some(tag => config.recommendedTypes.includes(tag)) ? 1 : 0;

      return bMatch - aMatch;
    });
  }

  async getTaskRecommendations(
    client: SupabaseClient,
    userId: string,
    context?: RecommendationContext
  ): Promise<TaskRecommendation[]> {
    const now = context?.currentTime || new Date();

    const { data: tasks, error } = await client
      .from('scheduled_tasks')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'paused'])
      .is('deleted_at', null)
      .order('priority', { ascending: false });

    if (error || !tasks) {
      return [];
    }

    const efficiencyData = await this.calculateEfficiencyData(client, userId);
    const currentTimeSlot = this.getCurrentTimeSlot(now);

    const recommendations: TaskRecommendation[] = tasks.map(task => {
      const urgencyScore = this.calculateUrgencyScore(task, now);
      const urgencyLevel = this.getUrgencyLevel(urgencyScore);
      const reasons: string[] = [];

      if (task.deadline) {
        const deadline = new Date(task.deadline);
        const hoursUntil = Math.round((deadline.getTime() - now.getTime()) / (1000 * 60 * 60));
        if (hoursUntil < 0) {
          reasons.push('已超过截止日期');
        } else if (hoursUntil < 24) {
          reasons.push(`截止日期临近 (${hoursUntil}小时)`);
        } else if (hoursUntil < 72) {
          reasons.push(`截止日期在${Math.round(hoursUntil / 24)}天内`);
        }
      }

      if (task.priority >= 3) {
        reasons.push('高优先级任务');
      }

      if (task.queue_level === 0) {
        reasons.push('位于高优先级队列 Q0');
      }

      if (task.tags && task.tags.length > 0) {
        const matchingTags = task.tags.filter((tag: string) =>
          TIME_SLOT_CONFIG[currentTimeSlot.type].recommendedTypes.includes(tag)
        );
        if (matchingTags.length > 0) {
          reasons.push(`适合${currentTimeSlot.label}时段 (${matchingTags.join(', ')})`);
        }
      }

      const tagEfficiencies = (task.tags || [])
        .map((tag: string) => efficiencyData.tagEfficiency[tag]?.completionRate || 0)
        .filter((rate: number) => rate > 0);

      if (tagEfficiencies.length > 0) {
        const avgEfficiency = tagEfficiencies.reduce((a: number, b: number) => a + b, 0) / tagEfficiencies.length;
        if (avgEfficiency > 0.7) {
          reasons.push('历史完成率较高');
        }
      }

      let adjustedScore = urgencyScore;
      const currentHour = now.getHours();
      if (efficiencyData.peakHours.includes(currentHour)) {
        adjustedScore *= 1.1;
      }

      return {
        task: task as ScheduledTask,
        score: Math.min(100, adjustedScore),
        reasons,
        urgencyLevel,
        suggestedTimeSlot: currentTimeSlot,
      };
    });

    return recommendations.sort((a, b) => b.score - a.score);
  }

  analyzePriorityFromText(title: string, description?: string): PrioritySuggestion {
    const text = `${title} ${description || ''}`.toLowerCase();
    const foundKeywords: string[] = [];
    let matchedLevel: 'critical' | 'high' | 'medium' | 'low' | null = null;

    for (const [level, config] of Object.entries(PRIORITY_KEYWORDS)) {
      for (const keyword of config.keywords) {
        if (text.includes(keyword.toLowerCase())) {
          foundKeywords.push(keyword);
          if (!matchedLevel || level === 'critical') {
            matchedLevel = level as 'critical' | 'high' | 'medium' | 'low';
          }
        }
      }
    }

    if (matchedLevel) {
      const config = PRIORITY_KEYWORDS[matchedLevel];
      const reasons: string[] = [];

      if (matchedLevel === 'critical') {
        reasons.push('检测到紧急关键词');
      } else if (matchedLevel === 'high') {
        reasons.push('检测到重要关键词');
      } else if (matchedLevel === 'medium') {
        reasons.push('检测到中等优先级关键词');
      } else {
        reasons.push('检测到低优先级关键词');
      }

      if (foundKeywords.length > 0) {
        reasons.push(`匹配关键词: ${foundKeywords.slice(0, 3).join(', ')}`);
      }

      return {
        suggestedPriority: config.priority,
        suggestedQueue: config.queue,
        confidence: Math.min(0.95, 0.6 + foundKeywords.length * 0.1),
        reasons,
        keywords: foundKeywords,
      };
    }

    return {
      suggestedPriority: 2,
      suggestedQueue: 1,
      confidence: 0.5,
      reasons: ['未检测到优先级关键词，使用默认中等优先级'],
      keywords: [],
    };
  }

  async getSmartSuggestions(
    client: SupabaseClient,
    userId: string,
    context?: RecommendationContext
  ): Promise<{
    topTasks: TaskRecommendation[];
    timeBasedSuggestions: string[];
    efficiencyTips: string[];
  }> {
    const recommendations = await this.getTaskRecommendations(client, userId, context);
    const efficiencyData = await this.calculateEfficiencyData(client, userId);
    const now = context?.currentTime || new Date();
    const currentHour = now.getHours();

    const topTasks = recommendations.slice(0, 5);

    const timeBasedSuggestions: string[] = [];
    const currentTimeSlot = this.getCurrentTimeSlot(now);

    if (efficiencyData.peakHours.includes(currentHour)) {
      timeBasedSuggestions.push(`当前是您的效率高峰期，建议处理重要任务`);
    } else if (efficiencyData.lowHours.includes(currentHour)) {
      timeBasedSuggestions.push(`当前时段效率较低，建议处理简单任务或休息`);
    }

    const config = TIME_SLOT_CONFIG[currentTimeSlot.type];
    if (config) {
      timeBasedSuggestions.push(`${config.label}适合处理: ${config.recommendedTypes.join('、')}`);
    }

    const efficiencyTips: string[] = [];

    const bestQueue = Object.entries(efficiencyData.queueEfficiency)
      .sort(([, a], [, b]) => b.completionRate - a.completionRate)[0];
    if (bestQueue && bestQueue[1].completionRate > 0.7) {
      efficiencyTips.push(`Q${bestQueue[0]}队列任务完成率最高 (${Math.round(bestQueue[1].completionRate * 100)}%)`);
    }

    const bestTags = Object.entries(efficiencyData.tagEfficiency)
      .filter(([, data]) => data.completionRate > 0.6)
      .sort(([, a], [, b]) => b.completionRate - a.completionRate)
      .slice(0, 3);

    if (bestTags.length > 0) {
      efficiencyTips.push(
        `您在以下类型任务表现较好: ${bestTags.map(([tag]) => tag).join('、')}`
      );
    }

    if (efficiencyData.peakHours.length > 0) {
      const formatHour = (h: number) => `${h}:00`;
      efficiencyTips.push(
        `您的效率高峰时段: ${efficiencyData.peakHours.map(formatHour).join('、')}`
      );
    }

    return {
      topTasks,
      timeBasedSuggestions,
      efficiencyTips,
    };
  }

  calculateOptimalTaskOrder(
    tasks: ScheduledTask[],
    efficiencyData: EfficiencyData,
    now: Date = new Date()
  ): ScheduledTask[] {
    const scoredTasks = tasks.map(task => {
      let score = 0;

      const urgencyScore = this.calculateUrgencyScore(task, now);
      score += urgencyScore * 0.4;

      if (task.tags && task.tags.length > 0) {
        const avgTagEfficiency = task.tags
          .map(tag => efficiencyData.tagEfficiency[tag]?.completionRate || 0.5)
          .reduce((a, b) => a + b, 0) / task.tags.length;
        score += avgTagEfficiency * 20;
      }

      const queueEfficiency = efficiencyData.queueEfficiency[task.queue_level];
      if (queueEfficiency) {
        score += queueEfficiency.completionRate * 10;
      }

      const currentHour = now.getHours();
      if (efficiencyData.peakHours.includes(currentHour) && task.priority >= 3) {
        score += 15;
      } else if (efficiencyData.lowHours.includes(currentHour) && task.priority < 3) {
        score += 10;
      }

      return { task, score };
    });

    return scoredTasks
      .sort((a, b) => b.score - a.score)
      .map(item => item.task);
  }
}

export const taskRecommendationService = new TaskRecommendationService();

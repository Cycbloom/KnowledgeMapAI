export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  category: 'focus' | 'tasks' | 'streak' | 'special' | 'study' | 'creation';
  icon: string;
  color: string;
  xp_reward: number;
  condition_type: string;
  condition_value: number;
  is_hidden: boolean;
  trigger_events: string[];
  created_at: string;
  unlocked_at?: string;
}

export interface DailyTask {
  id: string;
  user_id: string;
  task_date: string;
  task_type: 'login' | 'study_cards' | 'focus_time' | 'create_node';
  target: number;
  progress: number;
  status: 'pending' | 'completed';
  xp_reward: number;
  completed_at?: string;
  created_at: string;
}

export interface IAchievementsApi {
  list(): Promise<Achievement[]>;
  check(type: string, value: number): Promise<{ newUnlocks: Achievement[] }>;
  getDailyTasks(): Promise<DailyTask[]>;
  checkIn(): Promise<{ success: boolean }>;
}
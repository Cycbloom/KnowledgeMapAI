export interface PeriodicTask {
  id: string;
  user_id: string;
  period_type: 'weekly' | 'monthly' | 'quarterly';
  period_start: string;
  period_end: string;
  task_type: 'focus' | 'study' | 'create' | 'tasks';
  target: number;
  progress: number;
  status: 'pending' | 'completed';
  xp_reward: number;
  pass_points: number;
  created_at: string;
  updated_at: string;
}

export interface PeriodicPass {
  id: string;
  user_id: string;
  period_type: 'weekly' | 'monthly' | 'quarterly';
  period_start: string;
  period_end: string;
  total_points: number;
  current_level: number;
  created_at: string;
  updated_at: string;
}

export interface PassReward {
  id: string;
  period_type: 'weekly' | 'monthly' | 'quarterly';
  level: number;
  points_required: number;
  reward_type: 'xp' | 'achievement' | 'badge';
  reward_value: number | null;
  achievement_code: string | null;
  name: string;
  description: string | null;
  icon: string;
}

export interface UserPassProgress {
  id: string;
  user_id: string;
  pass_id: string;
  level: number;
  claimed: boolean;
  claimed_at: string | null;
}

export interface IPeriodicTasksApi {
  list(): Promise<PeriodicTask[]>;
  check(taskType: string, value: number): Promise<{ completedTasks: PeriodicTask[] }>;
  getPass(): Promise<{
    weekly: PeriodicPass | null;
    monthly: PeriodicPass | null;
    quarterly: PeriodicPass | null;
    rewards: PassReward[];
    userProgress: UserPassProgress[];
  }>;
  claimReward(
    passId: string,
    level: number,
  ): Promise<{ success: boolean; reward: PassReward | null; message: string }>;
  checkStreak(): Promise<{ streak: number; bonusAwarded: number }>;
}
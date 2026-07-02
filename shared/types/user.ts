export interface AIConfig {
  provider: string;
  model: string;
}

export interface AvailableModels {
  deepseek: string[];
  volcengine: string[];
  aliyun: string[];
  [key: string]: string[];
}

export interface User {
  id: string;
  email: string;
  name?: string;
  user_metadata?: {
    name?: string;
    avatar_url?: string;
    theme?: string;
    [key: string]: unknown;
  };
  profile?: {
    name?: string;
    xp?: number;
    level?: number;
    daily_task_streak?: number;
    weekly_streak?: number;
    monthly_streak?: number;
    quarterly_streak?: number;
    study_streak?: number;
    settings?: {
      request_retention?: number;
      maximum_interval?: number;
      ai_config?: {
        text?: AIConfig;
        embedding?: AIConfig;
        reasoning?: AIConfig;
      };
      available_models?: AvailableModels;
    };
    [key: string]: unknown;
  };
}

export interface UserProfile extends User {
  xp: number;
  level: number;
  role?: "admin" | "user";
  daily_task_streak?: number;
  weekly_streak?: number;
  monthly_streak?: number;
  quarterly_streak?: number;
}



export interface DailyTask {
  id: string;
  user_id: string;
  task_date: string;
  task_type: "login" | "study_cards" | "focus_time" | "create_node";
  status: "pending" | "completed";
  progress: number;
  target: number;
  xp_reward: number;
  completed_at?: string;
}

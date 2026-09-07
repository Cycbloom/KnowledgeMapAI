-- 36_learning_goals.sql
-- 个人长期学习目标：周/月维度的专注时长、任务完成、复习卡片、新增知识点目标
-- 目标仪表盘据此聚合当前周期进度并追踪达成情况

create table if not exists public.learning_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_type text not null check (period_type in ('week', 'month')),
  metric text not null check (
    metric in (
      'focus_minutes',
      'tasks_completed',
      'cards_reviewed',
      'new_knowledge_points'
    )
  ),
  target_value numeric not null check (target_value > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period_type, metric)
);

alter table public.learning_goals enable row level security;

create policy "learning_goals_select_own" on public.learning_goals
  for select using (auth.uid() = user_id);

create policy "learning_goals_insert_own" on public.learning_goals
  for insert with check (auth.uid() = user_id);

create policy "learning_goals_update_own" on public.learning_goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "learning_goals_delete_own" on public.learning_goals
  for delete using (auth.uid() = user_id);

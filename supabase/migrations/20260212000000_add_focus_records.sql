-- Create focus_sessions table
create table public.focus_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  start_time timestamptz not null default now(),
  end_time timestamptz not null default now(),
  duration integer not null, -- duration in minutes
  mode text not null check (mode in ('focus', 'shortBreak', 'longBreak')),
  completed boolean default true,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.focus_sessions enable row level security;

-- Create policies
create policy "Users can view their own focus sessions"
  on public.focus_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own focus sessions"
  on public.focus_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own focus sessions"
  on public.focus_sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete their own focus sessions"
  on public.focus_sessions for delete
  using (auth.uid() = user_id);

-- Create index for performance
create index focus_sessions_user_id_idx on public.focus_sessions(user_id);
create index focus_sessions_created_at_idx on public.focus_sessions(created_at);

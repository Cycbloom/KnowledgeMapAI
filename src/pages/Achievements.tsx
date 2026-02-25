import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useStore } from '../store/useStore';
import { Achievement, DailyTask } from '../types';
import { 
  Trophy, Medal, Target, Flame, Zap, Crown, Timer, Brain, 
  GraduationCap, BookOpen, Star, Lock, CheckCircle2, Award, Calendar, Ticket
} from 'lucide-react';
import { motion } from 'framer-motion';
import { PeriodicTaskList } from '../components/Achievements/PeriodicTaskList';
import { PassProgress } from '../components/Achievements/PassProgress';
import { StreakDisplay } from '../components/Achievements/StreakDisplay';

const iconMap: Record<string, React.ComponentType<any>> = {
  Flame, Zap, Crown, Timer, Brain, GraduationCap, BookOpen, Trophy, Medal, Target, Star
};

const taskTypeMap: Record<string, { label: string, icon: any }> = {
  login: { label: '每日登录', icon: Calendar },
  study_cards: { label: '复习卡片', icon: BookOpen },
  focus_time: { label: '专注时刻', icon: Timer },
  create_node: { label: '创造知识', icon: Zap },
};

type TabKey = 'daily' | 'periodic' | 'pass' | 'achievements';

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'daily', label: '每日任务', icon: Calendar },
  { key: 'periodic', label: '周期任务', icon: Target },
  { key: 'pass', label: '通行证', icon: Ticket },
  { key: 'achievements', label: '终身成就', icon: Trophy },
];

export const Achievements = () => {
  const { user } = useStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = React.useState<TabKey>('daily');
  
  const { data: achievements, isLoading: loadingAchievements } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => api.achievements.list()
  });

  const { data: dailyTasks, isLoading: loadingTasks } = useQuery({
    queryKey: ['daily-tasks'],
    queryFn: () => api.achievements.getDailyTasks()
  });

  const { data: periodicTasks, isLoading: loadingPeriodicTasks } = useQuery({
    queryKey: ['periodic-tasks'],
    queryFn: () => api.periodicTasks.list()
  });

  const { data: passData, isLoading: loadingPass } = useQuery({
    queryKey: ['pass-progress'],
    queryFn: () => api.periodicTasks.getPass()
  });

  const claimMutation = useMutation({
    mutationFn: ({ passId, level }: { passId: string; level: number }) => 
      api.periodicTasks.claimReward(passId, level),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pass-progress'] });
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
    },
  });

  const isLoading = loadingAchievements || loadingTasks;

  const unlockedCount = achievements?.filter((a: Achievement) => a.unlocked_at).length || 0;
  const totalCount = achievements?.length || 0;
  
  const level = user?.profile?.level || 1;
  const currentXp = user?.profile?.xp || 0;
  const xpNeeded = level * 500;
  const levelProgress = Math.min(100, (currentXp / xpNeeded) * 100);

  const totalLifetimeXp = achievements?.reduce((acc: number, curr: Achievement) => 
    curr.unlocked_at ? acc + curr.xp_reward : acc, 0) || 0;

  const categories = {
    study: '学习成就',
    focus: '专注成就',
    creation: '创造者',
    streak: '连续成就',
    tasks: '任务成就',
    special: '特殊成就',
  };

  const getCategoryIcon = (cat: string) => {
    switch(cat) {
      case 'study': return BookOpen;
      case 'focus': return Timer;
      case 'creation': return Zap;
      case 'streak': return Flame;
      case 'tasks': return Target;
      default: return Star;
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const groupedAchievements = achievements?.reduce((acc: any, curr: Achievement) => {
    if (!acc[curr.category]) acc[curr.category] = [];
    acc[curr.category].push(curr);
    return acc;
  }, {});

  const getDailyTaskDescription = (task: DailyTask) => {
    switch(task.task_type) {
      case 'login': return '每日登录应用';
      case 'study_cards': return `复习 ${task.target} 张知识卡片`;
      case 'focus_time': return `专注学习 ${task.target} 分钟`;
      case 'create_node': return `创建 ${task.target} 个新知识点`;
      default: return '完成任务';
    }
  };

  const handleClaimReward = async (passId: string, level: number) => {
    await claimMutation.mutateAsync({ passId, level });
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="col-span-1 md:col-span-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="absolute right-0 top-0 opacity-10 transform translate-x-10 -translate-y-10">
              <Trophy size={200} />
            </div>
            
            <div className="relative z-10 flex items-center gap-6">
              <div className="w-24 h-24 bg-white/20 backdrop-blur rounded-full flex items-center justify-center border-4 border-white/30">
                <span className="text-4xl font-bold">{level}</span>
              </div>
              
              <div className="flex-1 space-y-2">
                <div className="flex justify-between items-end">
                  <div>
                    <h2 className="text-2xl font-bold">等级 {level}</h2>
                    <p className="text-blue-100">总获得经验: {totalLifetimeXp} XP</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium text-blue-100">{currentXp} / {xpNeeded} XP</span>
                  </div>
                </div>
                
                <div className="w-full h-3 bg-black/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white/90 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${levelProgress}%` }}
                  />
                </div>
                <p className="text-xs text-blue-200 mt-1">
                  再获得 {xpNeeded - currentXp} XP 升级到 Level {level + 1}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-center">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 text-amber-600 mb-2">
                <Award size={24} />
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                  {unlockedCount} <span className="text-lg text-slate-400 font-normal">/ {totalCount}</span>
                </div>
                <p className="text-slate-500 text-sm">已解锁成就</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-2 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'daily' && (
          <div className="space-y-4">
            <StreakDisplay
              dailyStreak={user?.profile?.daily_task_streak || 0}
              weeklyStreak={user?.profile?.weekly_streak || 0}
              monthlyStreak={user?.profile?.monthly_streak || 0}
              quarterlyStreak={user?.profile?.quarterly_streak || 0}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {dailyTasks?.map((task: DailyTask) => {
                const isCompleted = task.status === 'completed';
                const progressPercent = Math.min(100, (task.progress / task.target) * 100);
                const TaskIcon = taskTypeMap[task.task_type]?.icon || Star;
                const taskLabel = taskTypeMap[task.task_type]?.label || '任务';

                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`relative p-4 rounded-xl border transition-all ${
                      isCompleted 
                        ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' 
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        isCompleted 
                          ? 'bg-green-100 text-green-600 dark:bg-green-800 dark:text-green-100' 
                          : 'bg-blue-50 text-blue-500 dark:bg-blue-900/30 dark:text-blue-300'
                      }`}>
                        <TaskIcon size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h4 className="font-medium text-slate-800 dark:text-slate-100 truncate">
                            {taskLabel}
                          </h4>
                          {isCompleted && <CheckCircle2 size={16} className="text-green-500 shrink-0" />}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                          {getDailyTaskDescription(task)}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>{task.progress} / {task.target}</span>
                        <span className="font-medium text-amber-600">+{task.xp_reward} XP</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            isCompleted ? 'bg-green-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'periodic' && (
          <div className="space-y-4">
            {loadingPeriodicTasks ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : (
              <PeriodicTaskList tasks={periodicTasks || []} />
            )}
          </div>
        )}

        {activeTab === 'pass' && (
          <div className="space-y-6">
            {loadingPass ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : (
              <>
                {passData?.weekly && (
                  <PassProgress
                    pass={passData.weekly}
                    rewards={passData.rewards || []}
                    userProgress={passData.userProgress || []}
                    onClaim={handleClaimReward}
                  />
                )}
                {passData?.monthly && (
                  <PassProgress
                    pass={passData.monthly}
                    rewards={passData.rewards || []}
                    userProgress={passData.userProgress || []}
                    onClaim={handleClaimReward}
                  />
                )}
                {passData?.quarterly && (
                  <PassProgress
                    pass={passData.quarterly}
                    rewards={passData.rewards || []}
                    userProgress={passData.userProgress || []}
                    onClaim={handleClaimReward}
                  />
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'achievements' && (
          <div className="space-y-8">
            {Object.entries(groupedAchievements || {}).map(([category, items]: [string, any]) => {
              const CatIcon = getCategoryIcon(category);
              return (
                <div key={category} className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
                    <CatIcon className="text-slate-400" size={20} />
                    <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                      {categories[category as keyof typeof categories] || category}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {items.map((ach: Achievement) => {
                      const Icon = iconMap[ach.icon] || Star;
                      const isUnlocked = !!ach.unlocked_at;

                      return (
                        <motion.div
                          key={ach.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`relative group rounded-xl p-4 border transition-all duration-300 ${
                            isUnlocked 
                              ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md' 
                              : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-75'
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                              isUnlocked 
                                ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg' 
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 grayscale'
                            }`}>
                              <Icon size={24} />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <h4 className={`font-semibold truncate ${
                                  isUnlocked ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500'
                                }`}>
                                  {ach.name}
                                </h4>
                                {isUnlocked && <CheckCircle2 size={16} className="text-green-500" />}
                              </div>
                              <p className="text-xs text-slate-500 line-clamp-2 mb-2">
                                {ach.description}
                              </p>
                              <div className="flex items-center justify-between mt-auto">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                  isUnlocked 
                                    ? 'bg-amber-100 text-amber-700' 
                                    : 'bg-slate-200 text-slate-500'
                                }`}>
                                  +{ach.xp_reward} XP
                                </span>
                                {ach.unlocked_at && (
                                  <span className="text-[10px] text-slate-400">
                                    {new Date(ach.unlocked_at).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {!isUnlocked && (
                            <div className="absolute inset-0 bg-slate-100/50 dark:bg-slate-900/50 backdrop-blur-[1px] rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Lock className="text-slate-400" />
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

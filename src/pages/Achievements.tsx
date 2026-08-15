import React, { useMemo, useId, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { queryKeys } from '../hooks/queries/config';
import { useStore } from '../store/useStore';
import { Achievement as BaseAchievement, DailyTask } from '../types';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/utils/formatters';
import { message } from '@/utils/messageHelper';

interface Achievement extends BaseAchievement {
  unlocked_at?: string;
}
import {
  Trophy, Medal, Target, Flame, Zap, Crown, Timer, Brain,
  GraduationCap, BookOpen, Star, Lock, CheckCircle2, Award, Calendar, Ticket, LucideIcon
} from 'lucide-react';
import { motion } from 'framer-motion';
import { PeriodicTaskList } from '../components/Achievements/PeriodicTaskList';
import { PassProgress } from '../components/Achievements/PassProgress';
import { StreakDisplay } from '../components/Achievements/StreakDisplay';
import { Skeleton, SkeletonCard, ErrorState } from '../components/common';

const iconMap: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  Flame, Zap, Crown, Timer, Brain, GraduationCap, BookOpen, Trophy, Medal, Target, Star
};

type TabKey = 'daily' | 'periodic' | 'pass' | 'achievements';

export const Achievements = () => {
  const { t } = useTranslation();
  const { user } = useStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = React.useState<TabKey>('daily');

  const tablistId = useId();
  const tabIdPrefix = `${tablistId}-tab`;
  const panelIdPrefix = `${tablistId}-panel`;
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  
  const taskTypeMap: Record<string, { label: string; icon: LucideIcon }> = {
    login: { label: t('achievements.taskTypes.login'), icon: Calendar },
    study_cards: { label: t('achievements.taskTypes.study_cards'), icon: BookOpen },
    focus_time: { label: t('achievements.taskTypes.focus_time'), icon: Timer },
    create_node: { label: t('achievements.taskTypes.create_node'), icon: Zap },
  };

  const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: 'daily', label: t('achievements.tabs.daily'), icon: Calendar },
    { key: 'periodic', label: t('achievements.tabs.periodic'), icon: Target },
    { key: 'pass', label: t('achievements.tabs.pass'), icon: Ticket },
    { key: 'achievements', label: t('achievements.tabs.achievements'), icon: Trophy },
  ];

  const handleTabKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    switch (e.key) {
      case 'ArrowRight': {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % tabs.length;
        setActiveTab(tabs[nextIndex].key);
        tabRefs.current[nextIndex]?.focus();
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        setActiveTab(tabs[prevIndex].key);
        tabRefs.current[prevIndex]?.focus();
        break;
      }
      case 'Home': {
        e.preventDefault();
        setActiveTab(tabs[0].key);
        tabRefs.current[0]?.focus();
        break;
      }
      case 'End': {
        e.preventDefault();
        const lastIndex = tabs.length - 1;
        setActiveTab(tabs[lastIndex].key);
        tabRefs.current[lastIndex]?.focus();
        break;
      }
      default:
        break;
    }
  };
  
  const { data: achievements, isLoading: loadingAchievements, error: achievementsError, refetch: refetchAchievements } = useQuery({
    queryKey: queryKeys.achievements(),
    queryFn: () => api.achievements.list()
  });

  const { data: dailyTasks, isLoading: loadingTasks, error: dailyTasksError, refetch: refetchDailyTasks } = useQuery({
    queryKey: queryKeys.dailyTasks(),
    queryFn: () => api.achievements.getDailyTasks()
  });

  const { data: periodicTasks, isLoading: loadingPeriodicTasks, error: periodicTasksError, refetch: refetchPeriodicTasks } = useQuery({
    queryKey: queryKeys.periodicTasks(),
    queryFn: () => api.periodicTasks.list()
  });

  const { data: passData, isLoading: loadingPass, error: passDataError, refetch: refetchPassData } = useQuery({
    queryKey: queryKeys.passProgress(),
    queryFn: () => api.periodicTasks.getPass()
  });

  const claimMutation = useMutation({
    mutationFn: ({ passId, level }: { passId: string; level: number }) => 
      api.periodicTasks.claimReward(passId, level),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.passProgress() });
      queryClient.invalidateQueries({ queryKey: queryKeys.achievements() });
    },
  });

  // 单趟分组统计 achievements，缓存避免每次渲染重新扫描（原每次渲染 O(achievements) 扫描）
  const groupedAchievements = useMemo(() => {
    if (!achievements) return undefined;
    const acc: Record<string, Achievement[]> = {};
    for (const curr of achievements) {
      (acc[curr.category] ??= []).push(curr);
    }
    return acc;
  }, [achievements]);

  const isLoading = loadingAchievements || loadingTasks;
  const hasError = achievementsError || dailyTasksError || periodicTasksError || passDataError;

  // 单趟统计解锁数与终身 XP，替代 filter + reduce 两次扫描
  let unlockedCount = 0;
  let totalLifetimeXp = 0;
  const totalCount = achievements?.length || 0;
  if (achievements) {
    for (const a of achievements) {
      if (a.unlocked_at) {
        unlockedCount++;
        totalLifetimeXp += a.xp_reward;
      }
    }
  }
  
  const level = user?.profile?.level || 1;
  const currentXp = user?.profile?.xp || 0;
  const xpNeeded = level * 500;
  const levelProgress = Math.min(100, (currentXp / xpNeeded) * 100);

  const categories = {
    study: t('achievements.categories.study'),
    focus: t('achievements.categories.focus'),
    creation: t('achievements.categories.creation'),
    streak: t('achievements.categories.streak'),
    tasks: t('achievements.categories.tasks'),
    special: t('achievements.categories.special'),
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
      <div className="h-full overflow-y-auto px-4 py-4 md:p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-500 p-5 flex items-center gap-4"
              >
                <Skeleton variant="circular" width={48} height={48} />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (hasError) {
    const firstError = achievementsError || dailyTasksError || periodicTasksError || passDataError;
    return (
      <ErrorState
        message={(firstError as Error).message}
        onRetry={() => {
          void refetchAchievements();
          void refetchDailyTasks();
          void refetchPeriodicTasks();
          void refetchPassData();
        }}
      />
    );
  }

  const getDailyTaskDescription = (task: DailyTask) => {
    switch(task.task_type) {
      case 'login': return t('achievements.dailyTaskDesc.login');
      case 'study_cards': return t('achievements.dailyTaskDesc.study_cards', { target: task.target });
      case 'focus_time': return t('achievements.dailyTaskDesc.focus_time', { target: task.target });
      case 'create_node': return t('achievements.dailyTaskDesc.create_node', { target: task.target });
      default: return t('achievements.dailyTaskDesc.default');
    }
  };

  const handleClaimReward = async (passId: string, level: number) => {
    try {
      await claimMutation.mutateAsync({ passId, level });
    } catch (err: unknown) {
      console.error('Failed to claim reward:', err);
      message.error(t('achievements.claimFailed'));
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-4 md:p-6">
      <h1 className="sr-only">{t('layout.achievements')}</h1>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          <div className="col-span-1 md:col-span-2 bg-gradient-to-r from-primary-600 to-primary-600 rounded-2xl p-4 md:p-6 text-white shadow-lg relative overflow-hidden">
            <div className="absolute right-0 top-0 opacity-10 transform translate-x-10 -translate-y-10">
              <Trophy size={200} />
            </div>
            
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-4 md:gap-6">
              <div className="w-20 h-20 md:w-24 md:h-24 bg-white/20 backdrop-blur rounded-full flex items-center justify-center border-4 border-white/30">
                <span className="text-3xl md:text-4xl font-bold">{level}</span>
              </div>
              
              <div className="flex-1 space-y-2 text-center md:text-left">
                <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-2">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold">{t('achievements.level')} {level}</h2>
                    <p className="text-primary-100 text-sm md:text-base">{t('achievements.totalXpEarned', { xp: totalLifetimeXp })}</p>
                  </div>
                  <div className="text-center md:text-right">
                    <span className="text-sm font-medium text-primary-100">{t('achievements.xpProgress', { current: currentXp, needed: xpNeeded })}</span>
                  </div>
                </div>
                
                <div className="w-full h-3 bg-black/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white/90 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${levelProgress}%` }}
                  />
                </div>
                <p className="text-xs text-primary-200 mt-1">
                  {t('achievements.xpToNextLevel', { xp: xpNeeded - currentXp, level: level + 1 })}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 md:p-6 shadow-sm border border-slate-200 dark:border-slate-500 flex flex-col justify-center">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 text-amber-600 mb-2">
                <Award size={24} />
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                  {unlockedCount} <span className="text-lg text-slate-400 font-normal">/ {totalCount}</span>
                </div>
                <p className="text-slate-500 text-sm">{t('achievements.unlockedCount')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-500 pb-2 overflow-x-auto" role="tablist" aria-label={t('layout.achievements')}>
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                ref={(el) => { tabRefs.current[index] = el; }}
                role="tab"
                id={`${tabIdPrefix}-${tab.key}`}
                aria-selected={isActive}
                aria-controls={`${panelIdPrefix}-${tab.key}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(tab.key)}
                onKeyDown={(e) => handleTabKeyDown(e, index)}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all whitespace-nowrap flex-shrink-0 min-h-[44px] ${
                  isActive
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
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
          <div
            role="tabpanel"
            id={`${panelIdPrefix}-daily`}
            aria-labelledby={`${tabIdPrefix}-daily`}
            tabIndex={0}
            className="space-y-4"
          >
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
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-500'
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        isCompleted
                          ? 'bg-green-100 text-green-600 dark:bg-green-800 dark:text-green-100'
                          : 'bg-primary-50 text-primary-500 dark:bg-primary-900/30 dark:text-primary-300'
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
                            isCompleted ? 'bg-green-500' : 'bg-primary-500'
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
          <div
            role="tabpanel"
            id={`${panelIdPrefix}-periodic`}
            aria-labelledby={`${tabIdPrefix}-periodic`}
            tabIndex={0}
            className="space-y-4"
          >
            {loadingPeriodicTasks ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : (
              <PeriodicTaskList tasks={periodicTasks || []} />
            )}
          </div>
        )}

        {activeTab === 'pass' && (
          <div
            role="tabpanel"
            id={`${panelIdPrefix}-pass`}
            aria-labelledby={`${tabIdPrefix}-pass`}
            tabIndex={0}
            className="space-y-6"
          >
            {loadingPass ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
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
          <div
            role="tabpanel"
            id={`${panelIdPrefix}-achievements`}
            aria-labelledby={`${tabIdPrefix}-achievements`}
            tabIndex={0}
            className="space-y-8"
          >
            {Object.entries(groupedAchievements || {}).map(([category, items]: [string, Achievement[]]) => {
              const CatIcon = getCategoryIcon(category);
              return (
                <div key={category} className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-500 pb-2">
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
                              ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-500 shadow-sm hover:shadow-md'
                              : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-75'
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                              isUnlocked
                                ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 grayscale'
                            }`}>
                              <Icon className="w-6 h-6" />
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
                                    {formatDate(ach.unlocked_at, 'short')}
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

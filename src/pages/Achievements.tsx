import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useStore } from '../store/useStore';
import { Achievement } from '../types';
import { useTheme } from '../hooks/useTheme';
import { 
  Trophy, Medal, Target, Flame, Zap, Crown, Timer, Brain, 
  GraduationCap, BookOpen, Star, Lock, CheckCircle2, Award
} from 'lucide-react';
import { motion } from 'framer-motion';

const iconMap: Record<string, React.ComponentType<any>> = {
  Flame, Zap, Crown, Timer, Brain, GraduationCap, BookOpen, Trophy, Medal, Target, Star
};

export const Achievements = () => {
  const { isDark } = useTheme();
  const { user } = useStore();
  
  // Fetch Achievements
  const { data: achievements, isLoading } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => api.achievements.list()
  });

  // Calculate Stats
  const unlockedCount = achievements?.filter((a: Achievement) => a.unlocked_at).length || 0;
  const totalCount = achievements?.length || 0;
  
  // User XP/Level from Store
  const level = user?.profile?.level || 1;
  const currentXp = user?.profile?.xp || 0;
  const xpNeeded = level * 500;
  const levelProgress = Math.min(100, (currentXp / xpNeeded) * 100);

  // Calculate Total Lifetime XP (Sum of all unlocked achievements)
  const totalLifetimeXp = achievements?.reduce((acc: number, curr: Achievement) => 
    curr.unlocked_at ? acc + curr.xp_reward : acc, 0) || 0;

  const categories = {
    study: '学习成就',
    focus: '专注成就',
    creation: '创造者'
  };

  const getCategoryIcon = (cat: string) => {
    switch(cat) {
      case 'study': return BookOpen;
      case 'focus': return Timer;
      case 'creation': return Zap;
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

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header / Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Level Card */}
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

        {/* Stats Card */}
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

      {/* Achievement List */}
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
    </div>
  );
};

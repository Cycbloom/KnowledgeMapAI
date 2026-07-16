import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Award,
  Search,
  Trophy,
  Target,
  Flame,
  Sparkles,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import type { Achievement, UserAchievement } from "@shared/types";
import { formatDate } from "../../utils/formatters";
import { EmptyState } from "../common/EmptyState";
import {
  AchievementBadge,
  AchievementBadgeNotification,
} from "./AchievementBadge";

interface AchievementGalleryProps {
  className?: string;
}

type CategoryFilter = "all" | "focus" | "tasks" | "streak" | "special";
type StatusFilter = "all" | "unlocked" | "locked";

const CATEGORY_INFO = {
  focus: {
    label: "专注",
    icon: Target,
    color: "text-primary-500",
    bg: "bg-primary-500/10",
  },
  tasks: {
    label: "任务",
    icon: Trophy,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  streak: {
    label: "连续",
    icon: Flame,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  special: {
    label: "特殊",
    icon: Sparkles,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
  study: {
    label: "学习",
    icon: Award,
    color: "text-primary-500",
    bg: "bg-primary-500/10",
  },
  creation: {
    label: "创作",
    icon: Sparkles,
    color: "text-rose-500",
    bg: "bg-rose-500/10",
  },
};

export const AchievementGallery: React.FC<AchievementGalleryProps> = ({
  className = "",
}) => {
  const [allAchievements, setAllAchievements] = useState<Achievement[]>([]);
  const [userAchievements, setUserAchievements] = useState<
    (UserAchievement & { achievement: Achievement })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAchievement, setSelectedAchievement] =
    useState<Achievement | null>(null);
  const [newlyUnlocked, setNewlyUnlocked] = useState<Achievement | null>(null);
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [achievementsRes, userAchievementsRes] = await Promise.all([
          api.scheduler.getAllAchievements(),
          api.scheduler.getUserAchievements(),
        ]);
        setAllAchievements(achievementsRes.data || []);
        setUserAchievements(userAchievementsRes.data || []);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch achievements:", err);
        setError("加载成就数据失败");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const userAchievementMap = new Map(
    userAchievements.map((ua) => [ua.achievement_id, ua]),
  );

  const filteredAchievements = allAchievements.filter((achievement) => {
    if (categoryFilter !== "all" && achievement.category !== categoryFilter) {
      return false;
    }

    const isUnlocked = userAchievementMap.has(achievement.id);
    if (statusFilter === "unlocked" && !isUnlocked) return false;
    if (statusFilter === "locked" && isUnlocked) return false;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        achievement.name.toLowerCase().includes(query) ||
        achievement.description.toLowerCase().includes(query)
      );
    }

    return true;
  });

  const stats = {
    total: allAchievements.length,
    unlocked: userAchievements.length,
    totalXp: userAchievements.reduce(
      (sum, ua) => sum + (ua.achievement?.xp_reward || 0),
      0,
    ),
    byCategory: {
      focus: { total: 0, unlocked: 0 },
      tasks: { total: 0, unlocked: 0 },
      streak: { total: 0, unlocked: 0 },
      special: { total: 0, unlocked: 0 },
      study: { total: 0, unlocked: 0 },
      creation: { total: 0, unlocked: 0 },
    },
  };

  allAchievements.forEach((a) => {
    stats.byCategory[a.category].total++;
    if (userAchievementMap.has(a.id)) {
      stats.byCategory[a.category].unlocked++;
    }
  });

  const completionPercentage =
    stats.total > 0 ? Math.round((stats.unlocked / stats.total) * 100) : 0;

  if (loading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/4" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-32 bg-slate-200 dark:bg-slate-700 rounded-xl"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="text-center text-red-500 dark:text-red-400">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 ${className}`}>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Award size={20} className="text-amber-500" />
          成就殿堂
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          已解锁 {stats.unlocked}/{stats.total} 个成就
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-200 dark:border-amber-800/50"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500">
              <Trophy size={20} className="text-white" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                总体进度
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {completionPercentage}%
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              获得经验
            </p>
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
              +{stats.totalXp} XP
            </p>
          </div>
        </div>

        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completionPercentage}%` }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
          />
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {Object.entries(CATEGORY_INFO).map(([category, info], index) => {
          const Icon = info.icon;
          const catStats =
            stats.byCategory[category as keyof typeof stats.byCategory];
          const percentage =
            catStats.total > 0
              ? Math.round((catStats.unlocked / catStats.total) * 100)
              : 0;

          return (
            <motion.button
              key={category}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              onClick={() =>
                setCategoryFilter(
                  categoryFilter === category
                    ? "all"
                    : (category as CategoryFilter),
                )
              }
              className={`
                p-3 rounded-xl border transition-all text-left
                ${
                  categoryFilter === category
                    ? `${info.bg} border-current`
                    : "bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600"
                }
              `}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon size={16} className={info.color} />
                <span
                  className={`text-sm font-medium ${categoryFilter === category ? info.color : "text-slate-700 dark:text-slate-300"}`}
                >
                  {info.label}
                </span>
              </div>
              <p className={`text-xl font-bold ${info.color}`}>
                {catStats.unlocked}/{catStats.total}
              </p>
              <div className="mt-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${info.bg.replace("/10", "")}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </motion.button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="搜索成就..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {(["all", "unlocked", "locked"] as StatusFilter[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`
                px-3 py-1.5 rounded-md text-sm font-medium transition-all
                ${
                  statusFilter === status
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }
              `}
            >
              {status === "all"
                ? "全部"
                : status === "unlocked"
                  ? "已解锁"
                  : "未解锁"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredAchievements.map((achievement, index) => {
            const userAchievement = userAchievementMap.get(achievement.id);
            const isUnlocked = !!userAchievement;

            return (
              <motion.div
                key={achievement.id}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => setSelectedAchievement(achievement)}
                className="flex flex-col items-center p-3 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer transition-all"
              >
                <AchievementBadge
                  achievement={achievement}
                  unlocked={isUnlocked}
                  unlockedAt={userAchievement?.unlocked_at}
                  size="sm"
                  showProgress={!isUnlocked && !achievement.is_hidden}
                  progress={userAchievement?.progress || 0}
                  conditionValue={achievement.condition_value}
                />
                <p className="mt-2 text-xs text-center text-slate-500 dark:text-slate-400 line-clamp-2">
                  {isUnlocked
                    ? achievement.description
                    : achievement.is_hidden
                      ? "???"
                      : achievement.description}
                </p>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filteredAchievements.length === 0 && (
        <EmptyState
          icon={<Trophy size={32} />}
          title={t('scheduler.empty.achievements')}
          action={{
            label: t('scheduler.browseTasks'),
            onClick: () => navigate('/scheduler'),
          }}
        />
      )}

      <AnimatePresence>
        {selectedAchievement && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setSelectedAchievement(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  {(() => {
                    const info = CATEGORY_INFO[selectedAchievement.category];
                    const Icon = info.icon;
                    return (
                      <>
                        <Icon size={16} className={info.color} />
                        <span className={`text-sm ${info.color}`}>
                          {info.label}
                        </span>
                      </>
                    );
                  })()}
                </div>
                <button
                  onClick={() => setSelectedAchievement(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex flex-col items-center">
                <AchievementBadge
                  achievement={selectedAchievement}
                  unlocked={userAchievementMap.has(selectedAchievement.id)}
                  unlockedAt={
                    userAchievementMap.get(selectedAchievement.id)?.unlocked_at
                  }
                  size="lg"
                  showProgress
                  progress={
                    userAchievementMap.get(selectedAchievement.id)?.progress ||
                    0
                  }
                  conditionValue={selectedAchievement.condition_value}
                  animate={false}
                />

                <h4 className="mt-4 text-lg font-bold text-slate-900 dark:text-white text-center">
                  {userAchievementMap.has(selectedAchievement.id)
                    ? selectedAchievement.name
                    : "???"}
                </h4>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 text-center">
                  {selectedAchievement.description}
                </p>

                {selectedAchievement.xp_reward > 0 && (
                  <div className="mt-4 flex items-center gap-2 bg-amber-100 dark:bg-amber-500/20 px-4 py-2 rounded-full">
                    <span className="text-amber-600 dark:text-amber-400 font-bold">
                      +{selectedAchievement.xp_reward} XP
                    </span>
                  </div>
                )}

                {userAchievementMap.has(selectedAchievement.id) && (
                  <p className="mt-4 text-xs text-slate-400">
                    解锁于{" "}
                    {formatDate(
                      userAchievementMap.get(selectedAchievement.id)!
                        .unlocked_at,
                      'short',
                    )}
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {newlyUnlocked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          >
            <AchievementBadgeNotification
              achievement={newlyUnlocked}
              onClose={() => setNewlyUnlocked(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

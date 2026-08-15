import React from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Lock, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumber } from "../../utils/formatters";

interface PassReward {
  id: string;
  period_type: "weekly" | "monthly" | "quarterly";
  level: number;
  points_required: number;
  reward_type: "xp" | "achievement" | "badge";
  reward_value: number | null;
  achievement_code: string | null;
  name: string;
  description: string | null;
  icon: string;
}

interface UserPassProgress {
  pass_id: string;
  level: number;
  claimed: boolean;
  claimed_at: string | null;
}

interface PassProgressProps {
  pass: {
    id: string;
    period_type: "weekly" | "monthly" | "quarterly";
    total_points: number;
    current_level: number;
    period_start: string;
    period_end: string;
  } | null;
  rewards: PassReward[];
  userProgress: UserPassProgress[];
  onClaim: (passId: string, level: number) => Promise<void>;
}

export const PassProgress: React.FC<PassProgressProps> = ({
  pass,
  rewards,
  userProgress,
  onClaim,
}) => {
  const { t } = useTranslation();
  
  const periodTypeConfig = {
    weekly: {
      label: t("achievements.pass.weekly"),
      color: "from-primary-500 to-primary-500",
      bgColor: "bg-primary-500",
      borderColor: "border-primary-400",
    },
    monthly: {
      label: t("achievements.pass.monthly"),
      color: "from-primary-500 to-pink-500",
      bgColor: "bg-primary-500",
      borderColor: "border-primary-400",
    },
    quarterly: {
      label: t("achievements.pass.quarterly"),
      color: "from-orange-500 to-red-500",
      bgColor: "bg-orange-500",
      borderColor: "border-orange-400",
    },
  };
  
  const [claiming, setClaiming] = React.useState<number | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(true);

  const config = pass ? periodTypeConfig[pass.period_type] : null;
  // 预计算奖励列表与进度索引，避免每次渲染重复 filter / 构建 Map
  const passRewards = React.useMemo(
    () => (pass ? rewards.filter((r) => r.period_type === pass.period_type) : []),
    [pass, rewards],
  );
  const progressMap = React.useMemo(
    () => new Map(userProgress.map((p) => [`${p.pass_id}-${p.level}`, p])),
    [userProgress],
  );

  const maxPoints = pass
    ? Math.max(...passRewards.map((r) => r.points_required), 1)
    : 1;
  const progressPercent = pass
    ? Math.min(100, (pass.total_points / maxPoints) * 100)
    : 0;

  const checkScrollButtons = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  React.useEffect(() => {
    checkScrollButtons();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", checkScrollButtons);
      return () => el.removeEventListener("scroll", checkScrollButtons);
    }
  }, [passRewards]);

  if (!pass || !config) {
    return (
      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
        {t("achievements.pass.noPassData")}
      </div>
    );
  }

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const handleClaim = async (level: number) => {
    setClaiming(level);
    try {
      await onClaim(pass.id, level);
    } finally {
      setClaiming(null);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    const startX = e.pageX - scrollRef.current.offsetLeft;
    const scrollLeft = scrollRef.current.scrollLeft;

    const handleMouseMove = (e: MouseEvent) => {
      if (!scrollRef.current) return;
      const x = e.pageX - scrollRef.current.offsetLeft;
      const walk = (x - startX) * 1.5;
      scrollRef.current.scrollLeft = scrollLeft - walk;
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gradient-to-r dark:from-slate-800 dark:to-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">
              {config.label}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              {t("achievements.pass.level", { level: pass.current_level })} | {t("achievements.pass.points", { current: pass.total_points, max: maxPoints })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-2xl font-bold text-slate-800 dark:text-white">
                {pass.current_level}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t("achievements.pass.levelShort")}
              </div>
            </div>
          </div>
        </div>

        <div className="relative">
          <div
            role="progressbar"
            aria-valuenow={Math.round(progressPercent)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('common.aria.progress')}
            className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden"
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={`h-full rounded-full bg-gradient-to-r ${config.color}`}
            />
          </div>
        </div>
      </div>

      <div className="relative">
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            aria-label={t('common.aria.scrollLeft')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 min-w-[44px] min-h-[44px] w-auto h-auto bg-white dark:bg-slate-800 rounded-full shadow-lg flex items-center justify-center border border-slate-200 dark:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>
        )}

        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            aria-label={t('common.aria.scrollRight')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 min-w-[44px] min-h-[44px] w-auto h-auto bg-white dark:bg-slate-800 rounded-full shadow-lg flex items-center justify-center border border-slate-200 dark:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>
        )}

        <div
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          className="overflow-x-auto scrollbar-hide cursor-grab active:cursor-grabbing"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <div
            className="flex gap-3 pb-2 pt-1 px-2"
            style={{ minWidth: "min-content" }}
          >
            {passRewards.map((reward, index) => {
              const progress = progressMap.get(`${pass.id}-${reward.level}`);
              const isUnlocked = pass.total_points >= reward.points_required;
              const isClaimed = progress?.claimed || false;
              const canClaim = isUnlocked && !isClaimed;
              const isCurrentLevel =
                pass.total_points >= reward.points_required &&
                (index === passRewards.length - 1 ||
                  pass.total_points < passRewards[index + 1].points_required);

              return (
                <motion.div
                  key={reward.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.03 }}
                  className={`relative flex-shrink-0 w-24 rounded-xl border-2 transition-all ${
                    isClaimed
                      ? "bg-green-50 dark:bg-green-900/20 border-green-400 dark:border-green-600"
                      : isCurrentLevel
                        ? `bg-white dark:bg-slate-800 ${config.borderColor} shadow-lg`
                        : isUnlocked
                          ? "bg-amber-50 dark:bg-amber-900/20 border-amber-400 dark:border-amber-600"
                          : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-500"
                  }`}
                >
                  <div className="p-2 text-center">
                    <div
                      className={`text-xs font-bold mb-1 ${
                        isClaimed
                          ? "text-green-600 dark:text-green-400"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      Lv.{reward.level}
                    </div>

                    <div className="text-2xl mb-1">{reward.icon}</div>

                    <div className="text-xs font-medium text-slate-800 dark:text-white truncate mb-1">
                      {reward.name}
                    </div>

                    {reward.reward_type === "xp" && reward.reward_value && (
                      <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        +{formatNumber(reward.reward_value)} XP
                      </div>
                    )}

                    <div className="text-[10px] text-slate-400 mt-1">
                      {t("achievements.pass.pointsRequired", { points: formatNumber(reward.points_required) })}
                    </div>

                    <div className="mt-2">
                      {isClaimed ? (
                        <div className="w-6 h-6 mx-auto rounded-full bg-green-500 flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4 text-white" />
                        </div>
                      ) : canClaim ? (
                        <button
                          onClick={() => handleClaim(reward.level)}
                          disabled={claiming === reward.level}
                          className={`w-full py-1 text-xs font-medium rounded-lg transition-all ${
                            claiming === reward.level
                              ? "bg-slate-200 text-slate-500"
                              : "bg-amber-500 hover:bg-amber-600 text-white"
                          }`}
                        >
                          {claiming === reward.level ? t("achievements.pass.claiming") : t("achievements.pass.claim")}
                        </button>
                      ) : (
                        <div className="w-6 h-6 mx-auto rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                          <Lock className="w-3 h-3 text-slate-400" />
                        </div>
                      )}
                    </div>
                  </div>

                  {index < passRewards.length - 1 && (
                    <div className="absolute top-1/2 -right-2 w-4 h-0.5 bg-slate-300 dark:bg-slate-600 -translate-y-1/2 z-0" />
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

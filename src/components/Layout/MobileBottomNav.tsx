import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BookOpen,
  Network,
  GraduationCap,
  BarChart3,
  MoreHorizontal,
  Route,
  Calendar,
  Trophy,
  Sparkles,
  ListChecks,
  Zap,
  User,
  Trash2,
  LucideIcon,
} from "lucide-react";

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

interface MobileBottomNavProps {
  isDark: boolean;
  currentPath: string;
}

const mainNavItems: NavItem[] = [
  { to: "/", icon: BookOpen, label: "我的图谱" },
  { to: "/graph-map", icon: Network, label: "图谱地图" },
  { to: "/study", icon: GraduationCap, label: "学习中心" },
  { to: "/statistics", icon: BarChart3, label: "统计中心" },
];

const moreNavItems: NavItem[] = [
  { to: "/learning-paths", icon: Route, label: "学习路径" },
  { to: "/calendar", icon: Calendar, label: "日历" },
  { to: "/achievements", icon: Trophy, label: "成就系统" },
  { to: "/templates", icon: Sparkles, label: "模板管理" },
  { to: "/tasks", icon: ListChecks, label: "任务中心" },
  { to: "/scheduler", icon: Zap, label: "任务调度" },
  { to: "/profile", icon: User, label: "个人设置" },
  { to: "/trash", icon: Trash2, label: "回收站" },
];

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  isDark,
  currentPath,
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(event.target as Node)
      ) {
        setIsMoreOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setIsMoreOpen(false);
  }, [location.pathname]);

  const isActive = (path: string) => {
    if (path === "/") {
      return currentPath === "/";
    }
    return currentPath.startsWith(path);
  };

  const isMoreActive = moreNavItems.some((item) => isActive(item.to));

  const getNavItemClass = (path: string) => {
    const active = isActive(path);
    return `flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg transition-all duration-200 min-w-[56px] ${
      active
        ? isDark
          ? "text-indigo-400 bg-indigo-950/50"
          : "text-indigo-600 bg-indigo-50"
        : isDark
          ? "text-slate-400 hover:text-slate-200"
          : "text-gray-500 hover:text-gray-700"
    }`;
  };

  const getMoreButtonClass = () => {
    return `flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg transition-all duration-200 min-w-[56px] ${
      isMoreActive
        ? isDark
          ? "text-indigo-400 bg-indigo-950/50"
          : "text-indigo-600 bg-indigo-50"
        : isDark
          ? "text-slate-400 hover:text-slate-200"
          : "text-gray-500 hover:text-gray-700"
    } ${isMoreOpen ? (isDark ? "bg-slate-800" : "bg-gray-100") : ""}`;
  };

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-50 md:hidden ${
        isDark
          ? "bg-slate-950/95 border-slate-800"
          : "bg-white/95 border-gray-200"
      } border-t backdrop-blur-md`}
    >
      <div className="flex items-center justify-around h-14 pb-[var(--safe-area-inset-bottom)]">
        {mainNavItems.map((item) => (
          <Link key={item.to} to={item.to} className={getNavItemClass(item.to)}>
            <item.icon size={20} strokeWidth={isActive(item.to) ? 2.5 : 2} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        ))}

        <div ref={moreMenuRef} className="relative">
          <button
            onClick={() => setIsMoreOpen(!isMoreOpen)}
            className={getMoreButtonClass()}
          >
            <MoreHorizontal
              size={20}
              strokeWidth={isMoreActive || isMoreOpen ? 2.5 : 2}
            />
            <span className="text-[10px] font-medium">更多</span>
          </button>

          {isMoreOpen && (
            <div
              className={`absolute bottom-full right-0 mb-2 w-40 rounded-xl shadow-xl overflow-hidden ${
                isDark
                  ? "bg-slate-900 border border-slate-700"
                  : "bg-white border border-gray-200"
              }`}
            >
              <div className="py-1">
                {moreNavItems.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                      isActive(item.to)
                        ? isDark
                          ? "bg-indigo-950/50 text-indigo-400"
                          : "bg-indigo-50 text-indigo-600"
                        : isDark
                          ? "text-slate-300 hover:bg-slate-800"
                          : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <item.icon size={16} strokeWidth={isActive(item.to) ? 2.5 : 2} />
                    <span className="text-sm">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

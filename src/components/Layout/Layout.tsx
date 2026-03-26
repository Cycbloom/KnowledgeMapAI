import React, { useEffect, useRef, useState, useCallback } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useStore } from "../../store/useStore";
import { useUser, useTasks } from "../../hooks/queries";
import { useLogoutMutation } from "../../hooks/mutations";
import { useTaskEvents } from "../../hooks";
import { useMessageStore } from "../../store/useMessageStore";
import {
  LogOut,
  BookOpen,
  User,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  HelpCircle,
  GraduationCap,
  Trash2,
  Sparkles,
  Trophy,
  Network,
  BarChart3,
  Sun,
  Moon,
  LucideIcon,
  Zap,
  Calendar,
  Route,
} from "lucide-react";
import {
  ErrorBoundary,
  MessageBar,
  OfflineIndicator,
  FocusTimer,
  MobileFocusTimer,
  HelpModal,
  SSEStatusIndicator,
} from "../common";
import { Breadcrumb } from "./Breadcrumb";
import { HeaderGreeting } from "./HeaderGreeting";
import { NotificationCenter } from "../Notifications/NotificationCenter";
import { MobileBottomNav } from "./MobileBottomNav";
import { useTheme } from "../../hooks";
import { useIsMobile } from "../../hooks/common/useIsMobile";
import { api } from "../../services/api";

interface SidebarLinkProps {
  to: string;
  icon: LucideIcon;
  label: string;
  isCollapsed: boolean;
  isDark: boolean;
}

const SidebarLink: React.FC<SidebarLinkProps> = ({
  to,
  icon: Icon,
  label,
  isCollapsed,
}) => (
  <Link
    to={to}
    className={`flex items-center ${isCollapsed ? "justify-center" : "space-x-2"} p-2 hover:bg-slate-800 rounded transition-colors`}
    title={label}
  >
    <Icon size={20} />
    {!isCollapsed && <span>{label}</span>}
  </Link>
);

export const Layout = () => {
  const { user, setUser, token } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const { isMobile } = useIsMobile();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const { addMessage } = useMessageStore();

  const isFullScreenPage =
    location.pathname.startsWith("/graph/") ||
    location.pathname === "/learning";

  const { data: userData, isLoading: isUserLoading } = useUser(
    !!token && !user,
  );
  const logoutMutation = useLogoutMutation();
  const { data: tasksData } = useTasks(!!token);
  useTaskEvents();
  const lastTaskStatusRef = useRef<Map<string, string>>(new Map());
  const hasInitializedTasksRef = useRef(false);

  const handleLogout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (e) {
      console.error(e);
    }
    setUser(null, null);
    navigate("/login");
  }, [logoutMutation, setUser, navigate]);

  const hasSetUserRef = useRef(false);

  useEffect(() => {
    if (userData && userData.user && !hasSetUserRef.current) {
      hasSetUserRef.current = true;
      setUser(userData.user, token);
    } else if (userData && !userData.user && !isUserLoading) {
      handleLogout();
    }
  }, [userData, isUserLoading, setUser, token, handleLogout]);

  // Daily Check-in
  useEffect(() => {
    if (user?.id) {
      const today = new Date().toISOString().split("T")[0];
      const lastCheckIn = localStorage.getItem(`lastCheckIn_${user.id}`);

      if (lastCheckIn !== today) {
        api.achievements
          .checkIn()
          .then(() => {
            localStorage.setItem(`lastCheckIn_${user.id}`, today);
          })
          .catch(console.error);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    if (!Array.isArray(tasksData)) return;

    if (!hasInitializedTasksRef.current) {
      hasInitializedTasksRef.current = true;
      lastTaskStatusRef.current = new Map(
        tasksData.map((t: any) => [t.id, t.status]),
      );
      return;
    }

    const typeLabel = (type: string) => {
      if (type === "generate_questions") return "自动生成题目";
      if (type === "expand_graph") return "自动扩展图谱";
      return type;
    };

    const updated = new Map(lastTaskStatusRef.current);

    for (const t of tasksData as any[]) {
      const prev = lastTaskStatusRef.current.get(t.id);
      if (prev && prev !== t.status) {
        if (t.status === "completed") {
          addMessage({
            type: "success",
            content: `任务完成：${typeLabel(t.type)}`,
            duration: 8000,
            action: { label: "查看", onClick: () => navigate("/tasks") },
          });
        }
        if (t.status === "failed") {
          addMessage({
            type: "error",
            content: `任务失败：${typeLabel(t.type)}${t.error ? `（${t.error}）` : ""}`,
            duration: 10000,
            action: { label: "查看", onClick: () => navigate("/tasks") },
          });
        }
      }
      updated.set(t.id, t.status);
    }

    lastTaskStatusRef.current = updated;
  }, [tasksData, addMessage, navigate]);

  if (!!token && !user && isUserLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">加载中...</div>
      </div>
    );
  }

  return (
    <div
      className={`flex h-screen flex-col ${isDark ? "bg-slate-950 text-slate-100" : "bg-gray-50 text-gray-900"}`}
    >
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Sidebar - Desktop Only */}
        {!isFullScreenPage && !isMobile && (
          <div
            className={`
            bg-slate-900 text-white flex flex-col transition-all duration-300
            ${isCollapsed ? "w-20" : "w-64"}
          `}
          >
            {/* Sidebar Header (Desktop) */}
            <div className="hidden md:flex p-4 text-xl font-bold border-b border-slate-700 items-center justify-between h-16">
              {!isCollapsed && <span className="truncate">知识图谱</span>}
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-1 hover:bg-slate-800 rounded transition-colors"
              >
                {isCollapsed ? (
                  <ChevronRight size={20} />
                ) : (
                  <ChevronLeft size={20} />
                )}
              </button>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              <SidebarLink
                to="/"
                icon={BookOpen}
                label="我的图谱"
                isCollapsed={isCollapsed}
                isDark={isDark}
              />
              <SidebarLink
                to="/graph-map"
                icon={Network}
                label="图谱地图"
                isCollapsed={isCollapsed}
                isDark={isDark}
              />
              <SidebarLink
                to="/study"
                icon={GraduationCap}
                label="学习中心"
                isCollapsed={isCollapsed}
                isDark={isDark}
              />
              <SidebarLink
                to="/learning-paths"
                icon={Route}
                label="学习路径"
                isCollapsed={isCollapsed}
                isDark={isDark}
              />
              <SidebarLink
                to="/statistics"
                icon={BarChart3}
                label="统计中心"
                isCollapsed={isCollapsed}
                isDark={isDark}
              />
              <SidebarLink
                to="/calendar"
                icon={Calendar}
                label="日历"
                isCollapsed={isCollapsed}
                isDark={isDark}
              />
              <SidebarLink
                to="/achievements"
                icon={Trophy}
                label="成就系统"
                isCollapsed={isCollapsed}
                isDark={isDark}
              />
              <SidebarLink
                to="/templates"
                icon={Sparkles}
                label="模板管理"
                isCollapsed={isCollapsed}
                isDark={isDark}
              />
              <SidebarLink
                to="/tasks"
                icon={ListChecks}
                label="任务中心"
                isCollapsed={isCollapsed}
                isDark={isDark}
              />
              <SidebarLink
                to="/scheduler"
                icon={Zap}
                label="任务调度"
                isCollapsed={isCollapsed}
                isDark={isDark}
              />
              <SidebarLink
                to="/profile"
                icon={User}
                label="个人设置"
                isCollapsed={isCollapsed}
                isDark={isDark}
              />
              <SidebarLink
                to="/trash"
                icon={Trash2}
                label="回收站"
                isCollapsed={isCollapsed}
                isDark={isDark}
              />
            </nav>

            {/* Sidebar Footer */}
            <div className="p-4 border-t border-slate-700 pb-[var(--safe-area-inset-bottom)]">
              <button
                onClick={handleLogout}
                className={`flex items-center ${isCollapsed ? "justify-center" : "space-x-2"} text-gray-400 hover:text-white w-full p-2 hover:bg-slate-800 rounded transition-colors`}
                title="退出登录"
              >
                <LogOut size={20} />
                {!isCollapsed && <span>退出登录</span>}
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col w-full relative">
          {/* Top Header */}
          {!isFullScreenPage && (
            <header
              className={`h-12 px-4 md:px-6 flex items-center justify-between shrink-0 z-10 shadow-sm transition-colors border-b relative ${
                isDark
                  ? "bg-slate-900 border-slate-800"
                  : "bg-white border-gray-200"
              }`}
            >
              {/* Left: Breadcrumb */}
              <div className="flex-shrink-0 flex items-center gap-2">
                <Breadcrumb />
              </div>

              {/* Center: Greeting & Stats - 绝对定位居中，移动端隐藏 */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:block">
                <HeaderGreeting />
              </div>

              {/* Right: Status & User */}
              <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                <SSEStatusIndicator />
                <NotificationCenter />
                <button
                  onClick={toggleTheme}
                  className={`p-1.5 rounded-full transition-colors ${
                    isDark
                      ? "text-slate-400 hover:text-yellow-400 hover:bg-slate-800"
                      : "text-gray-500 hover:text-yellow-600 hover:bg-yellow-50"
                  }`}
                  title={isDark ? "切换到浅色模式" : "切换到深色模式"}
                >
                  {isDark ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                <button
                  onClick={() => setIsHelpOpen(true)}
                  className={`p-1.5 rounded-full transition-colors ${
                    isDark
                      ? "text-slate-400 hover:text-blue-400 hover:bg-slate-800"
                      : "text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                  }`}
                  title="操作指南"
                >
                  <HelpCircle size={18} />
                </button>
                {user && (
                  <div
                    className={`hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full border transition-colors ${
                      isDark
                        ? "bg-slate-800 border-slate-700"
                        : "bg-gray-50 border-gray-100"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isDark
                          ? "bg-indigo-900/50 text-indigo-400"
                          : "bg-indigo-100 text-indigo-600"
                      }`}
                    >
                      {user.email?.charAt(0).toUpperCase()}
                    </div>
                    <span
                      className={`text-xs font-medium max-w-[80px] truncate ${isDark ? "text-slate-300" : "text-gray-700"}`}
                    >
                      {(user.user_metadata as any)?.name ||
                        user.email?.split("@")[0]}
                    </span>
                  </div>
                )}
              </div>
            </header>
          )}

          <div
            className={`flex-1 overflow-y-auto custom-scrollbar relative ${isMobile && !isFullScreenPage ? "pb-16" : ""}`}
          >
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
          {isMobile && !isFullScreenPage && (
            <MobileBottomNav isDark={isDark} currentPath={location.pathname} />
          )}
          <MessageBar bottomOffset={isMobile && !isFullScreenPage ? 56 : 0} />
          <OfflineIndicator />
          {isMobile ? <MobileFocusTimer /> : <FocusTimer />}
          <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
        </div>
      </div>
    </div>
  );
};

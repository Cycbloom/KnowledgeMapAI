import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Link, useNavigate, useLocation, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useStore } from "../../store/useStore";
import { useUser } from "../../hooks/queries";
import { useLogoutMutation } from "../../hooks/mutations";
import { useTaskEvents, useConsole } from "../../hooks";
import { frontendEventBus } from "../../services/timer/FrontendEventBus";
import {
  LogOut,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Sun,
  Moon,
  LucideIcon,
  AlertTriangle,
} from "lucide-react";
import {
  ErrorBoundary,
  MessageBar,
  OfflineIndicator,
  FocusTimer,
  MobileFocusTimer,
  HelpModal,
  SSEStatusIndicator,
  SyncStatusIndicator,
} from "../common";
import { Breadcrumb } from "./Breadcrumb";
import { HeaderGreeting } from "./HeaderGreeting";
import { NotificationCenter } from "../Notifications/NotificationCenter";
import { MobileBottomNav } from "./MobileBottomNav";
import { AnimatedOutlet } from "./AnimatedOutlet";
import { useTheme } from "../../hooks";
import { useIsMobile } from "../../hooks/common/useIsMobile";
import { api } from "../../services/api";
import { Console } from "../Console/Console";
import { useGlobalShortcuts } from "../../hooks/common/useGlobalShortcuts";
import { apiClient } from "../../services/api/createApiClient";
import { frontendKernel } from "../../App";
import { iconMap } from "../../utils/iconMap";

/**
 * Shape of the user_metadata stored on the Supabase User object.
 * Supabase types `user_metadata` as a generic record; this narrows it to the
 * fields actually accessed in the UI.
 */
interface UserMetadata {
  name?: string;
  full_name?: string;
  avatar_url?: string;
  study_streak?: number;
}

interface SidebarLinkProps {
  to: string;
  icon: LucideIcon;
  label: string;
  isCollapsed: boolean;
  isDark: boolean;
}

const SidebarLink: React.FC<SidebarLinkProps & { isActive?: boolean }> = ({
  to,
  icon: Icon,
  label,
  isCollapsed,
  isActive,
}) => (
  <Link
    to={to}
    className={`flex items-center ${isCollapsed ? "justify-center" : "space-x-2"} p-2 hover:bg-slate-800 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-inset ${isActive ? "bg-slate-700" : ""}`}
    title={label}
    aria-label={label}
    aria-current={isActive ? "page" : undefined}
  >
    <Icon size={20} aria-hidden="true" />
    {!isCollapsed && <span>{label}</span>}
  </Link>
);

export const Layout = () => {
  const { t } = useTranslation();
  const { user, setUser, token } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const { isMobile } = useIsMobile();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [schemaStatus, setSchemaStatus] = useState<string | null>(null);

  const isFullScreenPage =
    location.pathname.startsWith("/graph/") ||
    location.pathname === "/learning" ||
    location.pathname.startsWith("/scheduler/task/");

  const {
    isOpen: isConsoleOpen,
    isMinimized: isConsoleMinimized,
    context: consoleContext,
    open: openConsole,
    close: closeConsole,
    toggleMinimize: toggleConsoleMinimize,
  } = useConsole({
    userId: user?.id || '',
    autoRegisterCommands: true,
  });

  useGlobalShortcuts({
    handlers: {
      openConsole: () => {
        if (isConsoleOpen) {
          closeConsole();
        } else {
          openConsole();
        }
      },
      showHelp: () => {
        setIsHelpOpen(true);
      },
      toggleTheme: () => {
        toggleTheme();
      },
    },
    enabled: true,
  });

  const { data: userData, isLoading: isUserLoading } = useUser(
    !!token && !user,
  );
  const logoutMutation = useLogoutMutation();
  useTaskEvents();

  useEffect(() => {
    if (!token) return;
    const checkSchema = async () => {
      try {
        const response = await apiClient.get("/database/status") as { status?: string; error?: string };
        if (response.status && response.status !== "ready" && response.status !== "not_configured") {
          setSchemaStatus(response.status);
        } else {
          setSchemaStatus(null);
        }
      } catch {
        setSchemaStatus(null);
      }
    };
    checkSchema();
  }, [token]);

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
    const typeLabel = (type: string) => {
      if (type === "generate_questions") return t('layout.autoGenerateQuestions');
      if (type === "expand_graph") return t('layout.autoExpandGraph');
      return type;
    };

    const handler = (payload: { taskId: string; oldStatus: string; newStatus: string; taskType?: string }) => {
      if (payload.newStatus === "completed") {
        frontendEventBus.publish("message_show", {
          type: "success",
          content: `${t('layout.taskCompleted')}：${typeLabel(payload.taskType ?? "")}`,
          duration: 8000,
          action: { label: t('common.view'), onClick: () => navigate("/tasks") },
        });
      }
      if (payload.newStatus === "failed") {
        frontendEventBus.publish("message_show", {
          type: "error",
          content: `${t('layout.taskFailed')}：${typeLabel(payload.taskType ?? "")}`,
          duration: 10000,
          action: { label: t('common.view'), onClick: () => navigate("/tasks") },
        });
      }
    };

    const unsubscribe = frontendEventBus.subscribe("scheduler_task_status_changed", handler);
    return unsubscribe;
  }, [navigate, t]);

  const navItems = useMemo(() => frontendKernel.getNavItems(), [frontendKernel]);

  if (!!token && !user && isUserLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div
      className={`flex h-screen flex-col ${isDark ? "bg-slate-950 text-slate-100" : "bg-gray-50 text-gray-900"}`}
    >
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {!isFullScreenPage && !isMobile && (
          <div
            className={`
            bg-slate-900 text-white flex flex-col transition-all duration-300
            ${isCollapsed ? "w-20" : "w-64"}
          `}
          >
            <div className={`hidden md:flex p-4 text-xl font-bold border-b border-slate-700 items-center h-16 ${isCollapsed ? "justify-center" : "justify-between"}`}>
              {!isCollapsed && <span className="truncate">{t('layout.appName')}</span>}
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className={`p-2 hover:bg-slate-800 rounded transition-colors`}
                aria-label={isCollapsed ? t('layout.expandSidebar') : t('layout.collapseSidebar')}
                aria-expanded={!isCollapsed}
              >
                {isCollapsed ? (
                  <ChevronRight size={20} aria-hidden="true" />
                ) : (
                  <ChevronLeft size={20} aria-hidden="true" />
                )}
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar" aria-label={t('layout.mainNavigation')}>
              {navItems.map((item) => {
                const Icon = (item.icon ? iconMap[item.icon] : undefined) ?? BookOpen;
                const isActive = item.path === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.path);
                return (
                  <SidebarLink
                    key={item.path}
                    to={item.path}
                    icon={Icon}
                    label={t(item.label)}
                    isCollapsed={isCollapsed}
                    isDark={isDark}
                    isActive={isActive}
                  />
                );
              })}
            </nav>

            <div className="p-4 border-t border-slate-700 pb-[var(--safe-area-inset-bottom)]">
              <button
                onClick={handleLogout}
                className={`flex items-center ${isCollapsed ? "justify-center" : "space-x-2"} text-gray-400 hover:text-white w-full p-2 hover:bg-slate-800 rounded transition-colors`}
                title={t('layout.logout')}
                aria-label={t('layout.logout')}
              >
                <LogOut size={20} aria-hidden="true" />
                {!isCollapsed && <span>{t('layout.logout')}</span>}
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col w-full relative">
          {!isFullScreenPage && (
            <header
              className={`h-12 px-4 md:px-6 flex items-center justify-between shrink-0 z-10 shadow-sm transition-colors border-b relative ${
                isDark
                  ? "bg-slate-900 border-slate-800"
                  : "bg-white border-gray-200"
              }`}
            >
              <div className="flex-shrink-0 flex items-center gap-2">
                <Breadcrumb />
              </div>

              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:block">
                <HeaderGreeting />
              </div>

              <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                <SyncStatusIndicator />
                <SSEStatusIndicator />
                <NotificationCenter />
                <button
                  onClick={toggleTheme}
                  className={`p-1.5 rounded-full transition-colors ${
                    isDark
                      ? "text-slate-400 hover:text-yellow-400 hover:bg-slate-800"
                      : "text-gray-500 hover:text-yellow-600 hover:bg-yellow-50"
                  }`}
                  title={isDark ? t('layout.switchToLightMode') : t('layout.switchToDarkMode')}
                  aria-label={isDark ? t('layout.switchToLightMode') : t('layout.switchToDarkMode')}
                >
                  {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
                </button>
                <button
                  onClick={() => setIsHelpOpen(true)}
                  className={`p-1.5 rounded-full transition-colors ${
                    isDark
                      ? "text-slate-400 hover:text-primary-400 hover:bg-slate-800"
                      : "text-gray-500 hover:text-primary-600 hover:bg-primary-50"
                  }`}
                  title={t('layout.helpGuide')}
                  aria-label={t('layout.helpGuide')}
                >
                  <HelpCircle size={18} aria-hidden="true" />
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
                          ? "bg-primary-900/50 text-primary-400"
                          : "bg-primary-100 text-primary-600"
                      }`}
                    >
                      {user.email?.charAt(0).toUpperCase()}
                    </div>
                    <span
                      className={`text-xs font-medium max-w-[80px] truncate ${isDark ? "text-slate-300" : "text-gray-700"}`}
                    >
                      {(user.user_metadata as UserMetadata | undefined)?.name ||
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
            {schemaStatus && (
              <div
                className="mx-4 mt-3 p-3 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200 flex items-center gap-3 cursor-pointer"
                onClick={() => navigate("/settings")}
              >
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <div className="flex-1 text-sm">
                  {schemaStatus === "empty"
                    ? t("layout.schemaEmpty")
                    : schemaStatus === "partial"
                      ? t("layout.schemaPartial")
                      : t("layout.schemaNeedsUpgrade")}
                </div>
                <button
                  className="px-3 py-1.5 rounded-md bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 transition-colors min-h-[36px]"
                  onClick={(e) => { e.stopPropagation(); navigate("/settings"); }}
                >
                  {t("layout.goToSettings")}
                </button>
              </div>
            )}
            <ErrorBoundary>
              {isFullScreenPage ? <Outlet /> : <AnimatedOutlet />}
            </ErrorBoundary>
          </div>
          {isMobile && !isFullScreenPage && (
            <MobileBottomNav isDark={isDark} currentPath={location.pathname} />
          )}
          <MessageBar bottomOffset={isMobile && !isFullScreenPage ? 56 : 0} />
          <OfflineIndicator />
          {isMobile ? <MobileFocusTimer /> : <FocusTimer />}
          <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
          {user?.id && (
            <Console
              isOpen={isConsoleOpen}
              onClose={closeConsole}
              context={consoleContext}
              onToggleMinimize={toggleConsoleMinimize}
              isMinimized={isConsoleMinimized}
            />
          )}
        </div>
      </div>
    </div>
  );
};

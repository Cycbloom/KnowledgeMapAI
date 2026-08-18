import React, { useEffect, useRef, useState, useCallback, useMemo, useId, Suspense } from "react";
import { Link, useNavigate, useLocation, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useStore } from "../../store/useStore";
import { useUser, queryKeys } from "../../hooks/queries";
import { useLogoutMutation, useImportGraphMutation } from "../../hooks/mutations";
import { useTaskEvents, useConsole, useTheme } from "../../hooks";
import { frontendEventBus } from "../../services/timer/FrontendEventBus";
import {
  LogOut,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Sun,
  Moon,
  Menu,
  LucideIcon,
  AlertTriangle,
  Upload,
} from "lucide-react";
import {
  ErrorBoundary,
  MessageBar,
  OfflineIndicator,
  FocusTimer,
  MobileFocusTimer,
  SSEStatusIndicator,
  SyncStatusIndicator,
  DataFreshnessIndicator,
} from "../common";
import { Breadcrumb } from "./Breadcrumb";
import { HeaderGreeting } from "./HeaderGreeting";
import { NotificationCenter } from "../Notifications/NotificationCenter";
import { AnimatedOutlet } from "./AnimatedOutlet";
import { useIsMobile } from "../../hooks/common/useIsMobile";
import { useSwipeBack } from "../../hooks/gesture/useSwipeBack";
import { api } from "../../services/api";
import { useGlobalShortcuts } from "../../hooks/common/useGlobalShortcuts";
import { useNetworkStatus } from "../../hooks/common/useNetworkStatus";
import { useSkipToContent } from "../../hooks/common/useSkipToContent";
import { apiClient } from "../../services/api/createApiClient";
import { frontendKernel } from "../../App";
import { iconMap } from "../../utils/iconMap";
import { parseMarkdownToGraph } from "../../utils/markdownParser";
import { parseOpmlToGraph } from "../../utils/opmlParser";
import { message } from "../../utils/messageHelper";

// 移动端组件延迟加载，减少桌面端非必要加载
const MobileBottomNav = React.lazy(() => import("./MobileBottomNav").then(m => ({ default: m.MobileBottomNav })));
const MobileSidebarDrawer = React.lazy(() => import("./MobileSidebarDrawer").then(m => ({ default: m.MobileSidebarDrawer })));

// P6: 主入口瘦身——用户动作触发的壳层弹层改为懒加载，仅在打开时挂载加载，
// 减少首屏 index chunk 体积与解析开销。打开/关闭及快捷键逻辑均在 Layout 常驻层处理，
// 组件为纯展示弹层，条件挂载不改变行为。
const LazyShortcutHelpPanel = React.lazy(() =>
  import("../common/ShortcutHelpPanel").then((m) => ({ default: m.ShortcutHelpPanel })),
);
const LazyGlobalCommandPalette = React.lazy(() =>
  import("../common/GlobalCommandPalette").then((m) => ({ default: m.GlobalCommandPalette })),
);
const LazyConsole = React.lazy(() =>
  import("../Console/Console").then((m) => ({ default: m.Console })),
);
// P7: 主入口常驻壳层瘦身（第二轮）——UpdateOverlay 仅在更新可用时渲染（平时返回 null），
// 改为懒加载，从主入口剥离其按需触发的代码。
const LazyUpdateOverlay = React.lazy(() =>
  import("../common/UpdateOverlay").then((m) => ({ default: m.UpdateOverlay })),
);

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
  onPrefetch?: () => void;
}

const SidebarLink: React.FC<SidebarLinkProps & { isActive?: boolean }> = ({
  to,
  icon: Icon,
  label,
  isCollapsed,
  isActive,
  onPrefetch,
}) => (
  <Link
    to={to}
    className={`flex items-center ${isCollapsed ? "justify-center" : "space-x-2"} p-2.5 min-w-[44px] min-h-[44px] hover:bg-slate-800 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-inset ${isActive ? "bg-slate-700" : ""}`}
    title={label}
    aria-label={label}
    aria-current={isActive ? "page" : undefined}
    onMouseEnter={onPrefetch}
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
  useSwipeBack({ enabled: isMobile });
  const { mainRef, handleSkip } = useSkipToContent();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(readInitialCollapsed());
  const sidebarId = useId();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [schemaStatus, setSchemaStatus] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const importGraphMutation = useImportGraphMutation();
  const dragCounterRef = useRef(0);

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
      openCommandPalette: () => {
        // GraphEditor 全屏路径有自己的 CommandPalette，不触发全局
        if (
          location.pathname.startsWith("/graph/") ||
          location.pathname === "/learning" ||
          location.pathname.startsWith("/scheduler/task/")
        ) {
          return;
        }
        setIsCommandPaletteOpen((prev) => !prev);
      },
      openSearch: () => {
        // 搜索能力已内嵌在全局命令面板中，行为与 openCommandPalette 一致
        if (
          location.pathname.startsWith("/graph/") ||
          location.pathname === "/learning" ||
          location.pathname.startsWith("/scheduler/task/")
        ) {
          return;
        }
        setIsCommandPaletteOpen((prev) => !prev);
      },
      navigateBack: () => {
        navigate(-1);
      },
      navigateForward: () => {
        navigate(1);
      },
      goHome: () => {
        navigate("/");
      },
      openSettings: () => {
        navigate("/settings");
      },
      // 页面直达快捷键：通过 Alt+数字 快速跳转到对应页面
      navDashboard: () => navigate("/"),
      navGraphMap: () => navigate("/graph-map"),
      navTasks: () => navigate("/tasks"),
      navStudy: () => navigate("/study"),
      navNotes: () => navigate("/notes"),
      navScheduler: () => navigate("/scheduler"),
    },
    enabled: true,
  });

  useNetworkStatus({
    enableSlowDetection: true,
    onOnline: () => message.success(t('toast.common.backOnline')),
    onSlowConnection: () => message.warning(t('toast.common.slowConnection')),
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

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Navigate to dashboard first
    navigate("/");

    for (const file of files) {
      try {
        const content = await file.text();
        let importData;

        if (file.name.endsWith(".md")) {
          const parsed = parseMarkdownToGraph(content);
          importData = {
            graph_title: parsed.graph_title || file.name.replace(".md", ""),
            nodes: parsed.nodes,
            edges: parsed.edges,
          };
        } else if (file.name.endsWith(".opml")) {
          const parsed = parseOpmlToGraph(content);
          importData = {
            graph_title: parsed.graph_title || file.name.replace(".opml", ""),
            nodes: parsed.nodes,
            edges: parsed.edges,
          };
        } else {
          const data = JSON.parse(content);
          importData = {
            graph_title:
              data.graph?.title ||
              data.graph_title ||
              file.name.replace(".json", ""),
            nodes: data.nodes || [],
            edges: data.edges || [],
          };
        }

        await importGraphMutation.mutateAsync(importData);
        message.success(t('layout.importSuccess', { title: importData.graph_title }));
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : t('layout.formatError');
        message.error(t('layout.importFailed', { message: errorMessage }));
      }
    }
  }, [navigate, importGraphMutation, t]);

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
        message.success(t('layout.taskCompletedMessage', { label: typeLabel(payload.taskType ?? "") }), {
          duration: 8000,
          action: { label: t('common.view'), onClick: () => navigate("/tasks") },
        });
      }
      if (payload.newStatus === "failed") {
        message.error(t('layout.taskFailedMessage', { label: typeLabel(payload.taskType ?? "") }), {
          duration: 10000,
          action: { label: t('common.view'), onClick: () => navigate("/tasks") },
        });
      }
    };

    const unsubscribe = frontendEventBus.subscribe("scheduler_task_status_changed", handler);
    return unsubscribe;
  }, [navigate, t]);

  // 路由切换时自动 focus 主内容区，便于键盘导航与屏幕阅读器
  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname, mainRef]);

  // 路由切换时自动关闭移动端抽屉
  useEffect(() => {
    setIsMobileDrawerOpen(false);
  }, [location.pathname]);

  // 左侧导航折叠状态变化时写入 localStorage，实现持久化；失败时忽略
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
    } catch (err) {
      console.error(err);
    }
  }, [isCollapsed]);

  const navItems = useMemo(() => frontendKernel.getNavItems(), [frontendKernel]);

  const queryClient = useQueryClient();
  const getPrefetchHandler = useCallback(
    (path: string): (() => void) => {
      switch (path) {
        case "/":
          return () => {
            queryClient.prefetchQuery({ queryKey: queryKeys.graphs, queryFn: api.graphs.list, meta: { silent: true } });
            queryClient.prefetchQuery({ queryKey: queryKeys.dashboardStats, queryFn: api.dashboard.getStats, meta: { silent: true } });
          };
        case "/graph-map":
          return () => {
            queryClient.prefetchQuery({ queryKey: queryKeys.graphMap(), queryFn: api.domains.getTree, meta: { silent: true } });
          };
        case "/study":
          return () => {
            queryClient.prefetchQuery({ queryKey: queryKeys.studyCards({ due: true }), queryFn: () => api.study.getCards({ due: true }), meta: { silent: true } });
          };
        case "/notes":
          return () => {
            queryClient.prefetchQuery({ queryKey: queryKeys.notes(), queryFn: () => api.notes.list(), meta: { silent: true } });
          };
        case "/learning-paths":
          return () => {
            queryClient.prefetchQuery({ queryKey: queryKeys.learningLoops(), queryFn: () => api.learningPaths.list(), meta: { silent: true } });
          };
        case "/statistics":
          return () => {
            queryClient.prefetchQuery({ queryKey: queryKeys.statistics, queryFn: api.statistics.getStats, meta: { silent: true } });
          };
        case "/calendar":
          return () => {
            queryClient.prefetchQuery({ queryKey: queryKeys.calendarExecutions(), queryFn: () => api.scheduler.list({}), meta: { silent: true } });
          };
        case "/achievements":
          return () => {
            queryClient.prefetchQuery({ queryKey: queryKeys.achievements(), queryFn: api.achievements.list, meta: { silent: true } });
          };
        case "/templates":
          return () => {
            queryClient.prefetchQuery({ queryKey: queryKeys.templates(), queryFn: () => api.templates.list(), meta: { silent: true } });
          };
        case "/tasks":
          return () => {
            queryClient.prefetchQuery({ queryKey: queryKeys.tasks(), queryFn: () => api.tasks.list(), meta: { silent: true } });
          };
        case "/scheduler":
          return () => {
            queryClient.prefetchQuery({ queryKey: queryKeys.schedulerTasks(), queryFn: () => api.scheduler.list({}), meta: { silent: true } });
          };
        case "/trash":
          return () => {
            queryClient.prefetchQuery({ queryKey: queryKeys.trashGraphs, queryFn: api.graphs.listTrash, meta: { silent: true } });
          };
        default:
          return () => {};
      }
    },
    [queryClient],
  );

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
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-skip-link focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded"
        onKeyDown={handleSkip}
      >
        {t('common.skipToContent')}
      </a>
      {/* Global Drop Zone Overlay */}
      {isDragOver && (
        <div className="fixed inset-0 z-skip-link bg-primary-500/10 border-2 border-dashed border-primary-400 flex flex-col items-center justify-center backdrop-blur-sm">
          <Upload className="w-16 h-16 text-primary-500 mb-4" />
          <p className={`text-xl font-semibold ${isDark ? "text-primary-400" : "text-primary-600"}`}>
            {t("layout.dropZone.title")}
          </p>
          <p className={`text-sm mt-1 ${isDark ? "text-slate-400" : "text-gray-500"}`}>
            {t("layout.dropZone.subtitle")}
          </p>
        </div>
      )}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {!isFullScreenPage && !isMobile && (
          <div
            id={sidebarId}
            className={`
            bg-slate-900 text-white flex flex-col transition-all duration-300
            ${isCollapsed ? "w-20" : "w-64"}
          `}
          >
            <div className={`hidden md:flex p-4 text-xl font-bold border-b border-slate-700 items-center h-16 ${isCollapsed ? "justify-center" : "justify-between"}`}>
              {!isCollapsed && <span className="truncate">{t('layout.appName')}</span>}
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className={`p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-slate-800 rounded transition-colors`}
                aria-label={isCollapsed ? t('layout.expandSidebar') : t('layout.collapseSidebar')}
                aria-expanded={!isCollapsed}
                aria-controls={sidebarId}
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
                    onPrefetch={getPrefetchHandler(item.path)}
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

        <main id="main-content" ref={mainRef} tabIndex={-1} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col w-full relative focus:outline-none">
          {!isFullScreenPage && (
            <header
              className={`h-12 px-4 md:px-6 flex items-center justify-between shrink-0 z-10 shadow-sm transition-colors border-b relative ${
                isDark
                  ? "bg-slate-900 border-slate-800"
                  : "bg-white border-gray-200"
              }`}
            >
              <div className="flex-shrink-0 flex items-center gap-2 min-w-0">
                <button
                  className="md:hidden p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded transition-colors hover:bg-black/5"
                  onClick={() => setIsMobileDrawerOpen(true)}
                  aria-label={t('layout.openSidebar')}
                >
                  <Menu size={20} aria-hidden="true" />
                </button>
                <Breadcrumb />
              </div>

              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden 2xl:block">
                <HeaderGreeting />
              </div>

              <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                <DataFreshnessIndicator className="hidden lg:flex" />
                <SyncStatusIndicator />
                <SSEStatusIndicator />
                <NotificationCenter />
                <button
                  onClick={toggleTheme}
                  className={`p-2.5 rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors ${
                    isDark
                      ? "text-slate-400 hover:text-yellow-400 hover:bg-slate-800"
                      : "text-gray-500 hover:text-yellow-600 hover:bg-yellow-50"
                  }`}
                  title={isDark ? t('layout.switchToLightMode') : t('layout.switchToDarkMode')}
                  aria-label={isDark ? t('layout.switchToLightMode') : t('layout.switchToDarkMode')}
                  aria-pressed={isDark}
                >
                  {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
                </button>
                <button
                  onClick={() => setIsHelpOpen(true)}
                  className={`p-2.5 rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors ${
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
                    className={`hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full border transition-colors ${
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
            role="main"
            aria-label={t('common.aria.mainContent')}
            className={`flex-1 overflow-y-auto custom-scrollbar relative ${isMobile && !isFullScreenPage ? "pb-[calc(3.5rem+var(--safe-area-inset-bottom))]" : ""}`}
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
            <Suspense fallback={null}>
              <MobileBottomNav isDark={isDark} currentPath={location.pathname} onPrefetch={getPrefetchHandler} />
            </Suspense>
          )}
          {isMobile && !isFullScreenPage && (
            <Suspense fallback={null}>
              <MobileSidebarDrawer
                isOpen={isMobileDrawerOpen}
                onClose={() => setIsMobileDrawerOpen(false)}
                navItems={navItems}
                isDark={isDark}
                currentPath={location.pathname}
                onPrefetch={getPrefetchHandler}
              />
            </Suspense>
          )}
          <Suspense fallback={null}>
            <LazyUpdateOverlay />
          </Suspense>
          <MessageBar bottomOffset={isMobile && !isFullScreenPage ? 56 : 0} />
          <OfflineIndicator />
          {isMobile ? <MobileFocusTimer /> : <FocusTimer />}
          {isHelpOpen && (
            <Suspense fallback={null}>
              <LazyShortcutHelpPanel isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
            </Suspense>
          )}
          {!isFullScreenPage && isCommandPaletteOpen && (
            <Suspense fallback={null}>
              <LazyGlobalCommandPalette
                isOpen={isCommandPaletteOpen}
                onClose={() => setIsCommandPaletteOpen(false)}
              />
            </Suspense>
          )}
          {user?.id && isConsoleOpen && (
            <Suspense fallback={null}>
              <LazyConsole
                isOpen={isConsoleOpen}
                onClose={closeConsole}
                context={consoleContext}
                onToggleMinimize={toggleConsoleMinimize}
                isMinimized={isConsoleMinimized}
              />
            </Suspense>
          )}
        </main>
        <footer className="sr-only" role="contentinfo">
          {t('common.footer.copyright')}
        </footer>
      </div>
    </div>
  );
};

// P6: 左侧导航折叠状态持久化——初始化时读取 localStorage，变化时写回，
// 记忆用户选择；key 不存在时回退折叠（保持原默认行为）。
const SIDEBAR_COLLAPSED_KEY = "layout.sidebarCollapsed";
function readInitialCollapsed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return stored !== null ? stored === "true" : true;
  } catch {
    return true;
  }
}

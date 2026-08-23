import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ChevronRight, ChevronLeft, Home } from "lucide-react";
import { useTheme } from "../../hooks";
import { useIsMobile } from "../../hooks/common/useIsMobile";
import { useNote } from "../../hooks/queries/useNoteQueries";
import { useLearningPath } from "../../hooks/queries/useLearningPathQueries";
import { useQuizSet } from "../../hooks/queries/useQuizQueries";

/**
 * 详情路由解析结果，kind 标识详情页类型并携带对应路径参数。
 */
type DetailKind =
  | { kind: "note"; noteId: string }
  | { kind: "learningPath"; id: string }
  | { kind: "quiz"; quizSetId: string }
  | { kind: "quizPractice"; quizSetId: string }
  | { kind: "schedulerTask"; taskId: string }
  | { kind: "combinedGraphs"; id1: string; id2: string };

/**
 * 从 pathname 解析详情路由。
 * Layout 为布局路由（无 path），useParams 无法取到子路由参数，故直接解析 location.pathname。
 */
const parseDetailPath = (pathname: string): DetailKind | undefined => {
  let match: RegExpMatchArray | null = pathname.match(/^\/notes\/([^/]+)$/);
  if (match) return { kind: "note", noteId: match[1] };
  match = pathname.match(/^\/learning-paths\/([^/]+)$/);
  if (match) return { kind: "learningPath", id: match[1] };
  match = pathname.match(/^\/quiz\/([^/]+)\/practice$/);
  if (match) return { kind: "quizPractice", quizSetId: match[1] };
  match = pathname.match(/^\/quiz\/([^/]+)$/);
  if (match) return { kind: "quiz", quizSetId: match[1] };
  match = pathname.match(/^\/scheduler\/task\/([^/]+)$/);
  if (match) return { kind: "schedulerTask", taskId: match[1] };
  match = pathname.match(/^\/combined-graphs\/([^/]+)\/([^/]+)$/);
  if (match) return { kind: "combinedGraphs", id1: match[1], id2: match[2] };
  return undefined;
};

/**
 * 详情路由的父级（列表）路径，供面包屑解析与移动端返回按钮复用。
 */
const getDetailParentPath = (pathname: string): string | undefined => {
  const detail = parseDetailPath(pathname);
  if (!detail) return undefined;
  switch (detail.kind) {
    case "note":
      return "/notes";
    case "learningPath":
      return "/learning-paths";
    case "quiz":
      return "/study";
    case "quizPractice":
      return `/quiz/${detail.quizSetId}`;
    case "schedulerTask":
      return "/scheduler";
    case "combinedGraphs":
      return "/graph-map";
  }
};

export const Breadcrumb: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { isMobile } = useIsMobile();
  const path = location.pathname;

  // 从 pathname 解析详情参数；各查询 hook 在参数为空时自禁用查询
  const detail = parseDetailPath(path);
  const noteId = detail?.kind === "note" ? detail.noteId : undefined;
  const learningPathId = detail?.kind === "learningPath" ? detail.id : undefined;
  const quizSetId =
    detail?.kind === "quiz" || detail?.kind === "quizPractice" ? detail.quizSetId : undefined;

  const { data: note } = useNote(noteId);
  const { data: learningPath } = useLearningPath(learningPathId ?? "");
  const { data: quizSet } = useQuizSet(quizSetId ?? "", !!quizSetId);

  const getRouteLabel = (routePath: string): string | undefined => {
    switch (routePath) {
      case "/": return t('layout.breadcrumb.home');
      case "/graph-map": return t('layout.breadcrumb.graphMap');
      case "/study": return t('layout.breadcrumb.studyCenter');
      case "/learning": return t('layout.breadcrumb.learningMode');
      case "/notes": return t('layout.breadcrumb.notes');
      case "/statistics": return t('layout.breadcrumb.statistics');
      case "/calendar": return t('layout.breadcrumb.calendar');
      case "/achievements": return t('layout.breadcrumb.achievements');
      case "/templates": return t('layout.breadcrumb.templates');
      case "/tasks": return t('layout.breadcrumb.tasks');
      case "/profile": return t('layout.breadcrumb.profile');
      case "/trash": return t('layout.breadcrumb.trash');
      case "/graph": return t('layout.breadcrumb.graphEditor');
      case "/scheduler": return t('layout.breadcrumb.scheduler');
      case "/learning-paths": return t('layout.breadcrumb.learningPaths');
      case "/settings": return t('layout.breadcrumb.settings');
      case "/scheduler/current": return t('layout.breadcrumb.currentTask');
      case "/scheduler/stats": return t('layout.breadcrumb.schedulerStats');
      case "/combined-graphs/:id1/:id2": return t('layout.breadcrumb.combinedGraphs');
      default: return undefined;
    }
  };

  const getBreadcrumbs = (): { path: string; label: string }[] => {
    const breadcrumbs: { path: string; label: string }[] = [
      { path: "/", label: getRouteLabel("/") ?? "/" },
    ];

    if (path === "/") {
      return breadcrumbs;
    }

    const detailRoute = parseDetailPath(path);
    if (detailRoute) {
      switch (detailRoute.kind) {
        case "note": {
          const parentPath = "/notes";
          breadcrumbs.push({ path: parentPath, label: getRouteLabel(parentPath) ?? parentPath });
          breadcrumbs.push({ path, label: note?.title || getRouteLabel(parentPath) || parentPath });
          break;
        }
        case "learningPath": {
          const parentPath = "/learning-paths";
          breadcrumbs.push({ path: parentPath, label: getRouteLabel(parentPath) ?? parentPath });
          breadcrumbs.push({ path, label: learningPath?.title || getRouteLabel(parentPath) || parentPath });
          break;
        }
        case "quiz": {
          breadcrumbs.push({ path: "/study", label: getRouteLabel("/study") ?? "/study" });
          breadcrumbs.push({ path, label: quizSet?.title || t("layout.breadcrumb.quiz") });
          break;
        }
        case "quizPractice": {
          const parentPath = `/quiz/${detailRoute.quizSetId}`;
          breadcrumbs.push({ path: parentPath, label: quizSet?.title || t("layout.breadcrumb.quiz") });
          breadcrumbs.push({ path, label: t("layout.breadcrumb.quizPractice") });
          break;
        }
        case "schedulerTask": {
          breadcrumbs.push({ path: "/scheduler", label: getRouteLabel("/scheduler") ?? "/scheduler" });
          breadcrumbs.push({ path, label: t("layout.breadcrumb.tasks") });
          break;
        }
        case "combinedGraphs": {
          breadcrumbs.push({ path: "/graph-map", label: getRouteLabel("/graph-map") ?? "/graph-map" });
          breadcrumbs.push({ path, label: t("layout.breadcrumb.combinedGraphs") });
          break;
        }
      }
      return breadcrumbs;
    }

    if (path.startsWith("/graph/")) {
      breadcrumbs.push({ path: "/graph", label: getRouteLabel("/graph") ?? "/graph" });
      return breadcrumbs;
    }

    if (path.startsWith("/learning")) {
      breadcrumbs.push({ path, label: getRouteLabel(path) || getRouteLabel("/learning") || path });
      return breadcrumbs;
    }

    const label = getRouteLabel(path);
    if (label) {
      breadcrumbs.push({ path, label });
    }

    return breadcrumbs;
  };

  const handleGoBack = () => {
    const parentPath = getDetailParentPath(path);
    if (parentPath) {
      navigate(parentPath);
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  const breadcrumbs = getBreadcrumbs();
  const showBackButton = isMobile && path !== "/";

  return (
    <nav className="flex items-center gap-1 text-sm" aria-label={t("common.aria.breadcrumb")}>
      {showBackButton && (
        <motion.button
          onClick={handleGoBack}
          className={`flex items-center justify-center mr-1 p-2 -ml-2 rounded-full min-w-[44px] min-h-[44px] ${
            isDark
              ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          }`}
          whileTap={{ scale: 0.92 }}
          aria-label={t('common.back')}
        >
          <ChevronLeft size={22} strokeWidth={2.5} />
        </motion.button>
      )}

      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={crumb.path}>
          {index > 0 && (
            <ChevronRight
              size={14}
              className={isDark ? "text-slate-600" : "text-gray-400"}
              aria-hidden="true"
            />
          )}
          {index === breadcrumbs.length - 1 ? (
            <span
              className={`${isDark ? "text-slate-300" : "text-gray-700"} ${showBackButton ? "font-medium" : ""}`}
              aria-current="page"
            >
              {crumb.label}
            </span>
          ) : (
            <Link
              to={crumb.path}
              className={`transition-colors ${
                isDark
                  ? "text-slate-400 hover:text-slate-200"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {index === 0 ? <Home size={16} aria-hidden="true" /> : crumb.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

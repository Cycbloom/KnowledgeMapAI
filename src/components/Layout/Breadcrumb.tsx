import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ChevronRight, ChevronLeft, Home } from "lucide-react";
import { useTheme } from "../../hooks";
import { useIsMobile } from "../../hooks/common/useIsMobile";

export const Breadcrumb: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { isMobile } = useIsMobile();
  const path = location.pathname;

  const getRouteLabel = (routePath: string): string => {
    switch (routePath) {
      case "/": return t('layout.breadcrumb.home');
      case "/graph-map": return t('layout.breadcrumb.graphMap');
      case "/study": return t('layout.breadcrumb.studyCenter');
      case "/learning": return t('layout.breadcrumb.learningMode');
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
      default: return routePath;
    }
  };

  const getBreadcrumbs = () => {
    const breadcrumbs: { path: string; label: string }[] = [];

    breadcrumbs.push({ path: "/", label: getRouteLabel("/") });

    if (path === "/") {
      return breadcrumbs;
    }

    if (path.startsWith("/graph/")) {
      breadcrumbs.push({ path: "/graph", label: getRouteLabel("/graph") });
    } else if (path.startsWith("/learning")) {
      breadcrumbs.push({ path, label: getRouteLabel(path) || getRouteLabel("/learning") });
    } else {
      const label = getRouteLabel(path);
      if (label) {
        breadcrumbs.push({ path, label });
      }
    }

    return breadcrumbs;
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
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

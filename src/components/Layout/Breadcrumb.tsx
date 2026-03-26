import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { useTheme } from "../../hooks";

const routeMap: Record<string, string> = {
  "/": "首页",
  "/graph-map": "图谱地图",
  "/study": "学习中心",
  "/learning": "学习模式",
  "/statistics": "统计中心",
  "/calendar": "日历",
  "/achievements": "成就系统",
  "/templates": "模板管理",
  "/tasks": "任务中心",
  "/profile": "个人设置",
  "/trash": "回收站",
};

export const Breadcrumb: React.FC = () => {
  const location = useLocation();
  const { isDark } = useTheme();
  const path = location.pathname;

  const getBreadcrumbs = () => {
    const breadcrumbs: { path: string; label: string }[] = [];

    breadcrumbs.push({ path: "/", label: "首页" });

    if (path === "/") {
      return breadcrumbs;
    }

    if (path.startsWith("/graph/")) {
      breadcrumbs.push({ path: "/graph", label: "图谱编辑" });
    } else if (path.startsWith("/learning")) {
      const label = routeMap[path] || "学习模式";
      breadcrumbs.push({ path, label });
    } else {
      const label = routeMap[path];
      if (label) {
        breadcrumbs.push({ path, label });
      }
    }

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="flex items-center gap-1 text-sm">
      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={crumb.path}>
          {index > 0 && (
            <ChevronRight
              size={14}
              className={isDark ? "text-slate-600" : "text-gray-400"}
            />
          )}
          {index === breadcrumbs.length - 1 ? (
            <span className={isDark ? "text-slate-300" : "text-gray-700"}>
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
              {index === 0 ? <Home size={16} /> : crumb.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

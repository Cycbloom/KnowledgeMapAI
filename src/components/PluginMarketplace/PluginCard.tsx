import { useTranslation } from "react-i18next";
import { Download, Star, Shield } from "lucide-react";
import type { RegistryPlugin } from "../../services/api/plugins";

interface PluginCardProps {
  plugin: RegistryPlugin;
  isInstalled?: boolean;
  onInstall?: () => void;
  onUninstall?: () => void;
  installing?: boolean;
}

const categoryLabels: Record<string, string> = {
  productivity: "效率工具",
  visualization: "可视化",
  ai: "AI 增强",
  study: "学习辅助",
};

const pluginNameLabels: Record<string, string> = {
  core: "核心服务",
  graph: "知识图谱",
  ai: "AI 服务",
  study: "学习系统",
  scheduler: "任务调度",
  agent: "智能代理",
  "markdown-exporter": "Markdown 导出器",
  "daily-digest": "每日知识摘要",
  "graph-themes": "图谱主题包",
};

export const PluginCard = ({ plugin, isInstalled, onInstall, onUninstall, installing }: PluginCardProps) => {
  const { t } = useTranslation();

  const getCategoryLabel = (category: string): string => {
    return categoryLabels[category] ?? category;
  };

  const getPluginLabel = (name: string): string => {
    return pluginNameLabels[name] ?? name;
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 transition-colors hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
          {getPluginLabel(plugin.name).charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
              {getPluginLabel(plugin.name)}
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">
              v{plugin.version}
            </span>
            {plugin.category && (
              <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                {getCategoryLabel(plugin.category)}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
            {plugin.description}
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-500" />
              {plugin.avgRating > 0 ? plugin.avgRating : "—"}
              {plugin.ratingCount > 0 && ` (${plugin.ratingCount})`}
            </span>
            <span className="flex items-center gap-1">
              <Download className="w-3 h-3" />
              {plugin.installCount}
            </span>
            <span>{plugin.author.name}</span>
            {plugin.permissions && plugin.permissions.length > 0 && (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <Shield className="w-3 h-3" />
                {plugin.permissions.length}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex justify-end mt-3">
        {isInstalled ? (
          <button
            onClick={onUninstall}
            className="px-3 py-1.5 text-sm rounded-md border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
          >
            {t("pluginMarketplace.uninstall")}
          </button>
        ) : (
          <button
            onClick={onInstall}
            disabled={installing}
            className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {installing ? t("pluginMarketplace.installing") : t("pluginMarketplace.install")}
          </button>
        )}
      </div>
    </div>
  );
};

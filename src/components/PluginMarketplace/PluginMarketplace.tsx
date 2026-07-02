import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  Store,
  Package,
  RefreshCw,
  ShieldCheck,
  Brain,
  Network,
  BookOpen,
  CalendarClock,
  Bot,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { pluginsApi } from "../../services/api/plugins";
import type { RegistryPlugin, InstalledPlugin } from "../../services/api/plugins";
import { PluginCard } from "./PluginCard";
import { useStore } from "../../store/useStore";
import { useDebouncedSearch } from "../../hooks/useDebouncedSearch";

type Tab = "browse" | "installed";

const BUILTIN_PLUGIN_NAMES = new Set(["core", "graph", "ai", "study", "scheduler", "agent"]);

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
};

const pluginDescriptionLabels: Record<string, string> = {
  core: "核心服务：认证、设置、健康检查、SSE 实时通信、事件总线",
  graph: "知识图谱服务：节点管理、边关系、知识点、自动图谱、协作者",
  ai: "AI 服务与路由插件，支持多模型提供商",
  study: "学习系统服务：学习进度、复习、题目生成、学习路径、测验集",
  scheduler: "任务调度插件：任务服务、执行器、专注模式、定时任务、事件订阅",
  agent: "智能代理插件：AI Agent 服务、工具注册与路由",
};

const pluginIcons: Record<string, LucideIcon> = {
  core: ShieldCheck,
  graph: Network,
  ai: Brain,
  study: BookOpen,
  scheduler: CalendarClock,
  agent: Bot,
};

const pluginIconColors: Record<string, string> = {
  core: "from-emerald-500 to-teal-600",
  graph: "from-primary-500 to-primary-600",
  ai: "from-primary-500 to-pink-600",
  study: "from-orange-500 to-amber-600",
  scheduler: "from-primary-500 to-primary-600",
  agent: "from-violet-500 to-primary-600",
};

export const PluginMarketplace = () => {
  const { t } = useTranslation();
  const { token } = useStore();
  const [activeTab, setActiveTab] = useState<Tab>("browse");
  const [registryPlugins, setRegistryPlugins] = useState<RegistryPlugin[]>([]);
  const [installedPlugins, setInstalledPlugins] = useState<InstalledPlugin[]>([]);
  const { query: searchQuery, setQuery: setSearchQuery, debouncedQuery: debouncedSearchQuery } = useDebouncedSearch();
  const [selectedCategory, setSelectedCategory] = useState("");
  const [installing, setInstalling] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadRegistry = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const plugins = await pluginsApi.listRegistry({
        category: selectedCategory || undefined,
        q: debouncedSearchQuery || undefined,
      });
      setRegistryPlugins(plugins);
    } catch (err) {
      console.error("Failed to load registry:", err);
    } finally {
      setLoading(false);
    }
  }, [token, selectedCategory, debouncedSearchQuery]);

  const loadInstalled = useCallback(async () => {
    if (!token) return;
    try {
      const plugins = await pluginsApi.listInstalled();
      setInstalledPlugins(plugins);
    } catch (err) {
      console.error("Failed to load installed plugins:", err);
    }
  }, [token]);

  useEffect(() => {
    loadRegistry();
  }, [loadRegistry]);

  useEffect(() => {
    if (activeTab === "installed") {
      loadInstalled();
    }
  }, [activeTab, loadInstalled]);

  const handleInstall = async (name: string) => {
    setInstalling(name);
    try {
      await pluginsApi.install(name);
      await loadInstalled();
      await loadRegistry();
    } catch (err) {
      console.error("Failed to install plugin:", err);
    } finally {
      setInstalling(null);
    }
  };

  const handleUninstall = async (name: string) => {
    try {
      await pluginsApi.uninstall(name);
      await loadInstalled();
      await loadRegistry();
    } catch (err) {
      console.error("Failed to uninstall plugin:", err);
    }
  };

  const handleActivate = async (name: string) => {
    try {
      await pluginsApi.activate(name);
      await loadInstalled();
    } catch (err) {
      console.error("Failed to activate plugin:", err);
    }
  };

  const handleDeactivate = async (name: string) => {
    try {
      await pluginsApi.deactivate(name);
      await loadInstalled();
    } catch (err) {
      console.error("Failed to deactivate plugin:", err);
    }
  };

  const isBuiltin = (name: string): boolean => BUILTIN_PLUGIN_NAMES.has(name);

  const installedNames = new Set(installedPlugins.map((p) => p.plugin_name));

  const categories = Array.from(new Set(registryPlugins.map((p) => p.category).filter((c): c is string => Boolean(c))));

  const getCategoryLabel = (category: string): string => categoryLabels[category] ?? category;

  const getPluginLabel = (name: string): string => pluginNameLabels[name] ?? name;

  const getPluginDescription = (name: string, originalDesc?: string): string =>
    pluginDescriptionLabels[name] ?? originalDesc ?? "";

  const getPluginIcon = (name: string): LucideIcon | null => pluginIcons[name] ?? null;

  const getPluginIconColor = (name: string): string => pluginIconColors[name] ?? "from-primary-500 to-primary-600";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveTab("browse")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "browse"
              ? "bg-primary-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-300 dark:hover:bg-slate-600"
          }`}
        >
          <Store className="w-4 h-4" />
          {t("pluginMarketplace.browse")}
        </button>
        <button
          onClick={() => setActiveTab("installed")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "installed"
              ? "bg-primary-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-300 dark:hover:bg-slate-600"
          }`}
        >
          <Package className="w-4 h-4" />
          {t("pluginMarketplace.installed")}
        </button>
      </div>

      {activeTab === "browse" && (
        <>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("pluginMarketplace.searchPlaceholder")}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">{t("pluginMarketplace.allCategories")}</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {getCategoryLabel(cat)}
                </option>
              ))}
            </select>
            <button
              onClick={loadRegistry}
              className="p-2 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 text-gray-500 dark:text-gray-400 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {loading && registryPlugins.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">{t("pluginMarketplace.loading")}</div>
          ) : registryPlugins.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">{t("pluginMarketplace.noPlugins")}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {registryPlugins.map((plugin) => (
                <PluginCard
                  key={plugin.name}
                  plugin={plugin}
                  isInstalled={installedNames.has(plugin.name)}
                  onInstall={() => handleInstall(plugin.name)}
                  onUninstall={() => handleUninstall(plugin.name)}
                  installing={installing === plugin.name}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "installed" && (
        <>
          {installedPlugins.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">{t("pluginMarketplace.noInstalledPlugins")}</div>
          ) : (
            <div className="space-y-3">
              {installedPlugins.map((plugin) => {
                const name = plugin.plugin_name ?? plugin.manifest?.name ?? "";
                const builtin = isBuiltin(name);
                const IconComponent = getPluginIcon(name);
                const iconColor = getPluginIconColor(name);

                return (
                  <div
                    key={plugin.plugin_name ?? plugin.manifest?.name ?? Math.random()}
                    className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${iconColor} flex items-center justify-center text-white shrink-0`}>
                          {IconComponent ? <IconComponent className="w-5 h-5" /> : <span className="font-bold text-base">{getPluginLabel(name).charAt(0)}</span>}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">
                              {getPluginLabel(name)}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">v{plugin.version ?? plugin.manifest?.version ?? "?"}</span>
                            {builtin && (
                              <span className="text-xs px-2 py-0.5 rounded bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                                系统
                              </span>
                            )}
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${
                                plugin.state === "active"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : plugin.state === "error"
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                  : "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-400"
                              }`}
                            >
                              {plugin.state === "active" ? t("pluginMarketplace.stateActive") : plugin.state === "error" ? t("pluginMarketplace.stateError") : t("pluginMarketplace.stateInactive")}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            {getPluginDescription(name, plugin.manifest?.description)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!builtin && (
                          <>
                            {plugin.state === "active" ? (
                              <button
                                onClick={() => handleDeactivate(name)}
                                className="px-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                              >
                                {t("pluginMarketplace.deactivate")}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleActivate(name)}
                                className="px-3 py-1.5 text-sm rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
                              >
                                {t("pluginMarketplace.activate")}
                              </button>
                            )}
                            <button
                              onClick={() => handleUninstall(name)}
                              className="px-3 py-1.5 text-sm rounded-md border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                            >
                              {t("pluginMarketplace.uninstall")}
                            </button>
                          </>
                        )}
                        {builtin && (
                          <span className="text-xs text-gray-400 dark:text-gray-500 italic px-2">
                            必需组件
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

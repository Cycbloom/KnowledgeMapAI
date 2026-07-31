import { useState, useEffect, useCallback, useId, useRef, type ReactNode, type KeyboardEvent as ReactKeyboardEvent } from "react";
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
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { pluginsApi, type RegistryPlugin, type InstalledPlugin } from "../../services/api/plugins";
import { PluginCard } from "./PluginCard";
import { useStore } from "../../store/useStore";
import { useDebouncedSearch } from "../../hooks/common/useDebouncedSearch";
import { message } from "@/utils/messageHelper";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

type Tab = "browse" | "installed";

const BUILTIN_PLUGIN_NAMES = new Set(["core", "graph", "ai", "study", "scheduler", "agent"]);

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

const PluginCardBoundary = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <ErrorBoundary
      fallbackRender={(error, resetErrorBoundary) => (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-red-200 dark:border-red-800 p-4">
          <div className="flex items-start gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-gray-100">{t("pluginMarketplace.marketplace.pluginLoadFailed")}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-words">
                {error.message}
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setDismissed(true)}
              className="px-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-slate-500 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              {t("pluginMarketplace.marketplace.continueBrowse")}
            </button>
            <button
              onClick={resetErrorBoundary}
              className="px-3 py-1.5 text-sm rounded-md bg-primary-600 text-white hover:bg-primary-700 transition-colors"
            >
              {t("pluginMarketplace.marketplace.retry")}
            </button>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
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

  const tablistId = useId();
  const tabIdPrefix = `${tablistId}-tab`;
  const panelIdPrefix = `${tablistId}-panel`;
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const pluginTabs: { id: Tab; label: string }[] = [
    { id: "browse", label: t("pluginMarketplace.browse") },
    { id: "installed", label: t("pluginMarketplace.installed") },
  ];

  const handleTabKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    switch (e.key) {
      case 'ArrowRight': {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % pluginTabs.length;
        setActiveTab(pluginTabs[nextIndex].id);
        tabRefs.current[nextIndex]?.focus();
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + pluginTabs.length) % pluginTabs.length;
        setActiveTab(pluginTabs[prevIndex].id);
        tabRefs.current[prevIndex]?.focus();
        break;
      }
      case 'Home': {
        e.preventDefault();
        setActiveTab(pluginTabs[0].id);
        tabRefs.current[0]?.focus();
        break;
      }
      case 'End': {
        e.preventDefault();
        const lastIndex = pluginTabs.length - 1;
        setActiveTab(pluginTabs[lastIndex].id);
        tabRefs.current[lastIndex]?.focus();
        break;
      }
      default:
        break;
    }
  };

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
      message.error(t("pluginMarketplace.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [token, selectedCategory, debouncedSearchQuery, t]);

  const loadInstalled = useCallback(async () => {
    if (!token) return;
    try {
      const plugins = await pluginsApi.listInstalled();
      setInstalledPlugins(plugins);
    } catch (err) {
      console.error("Failed to load installed plugins:", err);
      message.error(t("pluginMarketplace.loadFailed"));
    }
  }, [token, t]);

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
      message.error(t("pluginMarketplace.installFailed"));
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
      message.error(t("pluginMarketplace.uninstallFailed"));
    }
  };

  const handleActivate = async (name: string) => {
    try {
      await pluginsApi.activate(name);
      await loadInstalled();
    } catch (err) {
      console.error("Failed to activate plugin:", err);
      message.error(t("pluginMarketplace.activateFailed"));
    }
  };

  const handleDeactivate = async (name: string) => {
    try {
      await pluginsApi.deactivate(name);
      await loadInstalled();
    } catch (err) {
      console.error("Failed to deactivate plugin:", err);
      message.error(t("pluginMarketplace.deactivateFailed"));
    }
  };

  const isBuiltin = (name: string): boolean => BUILTIN_PLUGIN_NAMES.has(name);

  const installedNames = new Set(installedPlugins.map((p) => p.plugin_name));

  const categories = Array.from(new Set(registryPlugins.map((p) => p.category).filter((c): c is string => Boolean(c))));

  const getCategoryLabel = (category: string): string =>
    t(`pluginMarketplace.marketplace.categories.${category}` as const, { defaultValue: category });

  const getPluginLabel = (name: string): string =>
    t(`pluginMarketplace.marketplace.pluginNames.${name}` as const, { defaultValue: name });

  const getPluginDescription = (name: string, originalDesc?: string): string =>
    t(`pluginMarketplace.serviceDescriptions.${name}` as const, { defaultValue: originalDesc ?? "" });

  const getPluginIcon = (name: string): LucideIcon | null => pluginIcons[name] ?? null;

  const getPluginIconColor = (name: string): string => pluginIconColors[name] ?? "from-primary-500 to-primary-600";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2" role="tablist" aria-label={t("pluginMarketplace.title")}>
        {pluginTabs.map((tab, index) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => { tabRefs.current[index] = el; }}
              role="tab"
              id={`${tabIdPrefix}-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`${panelIdPrefix}-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => handleTabKeyDown(e, index)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-300 dark:hover:bg-slate-600"
              }`}
            >
              {tab.id === "browse" ? <Store className="w-4 h-4" /> : <Package className="w-4 h-4" />}
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "browse" && (
        <div
          role="tabpanel"
          id={`${panelIdPrefix}-browse`}
          aria-labelledby={`${tabIdPrefix}-browse`}
          tabIndex={0}
        >
          <div className="flex gap-2">
            <div
              role="search"
              aria-label={t('common.aria.searchWithTarget', { target: t('pluginMarketplace.title') })}
              className="relative flex-1"
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("pluginMarketplace.searchPlaceholder")}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-800 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-800 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
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
              className="p-2 rounded-lg border border-gray-200 dark:border-slate-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
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
                <PluginCardBoundary key={plugin.name}>
                  <PluginCard
                    plugin={plugin}
                    isInstalled={installedNames.has(plugin.name)}
                    onInstall={() => handleInstall(plugin.name)}
                    onUninstall={() => handleUninstall(plugin.name)}
                    installing={installing === plugin.name}
                  />
                </PluginCardBoundary>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "installed" && (
        <div
          role="tabpanel"
          id={`${panelIdPrefix}-installed`}
          aria-labelledby={`${tabIdPrefix}-installed`}
          tabIndex={0}
        >
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
                    className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-500 p-4 transition-colors"
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
                                {t("pluginMarketplace.marketplace.system")}
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
                                className="px-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-slate-500 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
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
                            {t("pluginMarketplace.marketplace.required")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

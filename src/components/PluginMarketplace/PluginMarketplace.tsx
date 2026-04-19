import { useState, useEffect, useCallback } from "react";
import { Search, Store, Package, RefreshCw } from "lucide-react";
import { pluginsApi } from "../../services/api/plugins";
import type { RegistryPlugin, InstalledPlugin } from "../../services/api/plugins";
import { PluginCard } from "./PluginCard";
import { useStore } from "../../store/useStore";

type Tab = "browse" | "installed";

export const PluginMarketplace = () => {
  const { token } = useStore();
  const [activeTab, setActiveTab] = useState<Tab>("browse");
  const [registryPlugins, setRegistryPlugins] = useState<RegistryPlugin[]>([]);
  const [installedPlugins, setInstalledPlugins] = useState<InstalledPlugin[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [installing, setInstalling] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadRegistry = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const plugins = await pluginsApi.listRegistry({
        category: selectedCategory || undefined,
        q: searchQuery || undefined,
      });
      setRegistryPlugins(plugins);
    } catch (err) {
      console.error("Failed to load registry:", err);
    } finally {
      setLoading(false);
    }
  }, [token, selectedCategory, searchQuery]);

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

  const installedNames = new Set(installedPlugins.map((p) => p.plugin_name));

  const categories = Array.from(new Set(registryPlugins.map((p) => p.category).filter(Boolean)));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveTab("browse")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "browse"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-300 dark:hover:bg-slate-600"
          }`}
        >
          <Store className="w-4 h-4" />
          浏览插件
        </button>
        <button
          onClick={() => setActiveTab("installed")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "installed"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-300 dark:hover:bg-slate-600"
          }`}
        >
          <Package className="w-4 h-4" />
          已安装
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
                placeholder="搜索插件..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">全部分类</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
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
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              加载中...
            </div>
          ) : registryPlugins.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              没有找到插件
            </div>
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
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              还没有安装任何插件，去浏览插件市场看看吧！
            </div>
          ) : (
            <div className="space-y-3">
              {installedPlugins.map((plugin) => (
                <div
                  key={plugin.plugin_name}
                  className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                        {plugin.plugin_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {plugin.plugin_name}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            v{plugin.version}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              plugin.state === "active"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : plugin.state === "error"
                                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                : "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-400"
                            }`}
                          >
                            {plugin.state === "active" ? "已启用" : plugin.state === "error" ? "错误" : "已停用"}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                          {plugin.manifest?.description ?? ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {plugin.state === "active" ? (
                        <button
                          onClick={() => handleDeactivate(plugin.plugin_name)}
                          className="px-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                        >
                          停用
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivate(plugin.plugin_name)}
                          className="px-3 py-1.5 text-sm rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
                        >
                          启用
                        </button>
                      )}
                      <button
                        onClick={() => handleUninstall(plugin.plugin_name)}
                        className="px-3 py-1.5 text-sm rounded-md border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                      >
                        卸载
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export interface RegistryPlugin {
  name: string;
  version: string;
  description: string;
  author: { name: string; email?: string };
  main: string;
  dependencies?: string[];
  permissions?: string[];
  icon?: string;
  screenshots?: string[];
  homepage?: string;
  repository?: string;
  keywords?: string[];
  category?: string;
  installCount: number;
  avgRating: number;
  ratingCount: number;
}

export interface InstalledPlugin {
  plugin_name: string;
  version: string;
  state: string;
  manifest: RegistryPlugin;
}

export interface PluginUpdate {
  name: string;
  currentVersion: string;
  latestVersion: string;
}

export interface IPluginsApi {
  listRegistry(options?: {
    category?: string;
    q?: string;
  }): Promise<RegistryPlugin[]>;

  getRegistryPlugin(name: string): Promise<RegistryPlugin>;

  install(name: string): Promise<void>;

  uninstall(name: string): Promise<void>;

  update(name: string): Promise<void>;

  activate(name: string): Promise<void>;

  deactivate(name: string): Promise<void>;

  listInstalled(): Promise<InstalledPlugin[]>;

  checkUpdates(): Promise<PluginUpdate[]>;

  rate(name: string, rating: number, review?: string): Promise<void>;
}

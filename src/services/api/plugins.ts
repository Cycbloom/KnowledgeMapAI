import { request } from './client';

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

export const pluginsApi = {
  listRegistry: async (options?: { category?: string; q?: string }): Promise<RegistryPlugin[]> => {
    const params = new URLSearchParams();
    if (options?.category) params.set('category', options.category);
    if (options?.q) params.set('q', options.q);
    const query = params.toString();
    const url = `/plugins/registry${query ? `?${query}` : ''}`;
    const res = await request<{ success: boolean; data: RegistryPlugin[] }>(url);
    return res.data;
  },

  getRegistryPlugin: async (name: string): Promise<RegistryPlugin> => {
    const res = await request<{ success: boolean; data: RegistryPlugin }>(`/plugins/registry/${name}`);
    return res.data;
  },

  install: async (name: string): Promise<void> => {
    await request<{ success: boolean }>(`/plugins/registry/${name}/install`, { method: 'POST' });
  },

  uninstall: async (name: string): Promise<void> => {
    await request<{ success: boolean }>(`/plugins/registry/${name}/uninstall`, { method: 'POST' });
  },

  update: async (name: string): Promise<void> => {
    await request<{ success: boolean }>(`/plugins/registry/${name}/update`, { method: 'POST' });
  },

  activate: async (name: string): Promise<void> => {
    await request<{ success: boolean }>(`/plugins/${name}/activate`, { method: 'POST' });
  },

  deactivate: async (name: string): Promise<void> => {
    await request<{ success: boolean }>(`/plugins/${name}/deactivate`, { method: 'POST' });
  },

  listInstalled: async (): Promise<InstalledPlugin[]> => {
    const res = await request<{ success: boolean; data: InstalledPlugin[] }>('/plugins');
    return res.data;
  },

  checkUpdates: async (): Promise<PluginUpdate[]> => {
    const res = await request<{ success: boolean; data: PluginUpdate[] }>('/plugins/updates');
    return res.data;
  },

  rate: async (name: string, rating: number, review?: string): Promise<void> => {
    await request<{ success: boolean }>(`/plugins/registry/${name}/rate`, {
      method: 'POST',
      body: JSON.stringify({ rating, review }),
    });
  },
};

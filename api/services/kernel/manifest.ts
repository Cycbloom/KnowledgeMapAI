import { z } from "zod";

export const pluginAuthorSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
});

export const pluginManifestSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/, "Plugin name must be kebab-case"),
  version: z.string().regex(/^\d+\.\d+\.\d+/, "Version must be semver"),
  description: z.string().min(1),
  author: pluginAuthorSchema,
  main: z.string().min(1),
  dependencies: z.array(z.string()).optional(),
  permissions: z.array(z.string()).optional(),
  icon: z.string().optional(),
  screenshots: z.array(z.string()).optional(),
  homepage: z.string().url().optional(),
  repository: z.string().url().optional(),
  keywords: z.array(z.string()).optional(),
  category: z.string().optional(),
});

export type PluginManifestInput = z.input<typeof pluginManifestSchema>;
export type PluginManifestOutput = z.output<typeof pluginManifestSchema>;

export const BUILTIN_PLUGIN_NAMES = ["core", "graph", "ai", "study", "scheduler", "agent"] as const;

export function validateManifest(manifest: unknown): { success: boolean; data?: PluginManifestOutput; errors?: string[] } {
  const result = pluginManifestSchema.safeParse(manifest);
  if (!result.success) {
    return { success: false, errors: result.error.errors.map(e => `${e.path.join(".")}: ${e.message}`) };
  }
  if (BUILTIN_PLUGIN_NAMES.includes(result.data.name as typeof BUILTIN_PLUGIN_NAMES[number])) {
    return { success: false, errors: [`Plugin name "${result.data.name}" conflicts with built-in plugin`] };
  }
  return { success: true, data: result.data };
}

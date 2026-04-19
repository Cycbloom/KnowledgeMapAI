import type { Plugin, KernelAPI } from "../../api/services/kernel/types";

const graphThemesPlugin: Plugin = {
  name: "graph-themes",
  version: "1.0.0",
  description: "Customize your knowledge graph appearance with beautiful themes.",
  author: { name: "KnowledgeMap Team", email: "team@knowledgemap.dev" },
  permissions: ["graph:read", "storage:write"],
  keywords: ["theme", "visual", "dark-mode", "customization"],
  category: "visualization",

  onInstall(kernel: KernelAPI): void {
    kernel.registerExtension("graphTheme", {
      name: "dark-mode",
      styles: { primaryColor: "#6366f1", bgColor: "#0f172a", textColor: "#e2e8f0" },
    });
    kernel.registerExtension("graphTheme", {
      name: "neon-glow",
      styles: { primaryColor: "#22d3ee", bgColor: "#0c0a1d", textColor: "#a5f3fc" },
    });
    kernel.registerExtension("graphTheme", {
      name: "nature",
      styles: { primaryColor: "#22c55e", bgColor: "#f0fdf4", textColor: "#166534" },
    });
  },
};

export default graphThemesPlugin;

import type { Plugin, KernelAPI } from "../../api/services/kernel/types";

const markdownExporterPlugin: Plugin = {
  name: "markdown-exporter",
  version: "1.0.0",
  description: "Export knowledge graphs to Markdown files with customizable templates.",
  author: { name: "KnowledgeMap Team", email: "team@knowledgemap.dev" },
  permissions: ["graph:read", "storage:write"],
  keywords: ["export", "markdown", "documentation"],
  category: "productivity",

  onInstall(kernel: KernelAPI): void {
    kernel.registerService("markdownExporterService", {
      exportGraph: async (graphId: string) => {
        const graphService = kernel.getService<{ getGraph: (id: string) => Promise<unknown> }>("graphService");
        if (!graphService) return null;
        const graph = await graphService.getGraph(graphId);
        return graph;
      },
    });
  },
};

export default markdownExporterPlugin;

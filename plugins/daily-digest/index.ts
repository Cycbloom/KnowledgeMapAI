import type { Plugin, KernelAPI } from "../../api/services/kernel/types";

const dailyDigestPlugin: Plugin = {
  name: "daily-digest",
  version: "1.1.0",
  description: "Generate daily knowledge digests based on your learning progress.",
  author: { name: "KnowledgeMap Team", email: "team@knowledgemap.dev" },
  dependencies: ["study"],
  permissions: ["study:read", "scheduler:read", "ai:write"],
  keywords: ["digest", "summary", "daily", "review"],
  category: "productivity",

  onInstall(kernel: KernelAPI): void {
    kernel.registerService("dailyDigestService", {
      generateDigest: async () => {
        return { message: "Daily digest generated" };
      },
    });
  },
};

export default dailyDigestPlugin;

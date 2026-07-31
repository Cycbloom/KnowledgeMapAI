import type { Plugin, KernelAPI } from "../kernel/types";
import aiRoutes from "../../routes/ai";
import aiActionRoutes from "../../routes/aiActions";
import promptRoutes from "../../routes/prompts";
import ragRoutes from "../../routes/rag";
import searchRoutes from "../../routes/search";
import literatureRoutes from "../../routes/knowledge/literature";

export const AIPlugin: Plugin = {
  name: "ai",
  version: "1.0.0",
  description: "AI services and routes plugin",
  dependencies: ["core"],

  onInstall(kernel: KernelAPI): void {
    kernel.registerRoutes("/api/v1/ai", aiRoutes, { rateLimiter: "ai" });
    kernel.registerRoutes("/api/v1/ai-actions", aiActionRoutes, { rateLimiter: "ai" });
    kernel.registerRoutes("/api/v1/prompts", promptRoutes, { rateLimiter: "ai" });
    kernel.registerRoutes("/api/v1/rag", ragRoutes);
    kernel.registerRoutes("/api/v1/search", searchRoutes);
    kernel.registerRoutes("/api/v1/literature", literatureRoutes, { rateLimiter: "aiHeavy" });
  },
};

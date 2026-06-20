import type { Plugin, KernelAPI } from "../kernel/types";
import aiRoutes from "../../routes/ai";
import aiActionRoutes from "../../routes/aiActions";
import promptRoutes from "../../routes/prompts";
import ragRoutes from "../../routes/rag";
import searchRoutes from "../../routes/search";
import literatureRoutes from "../../routes/literature";

export const AIPlugin: Plugin = {
  name: "ai",
  version: "1.0.0",
  description: "AI services and routes plugin",
  dependencies: ["core"],

  onInstall(kernel: KernelAPI): void {
    kernel.registerRoutes("/api/ai", aiRoutes, { rateLimiter: "ai" });
    kernel.registerRoutes("/api/ai-actions", aiActionRoutes, { rateLimiter: "ai" });
    kernel.registerRoutes("/api/prompts", promptRoutes, { rateLimiter: "ai" });
    kernel.registerRoutes("/api/rag", ragRoutes);
    kernel.registerRoutes("/api/search", searchRoutes);
    kernel.registerRoutes("/api/literature", literatureRoutes, { rateLimiter: "aiHeavy" });
  },
};

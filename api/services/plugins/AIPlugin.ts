import type { KernelAPI } from "../kernel/types";
import {
  aiService,
  aiActionService,
  promptService,
  embeddingService,
  ragService,
  searchService,
  domainContextService,
  templateGeneratorService,
} from "../ai/";
import { performanceMonitor } from "../ai/performanceMonitor";
import { pricingService } from "../ai/pricingService";
import { DeepseekProvider } from "../ai/providers/deepseek";
import { VolcengineProvider } from "../ai/providers/volcengine";
import { AliyunProvider } from "../ai/providers/aliyun";
import aiRoutes from "../../routes/ai";
import aiActionRoutes from "../../routes/aiActions";
import promptRoutes from "../../routes/prompts";
import ragRoutes from "../../routes/rag";
import searchRoutes from "../../routes/search";

export const AIPlugin = {
  name: "ai",
  version: "1.0.0",
  description: "AI services and routes plugin",
  dependencies: ["core"],

  onInstall(kernel: KernelAPI): void {
    kernel.registerService("aiService", aiService);
    kernel.registerService("aiActionService", aiActionService);
    kernel.registerService("promptService", promptService);
    kernel.registerService("embeddingService", embeddingService);
    kernel.registerService("ragService", ragService);
    kernel.registerService("searchService", searchService);
    kernel.registerService("domainContextService", domainContextService);
    kernel.registerService("templateGeneratorService", templateGeneratorService);
    kernel.registerService("performanceMonitor", performanceMonitor);
    kernel.registerService("pricingService", pricingService);

    kernel.registerRoutes("/ai", aiRoutes, { rateLimiter: "ai" });
    kernel.registerRoutes("/ai/actions", aiActionRoutes, { rateLimiter: "ai" });
    kernel.registerRoutes("/prompts", promptRoutes, { rateLimiter: "ai" });
    kernel.registerRoutes("/rag", ragRoutes);
    kernel.registerRoutes("/search", searchRoutes);

    kernel.registerExtension("aiProvider", { type: "deepseek", provider: DeepseekProvider });
    kernel.registerExtension("aiProvider", { type: "volcengine", provider: VolcengineProvider });
    kernel.registerExtension("aiProvider", { type: "aliyun", provider: AliyunProvider });
  },
};

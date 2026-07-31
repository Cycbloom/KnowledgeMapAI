import type { Plugin, KernelAPI } from "../kernel/types";
import agentRoutes from "../../routes/agent";

export const AgentPlugin: Plugin = {
  name: "agent",
  version: "1.0.0",
  description: "Agent plugin wrapping AI agent services, tools, and routes",
  dependencies: ["graph", "ai"],

  onInstall(kernel: KernelAPI): void {
    kernel.registerRoutes("/api/v1/agent", agentRoutes);
  },
};

import type { Plugin, KernelAPI } from "../kernel/types";
import { AgentService } from "../agent/AgentService";
import { ToolRegistry } from "../agent/ToolRegistry";
import { SessionManager } from "../agent/SessionManager";
import { graphTools } from "../agent/tools/graphTools";
import { analysisTools } from "../agent/tools/analysisTools";
import { learningTools } from "../agent/tools/learningTools";
import { nodeTools } from "../agent/tools/nodeTools";
import agentRoutes from "../../routes/agent";

const toolRegistry = new ToolRegistry();
const sessionManager = SessionManager.getInstance();

const allAgentTools = [...graphTools, ...analysisTools, ...learningTools, ...nodeTools];

export const AgentPlugin: Plugin = {
  name: "agent",
  version: "1.0.0",
  description: "Agent plugin wrapping AI agent services, tools, and routes",
  dependencies: ["graph", "ai"],

  onInstall(kernel: KernelAPI): void {
    kernel.registerService("agentService", AgentService);
    kernel.registerService("toolRegistry", toolRegistry);
    kernel.registerService("sessionManager", sessionManager);

    kernel.registerRoutes("/api/agent", agentRoutes);

    for (const tool of allAgentTools) {
      kernel.registerExtension("agentTool", {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        execute: tool.execute,
      });
    }
  },
};

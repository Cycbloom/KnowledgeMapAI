import type { Plugin, KernelAPI } from "../kernel/types";
import graphsRoutes from "../../routes/graphs";
import nodesRoutes from "../../routes/nodes";
import graphRelationsRoutes from "../../routes/graphRelations";
import domainsRoutes from "../../routes/domains";
import knowledgePointsRoutes from "../../routes/knowledgePoints";
import autoGraphRoutes from "../../routes/autoGraph";
import relationshipTypesRoutes from "../../routes/relationshipTypes";
import collaboratorsRoutes from "../../routes/collaborators";
import graphNodesRoutes from "../../routes/graphNodes";
import combinedViewRoutes from "../../routes/combinedView";
import conceptAggregationRoutes from "../../routes/conceptAggregation";
import regionRoutes from "../../routes/regions";
import { storyRoutes } from "../../routes/story";

export const graphPlugin: Plugin = {
  name: "graph",
  version: "1.0.0",
  description: "Graph services: nodes, edges, relations, knowledge points, auto-graph, collaborators",
  dependencies: ["core"],

  onInstall(kernel: KernelAPI): void {
    kernel.registerRoutes("/api/graphs", graphsRoutes);
    kernel.registerRoutes("/api", nodesRoutes);
    kernel.registerRoutes("/api/graphs", graphRelationsRoutes);
    kernel.registerRoutes("/api/domains", domainsRoutes);
    kernel.registerRoutes("/api/knowledge-points", knowledgePointsRoutes);
    kernel.registerRoutes("/api/auto-graph", autoGraphRoutes, { rateLimiter: "aiHeavy" });
    kernel.registerRoutes("/api/relationship-types", relationshipTypesRoutes);
    kernel.registerRoutes("/api/collaborations", collaboratorsRoutes);
    kernel.registerRoutes("/api/graph-nodes", graphNodesRoutes);
    kernel.registerRoutes("/api/combined-view", combinedViewRoutes);
    kernel.registerRoutes("/api/graphs", conceptAggregationRoutes);
    kernel.registerRoutes("/api/graphs/:graphId/regions", regionRoutes);
    kernel.registerRoutes("/api/story/:graphId", storyRoutes);
  },
};

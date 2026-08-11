import type { Plugin, KernelAPI } from "../kernel/types";
import graphsRoutes from "../../routes/graphs";
import nodesRoutes from "../../routes/nodes";
import graphRelationsRoutes from "../../routes/graphRelations";
import domainsRoutes from "../../routes/domains";
import knowledgePointsRoutes from "../../routes/knowledge/knowledgePoints";
import autoGraphRoutes from "../../routes/autoGraph";
import relationshipTypesRoutes from "../../routes/relationshipTypes";
import collaboratorsRoutes from "../../routes/collaborators";
import graphNodesRoutes from "../../routes/graphNodes";
import combinedViewRoutes from "../../routes/combinedView";
import conceptAggregationRoutes from "../../routes/conceptAggregation";
import regionRoutes from "../../routes/regions";
import backlinksRoutes from "../../routes/knowledge/backlinks";
import { storyRoutes } from "../../routes/story";

export const graphPlugin: Plugin = {
  name: "graph",
  version: "1.0.0",
  description: "Graph services: nodes, edges, relations, knowledge points, auto-graph, collaborators",
  dependencies: ["core"],

  onInstall(kernel: KernelAPI): void {
    kernel.registerRoutes("/api/v1/graphs", graphsRoutes);
    kernel.registerRoutes("/api/v1", nodesRoutes);
    kernel.registerRoutes("/api/v1/graphs", graphRelationsRoutes);
    kernel.registerRoutes("/api/v1/domains", domainsRoutes);
    kernel.registerRoutes("/api/v1/knowledge-points", knowledgePointsRoutes);
    kernel.registerRoutes("/api/v1/auto-graph", autoGraphRoutes, { rateLimiter: "aiHeavy" });
    kernel.registerRoutes("/api/v1/relationship-types", relationshipTypesRoutes);
    kernel.registerRoutes("/api/v1/collaborations", collaboratorsRoutes);
    kernel.registerRoutes("/api/v1", graphNodesRoutes);
    kernel.registerRoutes("/api/v1/combined-view", combinedViewRoutes);
    kernel.registerRoutes("/api/v1/graphs", conceptAggregationRoutes);
    kernel.registerRoutes("/api/v1/graphs/:graphId/regions", regionRoutes);
    kernel.registerRoutes("/api/v1/backlinks", backlinksRoutes);
    kernel.registerRoutes("/api/v1/story/:graphId", storyRoutes);
  },
};

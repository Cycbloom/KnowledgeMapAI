import type { Plugin, KernelAPI } from "../kernel/types";
import { graphService } from "../graph/graphService";
import { graphNodeService } from "../graph/graphNodeService";
import { graphRelationService } from "../graph/graphRelationService";
import { graphTemplateService } from "../graph/graphTemplateService";
import { edgeService } from "../graph/edgeService";
import { knowledgePointService } from "../graph/knowledgePointService";
import { knowledgePointVersionService } from "../graph/knowledgePointVersionService";
import { relationshipTypeService } from "../graph/relationshipTypeService";
import { autoGraphService } from "../graph/autoGraphService";
import { relationDiscoveryService } from "../graph/relationDiscoveryService";
import { collaboratorService } from "../graph/collaboratorService";
import graphsRoutes from "../../routes/graphs";
import nodesRoutes from "../../routes/nodes";
import graphRelationsRoutes from "../../routes/graphRelations";
import domainsRoutes from "../../routes/domains";
import knowledgePointsRoutes from "../../routes/knowledgePoints";
import autoGraphRoutes from "../../routes/autoGraph";
import relationshipTypesRoutes from "../../routes/relationshipTypes";
import collaboratorsRoutes from "../../routes/collaborators";

export const graphPlugin: Plugin = {
  name: "graph",
  version: "1.0.0",
  description: "Graph services: nodes, edges, relations, knowledge points, auto-graph, collaborators",
  dependencies: ["core"],

  onInstall(kernel: KernelAPI): void {
    kernel.registerService("graphService", graphService);
    kernel.registerService("graphNodeService", graphNodeService);
    kernel.registerService("graphRelationService", graphRelationService);
    kernel.registerService("graphTemplateService", graphTemplateService);
    kernel.registerService("edgeService", edgeService);
    kernel.registerService("knowledgePointService", knowledgePointService);
    kernel.registerService("knowledgePointVersionService", knowledgePointVersionService);
    kernel.registerService("relationshipTypeService", relationshipTypeService);
    kernel.registerService("autoGraphService", autoGraphService);
    kernel.registerService("relationDiscoveryService", relationDiscoveryService);
    kernel.registerService("collaboratorService", collaboratorService);

    kernel.registerRoutes("/api/graphs", graphsRoutes);
    kernel.registerRoutes("/api/nodes", nodesRoutes);
    kernel.registerRoutes("/api/graph-relations", graphRelationsRoutes);
    kernel.registerRoutes("/api/domains", domainsRoutes);
    kernel.registerRoutes("/api/knowledge-points", knowledgePointsRoutes);
    kernel.registerRoutes("/api/auto-graph", autoGraphRoutes, { rateLimiter: "aiHeavy" });
    kernel.registerRoutes("/api/relationship-types", relationshipTypesRoutes);
    kernel.registerRoutes("/api/collaborators", collaboratorsRoutes);
  },
};

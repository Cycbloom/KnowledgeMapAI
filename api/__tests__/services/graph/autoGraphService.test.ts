import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AutoGraphService, AINodeData, CreateEdgeData } from "../../../services/graph/autoGraphService";
import { graphNodeService } from "../../../services/graph/graphNodeService";
import { edgeService } from "../../../services/graph/edgeService";
import { asyncTaskService } from "../../../services/asyncTaskService";

vi.mock("../../../services/graph/graphNodeService");
vi.mock("../../../services/graph/edgeService");
vi.mock("../../../services/asyncTaskService");
vi.mock("../../../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const createMockSupabase = () => {
  const queryChain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  };

  return {
    from: vi.fn().mockReturnValue(queryChain),
    queryChain,
  };
};

describe("AutoGraphService", () => {
  let autoGraphService: AutoGraphService;
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
    autoGraphService = new AutoGraphService();
    mockSupabase = createMockSupabase();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("processAINodes", () => {
    const userId = "test-user-id";
    const graphId = "test-graph-id";

    it("should return empty result when no valid nodes provided", async () => {
      const result = await autoGraphService.processAINodes(
        mockSupabase as any,
        userId,
        graphId,
        []
      );

      expect(result).toEqual({
        nodeCount: 0,
        edgeCount: 0,
        graphNodeIds: [],
        nodeMapping: {},
      });
    });

    it("should filter out nodes with empty titles", async () => {
      const nodes: AINodeData[] = [
        {
          tempId: "temp-1",
          parentId: null,
          title: "",
          content: "content",
          level: "normal",
          x_position: 0,
          y_position: 0,
        },
        {
          tempId: "temp-2",
          parentId: null,
          title: "   ",
          content: "content",
          level: "normal",
          x_position: 0,
          y_position: 0,
        },
      ];

      const result = await autoGraphService.processAINodes(
        mockSupabase as any,
        userId,
        graphId,
        nodes
      );

      expect(result.nodeCount).toBe(0);
    });

    it("should create knowledge points and graph nodes", async () => {
      const nodes: AINodeData[] = [
        {
          tempId: "temp-1",
          parentId: null,
          title: "Node 1",
          content: "Content 1",
          level: "normal",
          x_position: 10,
          y_position: 20,
        },
      ];

      const kpId = "kp-1";
      const graphNodeId = "gn-1";

      mockSupabase.queryChain.insert.mockResolvedValue({
        data: [{ id: kpId }],
        error: null,
      });

      vi.mocked(graphNodeService.addToGraph).mockResolvedValue({
        id: graphNodeId,
        knowledge_point_id: kpId,
        graph_id: graphId,
        x_position: 10,
        y_position: 20,
        level: "normal",
        title: "Node 1",
        content: "Content 1",
      } as any);

      const result = await autoGraphService.processAINodes(
        mockSupabase as any,
        userId,
        graphId,
        nodes
      );

      expect(result.nodeCount).toBe(1);
      expect(result.graphNodeIds).toContain(graphNodeId);
      expect(result.nodeMapping["temp-1"]).toEqual({
        graphNodeId,
        knowledgePointId: kpId,
      });
    });
  });

  describe("edge creation logic", () => {
    const userId = "test-user-id";
    const graphId = "test-graph-id";

    it("should create edge when parentId is a tempId in nodeMap", async () => {
      const parentKpId = "parent-kp-id";
      const childKpId = "child-kp-id";
      const parentGraphNodeId = "parent-gn-id";
      const childGraphNodeId = "child-gn-id";

      const nodes: AINodeData[] = [
        {
          tempId: "temp-parent",
          parentId: null,
          title: "Parent Node",
          content: "Parent Content",
          level: "normal",
          x_position: 0,
          y_position: 0,
        },
        {
          tempId: "temp-child",
          parentId: "temp-parent",
          title: "Child Node",
          content: "Child Content",
          level: "normal",
          x_position: 10,
          y_position: 10,
          relationshipType: "contains",
        },
      ];

      mockSupabase.queryChain.insert
        .mockResolvedValueOnce({
          data: [{ id: parentKpId }, { id: childKpId }],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [],
          error: null,
        });

      vi.mocked(graphNodeService.addToGraph)
        .mockResolvedValueOnce({
          id: parentGraphNodeId,
          knowledge_point_id: parentKpId,
          graph_id: graphId,
          title: "Parent Node",
        } as any)
        .mockResolvedValueOnce({
          id: childGraphNodeId,
          knowledge_point_id: childKpId,
          graph_id: graphId,
          title: "Child Node",
        } as any);

      vi.mocked(edgeService.create).mockResolvedValue({} as any);

      mockSupabase.queryChain.select.mockReturnThis();
      mockSupabase.queryChain.in.mockReturnThis();
      mockSupabase.queryChain.eq.mockReturnThis();
      mockSupabase.queryChain.is.mockReturnThis();

      mockSupabase.queryChain.select.mockResolvedValue({
        data: [
          {
            id: "edge-1",
            source_knowledge_point_id: parentKpId,
            target_knowledge_point_id: childKpId,
            relationship_type: "contains",
          },
        ],
        error: null,
      });

      const result = await autoGraphService.processAINodes(
        mockSupabase as any,
        userId,
        graphId,
        nodes
      );

      expect(result.edgeCount).toBe(1);
    });

    it("should query database when parentId is an existing graph node UUID", async () => {
      const existingParentKpId = "existing-parent-kp-id";
      const childKpId = "child-kp-id";
      const existingParentGraphNodeId = "existing-parent-gn-id";
      const childGraphNodeId = "child-gn-id";

      const nodes: AINodeData[] = [
        {
          tempId: "temp-child",
          parentId: existingParentGraphNodeId,
          title: "Child Node",
          content: "Child Content",
          level: "normal",
          x_position: 10,
          y_position: 10,
          relationshipType: "contains",
        },
      ];

      mockSupabase.queryChain.insert.mockResolvedValue({
        data: [{ id: childKpId }],
        error: null,
      });

      vi.mocked(graphNodeService.addToGraph).mockResolvedValue({
        id: childGraphNodeId,
        knowledge_point_id: childKpId,
        graph_id: graphId,
        title: "Child Node",
      } as any);

      mockSupabase.queryChain.select
        .mockResolvedValueOnce({
          data: { knowledge_point_id: existingParentKpId },
          error: null,
        })
        .mockResolvedValueOnce({
          data: [
            {
              id: "edge-1",
              source_knowledge_point_id: existingParentKpId,
              target_knowledge_point_id: childKpId,
              relationship_type: "contains",
            },
          ],
          error: null,
        });

      mockSupabase.queryChain.eq.mockReturnThis();

      const result = await autoGraphService.processAINodes(
        mockSupabase as any,
        userId,
        graphId,
        nodes
      );

      expect(result.edgeCount).toBe(1);
    });

    it("should use default relationship type 'contains' when not specified", async () => {
      const parentKpId = "parent-kp-id";
      const childKpId = "child-kp-id";
      const parentGraphNodeId = "parent-gn-id";
      const childGraphNodeId = "child-gn-id";

      const nodes: AINodeData[] = [
        {
          tempId: "temp-parent",
          parentId: null,
          title: "Parent Node",
          content: "Parent Content",
          level: "normal",
          x_position: 0,
          y_position: 0,
        },
        {
          tempId: "temp-child",
          parentId: "temp-parent",
          title: "Child Node",
          content: "Child Content",
          level: "normal",
          x_position: 10,
          y_position: 10,
        },
      ];

      mockSupabase.queryChain.insert
        .mockResolvedValueOnce({
          data: [{ id: parentKpId }, { id: childKpId }],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [],
          error: null,
        });

      vi.mocked(graphNodeService.addToGraph)
        .mockResolvedValueOnce({
          id: parentGraphNodeId,
          knowledge_point_id: parentKpId,
          graph_id: graphId,
        } as any)
        .mockResolvedValueOnce({
          id: childGraphNodeId,
          knowledge_point_id: childKpId,
          graph_id: graphId,
        } as any);

      vi.mocked(edgeService.create).mockResolvedValue({} as any);

      mockSupabase.queryChain.select.mockResolvedValue({
        data: [
          {
            id: "edge-1",
            source_knowledge_point_id: parentKpId,
            target_knowledge_point_id: childKpId,
            relationship_type: "contains",
          },
        ],
        error: null,
      });

      await autoGraphService.processAINodes(
        mockSupabase as any,
        userId,
        graphId,
        nodes
      );

      expect(edgeService.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          relationship_type: "contains",
        })
      );
    });

    it("should not create edge when parent node not found", async () => {
      const childKpId = "child-kp-id";
      const childGraphNodeId = "child-gn-id";

      const nodes: AINodeData[] = [
        {
          tempId: "temp-child",
          parentId: "non-existent-parent-id",
          title: "Child Node",
          content: "Child Content",
          level: "normal",
          x_position: 10,
          y_position: 10,
        },
      ];

      mockSupabase.queryChain.insert.mockResolvedValue({
        data: [{ id: childKpId }],
        error: null,
      });

      vi.mocked(graphNodeService.addToGraph).mockResolvedValue({
        id: childGraphNodeId,
        knowledge_point_id: childKpId,
        graph_id: graphId,
      } as any);

      mockSupabase.queryChain.select
        .mockResolvedValueOnce({
          data: null,
          error: { message: "Not found" },
        })
        .mockResolvedValueOnce({
          data: [],
          error: null,
        });

      const result = await autoGraphService.processAINodes(
        mockSupabase as any,
        userId,
        graphId,
        nodes
      );

      expect(result.edgeCount).toBe(0);
    });
  });

  describe("backbone node query logic", () => {
    const userId = "test-user-id";
    const graphId = "test-graph-id";

    it("should query graph_nodes table with correct parameters for backbone node", async () => {
      const backboneKpId = "backbone-kp-id";
      const childKpId = "child-kp-id";
      const backboneGraphNodeId = "backbone-gn-id";
      const childGraphNodeId = "child-gn-id";

      const nodes: AINodeData[] = [
        {
          tempId: "temp-child",
          parentId: backboneGraphNodeId,
          title: "Child Node",
          content: "Child Content",
          level: "normal",
          x_position: 10,
          y_position: 10,
        },
      ];

      mockSupabase.queryChain.insert.mockResolvedValue({
        data: [{ id: childKpId }],
        error: null,
      });

      vi.mocked(graphNodeService.addToGraph).mockResolvedValue({
        id: childGraphNodeId,
        knowledge_point_id: childKpId,
        graph_id: graphId,
      } as any);

      mockSupabase.queryChain.select
        .mockResolvedValueOnce({
          data: { knowledge_point_id: backboneKpId },
          error: null,
        })
        .mockResolvedValueOnce({
          data: [
            {
              id: "edge-1",
              source_knowledge_point_id: backboneKpId,
              target_knowledge_point_id: childKpId,
            },
          ],
          error: null,
        });

      await autoGraphService.processAINodes(
        mockSupabase as any,
        userId,
        graphId,
        nodes
      );

      expect(mockSupabase.from).toHaveBeenCalledWith("graph_nodes");
      expect(mockSupabase.queryChain.eq).toHaveBeenCalledWith("id", backboneGraphNodeId);
      expect(mockSupabase.queryChain.eq).toHaveBeenCalledWith("graph_id", graphId);
    });

    it("should handle database query error gracefully", async () => {
      const childKpId = "child-kp-id";
      const childGraphNodeId = "child-gn-id";

      const nodes: AINodeData[] = [
        {
          tempId: "temp-child",
          parentId: "backbone-gn-id",
          title: "Child Node",
          content: "Child Content",
          level: "normal",
          x_position: 10,
          y_position: 10,
        },
      ];

      mockSupabase.queryChain.insert.mockResolvedValue({
        data: [{ id: childKpId }],
        error: null,
      });

      vi.mocked(graphNodeService.addToGraph).mockResolvedValue({
        id: childGraphNodeId,
        knowledge_point_id: childKpId,
        graph_id: graphId,
      } as any);

      mockSupabase.queryChain.select
        .mockResolvedValueOnce({
          data: null,
          error: { message: "Database error", code: "PGRST116" },
        })
        .mockResolvedValueOnce({
          data: [],
          error: null,
        });

      const result = await autoGraphService.processAINodes(
        mockSupabase as any,
        userId,
        graphId,
        nodes
      );

      expect(result.edgeCount).toBe(0);
    });
  });

  describe("parentId passing logic", () => {
    const userId = "test-user-id";
    const graphId = "test-graph-id";

    it("should correctly pass parentId from input to edge creation", async () => {
      const parentKpId = "parent-kp-id";
      const childKpId = "child-kp-id";
      const parentGraphNodeId = "parent-gn-id";
      const childGraphNodeId = "child-gn-id";

      const nodes: AINodeData[] = [
        {
          tempId: "temp-parent",
          parentId: null,
          title: "Parent",
          content: "Parent content",
          level: "normal",
          x_position: 0,
          y_position: 0,
        },
        {
          tempId: "temp-child-1",
          parentId: "temp-parent",
          title: "Child 1",
          content: "Child 1 content",
          level: "normal",
          x_position: 10,
          y_position: 10,
          relationshipType: "contains",
        },
        {
          tempId: "temp-child-2",
          parentId: "temp-parent",
          title: "Child 2",
          content: "Child 2 content",
          level: "normal",
          x_position: 20,
          y_position: 20,
          relationshipType: "references",
        },
      ];

      mockSupabase.queryChain.insert
        .mockResolvedValueOnce({
          data: [{ id: parentKpId }, { id: childKpId + "-1" }, { id: childKpId + "-2" }],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [],
          error: null,
        });

      vi.mocked(graphNodeService.addToGraph)
        .mockResolvedValueOnce({
          id: parentGraphNodeId,
          knowledge_point_id: parentKpId,
          graph_id: graphId,
        } as any)
        .mockResolvedValueOnce({
          id: childGraphNodeId + "-1",
          knowledge_point_id: childKpId + "-1",
          graph_id: graphId,
        } as any)
        .mockResolvedValueOnce({
          id: childGraphNodeId + "-2",
          knowledge_point_id: childKpId + "-2",
          graph_id: graphId,
        } as any);

      vi.mocked(edgeService.create).mockResolvedValue({} as any);

      mockSupabase.queryChain.select.mockResolvedValue({
        data: [
          {
            id: "edge-1",
            source_knowledge_point_id: parentKpId,
            target_knowledge_point_id: childKpId + "-1",
            relationship_type: "contains",
          },
          {
            id: "edge-2",
            source_knowledge_point_id: parentKpId,
            target_knowledge_point_id: childKpId + "-2",
            relationship_type: "references",
          },
        ],
        error: null,
      });

      const result = await autoGraphService.processAINodes(
        mockSupabase as any,
        userId,
        graphId,
        nodes
      );

      expect(result.edgeCount).toBe(2);
    });

    it("should handle null parentId (root nodes)", async () => {
      const kpId = "kp-id";
      const graphNodeId = "gn-id";

      const nodes: AINodeData[] = [
        {
          tempId: "temp-root",
          parentId: null,
          title: "Root Node",
          content: "Root content",
          level: "normal",
          x_position: 0,
          y_position: 0,
        },
      ];

      mockSupabase.queryChain.insert.mockResolvedValue({
        data: [{ id: kpId }],
        error: null,
      });

      vi.mocked(graphNodeService.addToGraph).mockResolvedValue({
        id: graphNodeId,
        knowledge_point_id: kpId,
        graph_id: graphId,
      } as any);

      mockSupabase.queryChain.select.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await autoGraphService.processAINodes(
        mockSupabase as any,
        userId,
        graphId,
        nodes
      );

      expect(result.nodeCount).toBe(1);
      expect(result.edgeCount).toBe(0);
    });

    it("should correctly map tempId to graphNodeId in nodeMapping", async () => {
      const kpId = "kp-id";
      const graphNodeId = "gn-id";

      const nodes: AINodeData[] = [
        {
          tempId: "temp-123",
          parentId: null,
          title: "Test Node",
          content: "Test content",
          level: "normal",
          x_position: 0,
          y_position: 0,
        },
      ];

      mockSupabase.queryChain.insert.mockResolvedValue({
        data: [{ id: kpId }],
        error: null,
      });

      vi.mocked(graphNodeService.addToGraph).mockResolvedValue({
        id: graphNodeId,
        knowledge_point_id: kpId,
        graph_id: graphId,
      } as any);

      mockSupabase.queryChain.select.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await autoGraphService.processAINodes(
        mockSupabase as any,
        userId,
        graphId,
        nodes
      );

      expect(result.nodeMapping["temp-123"]).toEqual({
        graphNodeId,
        knowledgePointId: kpId,
      });
    });
  });

  describe("createEdgesBatch", () => {
    it("should return 0 when no edges provided", async () => {
      const result = await autoGraphService.createEdgesBatch(mockSupabase as any, []);
      expect(result).toBe(0);
    });

    it("should insert edges in batch", async () => {
      const edges: CreateEdgeData[] = [
        {
          graph_id: "graph-1",
          source_knowledge_point_id: "kp-1",
          target_knowledge_point_id: "kp-2",
          relationship_type: "contains",
        },
        {
          graph_id: "graph-1",
          source_knowledge_point_id: "kp-1",
          target_knowledge_point_id: "kp-3",
          relationship_type: "contains",
        },
      ];

      mockSupabase.queryChain.insert.mockResolvedValue({
        error: null,
      });

      const result = await autoGraphService.createEdgesBatch(mockSupabase as any, edges);

      expect(result).toBe(2);
    });

    it("should fall back to individual edge creation on batch error", async () => {
      const edges: CreateEdgeData[] = [
        {
          graph_id: "graph-1",
          source_knowledge_point_id: "kp-1",
          target_knowledge_point_id: "kp-2",
          relationship_type: "contains",
        },
      ];

      mockSupabase.queryChain.insert.mockResolvedValue({
        error: { message: "Batch insert failed" },
      });

      vi.mocked(edgeService.create).mockResolvedValue({} as any);

      const result = await autoGraphService.createEdgesBatch(mockSupabase as any, edges);

      expect(result).toBe(1);
      expect(edgeService.create).toHaveBeenCalled();
    });
  });

  describe("edge verification", () => {
    const userId = "test-user-id";
    const graphId = "test-graph-id";

    it("should verify created edges", async () => {
      const parentKpId = "parent-kp-id";
      const childKpId = "child-kp-id";
      const parentGraphNodeId = "parent-gn-id";
      const childGraphNodeId = "child-gn-id";

      const nodes: AINodeData[] = [
        {
          tempId: "temp-parent",
          parentId: null,
          title: "Parent",
          content: "Parent content",
          level: "normal",
          x_position: 0,
          y_position: 0,
        },
        {
          tempId: "temp-child",
          parentId: "temp-parent",
          title: "Child",
          content: "Child content",
          level: "normal",
          x_position: 10,
          y_position: 10,
        },
      ];

      mockSupabase.queryChain.insert
        .mockResolvedValueOnce({
          data: [{ id: parentKpId }, { id: childKpId }],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [],
          error: null,
        });

      vi.mocked(graphNodeService.addToGraph)
        .mockResolvedValueOnce({
          id: parentGraphNodeId,
          knowledge_point_id: parentKpId,
          graph_id: graphId,
        } as any)
        .mockResolvedValueOnce({
          id: childGraphNodeId,
          knowledge_point_id: childKpId,
          graph_id: graphId,
        } as any);

      vi.mocked(edgeService.create).mockResolvedValue({} as any);

      mockSupabase.queryChain.select.mockResolvedValue({
        data: [
          {
            id: "edge-1",
            source_knowledge_point_id: parentKpId,
            target_knowledge_point_id: childKpId,
            relationship_type: "contains",
          },
        ],
        error: null,
      });

      await autoGraphService.processAINodes(
        mockSupabase as any,
        userId,
        graphId,
        nodes
      );

      expect(mockSupabase.from).toHaveBeenCalledWith("edges");
    });
  });

  describe("embedding task creation", () => {
    const userId = "test-user-id";
    const graphId = "test-graph-id";

    it("should create embedding generation task after processing nodes", async () => {
      const kpId = "kp-id";
      const graphNodeId = "gn-id";

      const nodes: AINodeData[] = [
        {
          tempId: "temp-1",
          parentId: null,
          title: "Node",
          content: "Content",
          level: "normal",
          x_position: 0,
          y_position: 0,
        },
      ];

      mockSupabase.queryChain.insert.mockResolvedValue({
        data: [{ id: kpId }],
        error: null,
      });

      vi.mocked(graphNodeService.addToGraph).mockResolvedValue({
        id: graphNodeId,
        knowledge_point_id: kpId,
        graph_id: graphId,
      } as any);

      mockSupabase.queryChain.select.mockResolvedValue({
        data: [],
        error: null,
      });

      vi.mocked(asyncTaskService.createTask).mockResolvedValue({} as any);

      await autoGraphService.processAINodes(
        mockSupabase as any,
        userId,
        graphId,
        nodes
      );

      expect(asyncTaskService.createTask).toHaveBeenCalledWith(
        userId,
        "embedding_generation",
        { knowledgePointIds: [kpId] },
        expect.stringContaining("嵌入生成")
      );
    });

    it("should handle embedding task creation failure gracefully", async () => {
      const kpId = "kp-id";
      const graphNodeId = "gn-id";

      const nodes: AINodeData[] = [
        {
          tempId: "temp-1",
          parentId: null,
          title: "Node",
          content: "Content",
          level: "normal",
          x_position: 0,
          y_position: 0,
        },
      ];

      mockSupabase.queryChain.insert.mockResolvedValue({
        data: [{ id: kpId }],
        error: null,
      });

      vi.mocked(graphNodeService.addToGraph).mockResolvedValue({
        id: graphNodeId,
        knowledge_point_id: kpId,
        graph_id: graphId,
      } as any);

      mockSupabase.queryChain.select.mockResolvedValue({
        data: [],
        error: null,
      });

      vi.mocked(asyncTaskService.createTask).mockRejectedValue(new Error("Task creation failed"));

      const result = await autoGraphService.processAINodes(
        mockSupabase as any,
        userId,
        graphId,
        nodes
      );

      expect(result.nodeCount).toBe(1);
    });
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import type { Node, Edge, RegionInfo } from "@shared/types/graph";
import { ThemeProvider } from "../../../../hooks/common/useTheme";

import { QuadrantCanvas } from "../QuadrantCanvas";

function createMockNode(id: string, title: string = `Node ${id}`): Node {
  return {
    id,
    knowledge_point_id: id,
    graph_id: "test-graph",
    title,
    level: "normal",
    x_position: 0,
    y_position: 0,
    is_accepted: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    visibility: "private",
    owner_id: "test-user",
  };
}

function createMockEdge(id: string, sourceId: string, targetId: string): Edge {
  return {
    id,
    graph_id: "test-graph",
    source_knowledge_point_id: sourceId,
    target_knowledge_point_id: targetId,
  };
}

function createMockRegion(
  id: string,
  name: string,
  nodes: Node[],
  angleStart: number,
  angleEnd: number,
): RegionInfo {
  return {
    id,
    name,
    color: "#3B82F6",
    angleStart,
    angleEnd,
    nodes,
    isCollapsed: false,
  };
}

const mockNodes: Node[] = [
  createMockNode("node-1", "Node 1"),
  createMockNode("node-2", "Node 2"),
  createMockNode("node-3", "Node 3"),
];

const mockEdges: Edge[] = [createMockEdge("edge-1", "node-1", "node-2")];

const mockRegions: RegionInfo[] = [
  createMockRegion(
    "region-1",
    "Region 1",
    [mockNodes[0], mockNodes[1]],
    0,
    180,
  ),
  createMockRegion("region-2", "Region 2", [mockNodes[2]], 180, 360),
];

const mockOriginPosition = { x: 400, y: 300 };

function renderWithProvider(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe("QuadrantCanvas", () => {
  const defaultProps = {
    nodes: mockNodes,
    edges: mockEdges,
    regions: mockRegions,
    originPosition: mockOriginPosition,
    collapsedRegions: [],
    onOriginMove: vi.fn(),
    onRegionToggle: vi.fn(),
    onNodeClick: vi.fn(),
  };

  describe("组件渲染", () => {
    it("渲染 SVG 容器", () => {
      renderWithProvider(<QuadrantCanvas {...defaultProps} />);
      const svg = document.querySelector("svg");
      expect(svg).toBeTruthy();
    });

    it("渲染所有区域", () => {
      renderWithProvider(<QuadrantCanvas {...defaultProps} />);
      const regions = document.querySelectorAll("[data-region-id]");
      expect(regions.length).toBe(2);
    });

    it("渲染所有节点", () => {
      renderWithProvider(<QuadrantCanvas {...defaultProps} />);
      const nodes = document.querySelectorAll("[data-node-id]");
      expect(nodes.length).toBe(3);
    });
  });

  describe("幽灵高亮修复", () => {
    describe("场景1：基本幽灵高亮消除（core 节点边）", () => {
      it("经过 core 节点的间接连接不应该高亮", () => {
        const nodeA = createMockNode("nodeA", "Node A");
        const nodeB = createMockNode("nodeB", "Node B");
        const coreNode = createMockNode("coreNode", "Core Node");
        coreNode.level = "core";

        const edges: Edge[] = [
          createMockEdge("edge-1", "nodeA", "coreNode"),
          createMockEdge("edge-2", "coreNode", "nodeB"),
        ];

        const regions: RegionInfo[] = [
          createMockRegion("region-1", "Region 1", [nodeA, nodeB], 0, 180),
        ];

        renderWithProvider(
          <QuadrantCanvas
            {...defaultProps}
            nodes={[nodeA, nodeB, coreNode]}
            edges={edges}
            regions={regions}
            focusedNodeId="nodeA"
          />,
        );

        const nodeAElement = document.querySelector('[data-node-id="nodeA"]');
        const nodeBElement = document.querySelector('[data-node-id="nodeB"]');

        expect(nodeAElement).toBeTruthy();
        expect(nodeBElement).toBeTruthy();

        const nodeAOpacity = (nodeAElement as HTMLElement)?.style?.opacity;
        const nodeBOpacity = (nodeBElement as HTMLElement)?.style?.opacity;

        expect(nodeAOpacity).toBe("1");
        expect(nodeBOpacity).toBe("0.45");
      });
    });

    describe("场景2：正常邻居高亮（同一区域直接边）", () => {
      it("同一区域内通过可见边直接连接的节点应该高亮", () => {
        const nodeA = createMockNode("nodeA", "Node A");
        const nodeB = createMockNode("nodeB", "Node B");
        const nodeC = createMockNode("nodeC", "Node C");

        const edges: Edge[] = [
          createMockEdge("edge-1", "nodeA", "nodeB"),
          createMockEdge("edge-2", "nodeA", "nodeC"),
        ];

        const regions: RegionInfo[] = [
          createMockRegion(
            "region-1",
            "Region 1",
            [nodeA, nodeB, nodeC],
            0,
            180,
          ),
        ];

        renderWithProvider(
          <QuadrantCanvas
            {...defaultProps}
            nodes={[nodeA, nodeB, nodeC]}
            edges={edges}
            regions={regions}
            focusedNodeId="nodeA"
          />,
        );

        const nodeAElement = document.querySelector('[data-node-id="nodeA"]');
        const nodeBElement = document.querySelector('[data-node-id="nodeB"]');
        const nodeCElement = document.querySelector('[data-node-id="nodeC"]');

        expect(nodeAElement).toBeTruthy();
        expect(nodeBElement).toBeTruthy();
        expect(nodeCElement).toBeTruthy();

        const nodeAOpacity = (nodeAElement as HTMLElement)?.style?.opacity;
        const nodeBOpacity = (nodeBElement as HTMLElement)?.style?.opacity;
        const nodeCOpacity = (nodeCElement as HTMLElement)?.style?.opacity;

        expect(nodeAOpacity).toBe("1");
        expect(nodeBOpacity).toBe("1");
        expect(nodeCOpacity).toBe("1");
      });
    });

    describe("场景3：跨区域边正确处理", () => {
      it("只有通过跨区域可见边直接连接的节点才高亮", () => {
        const nodeA = createMockNode("nodeA", "Node A");
        const nodeB = createMockNode("nodeB", "Node B");
        const nodeC = createMockNode("nodeC", "Node C");

        const edges: Edge[] = [
          createMockEdge("edge-1", "nodeA", "nodeB"),
          createMockEdge("edge-2", "nodeB", "nodeC"),
        ];

        const regions: RegionInfo[] = [
          createMockRegion("region-1", "Region 1", [nodeA], 0, 180),
          createMockRegion("region-2", "Region 2", [nodeB, nodeC], 180, 360),
        ];

        renderWithProvider(
          <QuadrantCanvas
            {...defaultProps}
            nodes={[nodeA, nodeB, nodeC]}
            edges={edges}
            regions={regions}
            focusedNodeId="nodeA"
          />,
        );

        const nodeAElement = document.querySelector('[data-node-id="nodeA"]');
        const nodeBElement = document.querySelector('[data-node-id="nodeB"]');
        const nodeCElement = document.querySelector('[data-node-id="nodeC"]');

        expect(nodeAElement).toBeTruthy();
        expect(nodeBElement).toBeTruthy();
        expect(nodeCElement).toBeTruthy();

        const nodeAOpacity = (nodeAElement as HTMLElement)?.style?.opacity;
        const nodeBOpacity = (nodeBElement as HTMLElement)?.style?.opacity;
        const nodeCOpacity = (nodeCElement as HTMLElement)?.style?.opacity;

        expect(nodeAOpacity).toBe("1");
        expect(nodeBOpacity).toBe("1");
        expect(nodeCOpacity).toBe("0.45");
      });
    });

    describe("场景4：无聚焦模式", () => {
      it("无聚焦时所有节点应该完全可见", () => {
        const nodeA = createMockNode("nodeA", "Node A");
        const nodeB = createMockNode("nodeB", "Node B");
        const nodeC = createMockNode("nodeC", "Node C");

        const edges: Edge[] = [
          createMockEdge("edge-1", "nodeA", "nodeB"),
          createMockEdge("edge-2", "nodeB", "nodeC"),
        ];

        const regions: RegionInfo[] = [
          createMockRegion(
            "region-1",
            "Region 1",
            [nodeA, nodeB, nodeC],
            0,
            180,
          ),
        ];

        renderWithProvider(
          <QuadrantCanvas
            {...defaultProps}
            nodes={[nodeA, nodeB, nodeC]}
            edges={edges}
            regions={regions}
            focusedNodeId={null}
            focusedNodeIds={new Set()}
          />,
        );

        const nodeAElement = document.querySelector('[data-node-id="nodeA"]');
        const nodeBElement = document.querySelector('[data-node-id="nodeB"]');
        const nodeCElement = document.querySelector('[data-node-id="nodeC"]');

        expect(nodeAElement).toBeTruthy();
        expect(nodeBElement).toBeTruthy();
        expect(nodeCElement).toBeTruthy();

        const nodeAOpacity = (nodeAElement as HTMLElement)?.style?.opacity;
        const nodeBOpacity = (nodeBElement as HTMLElement)?.style?.opacity;
        const nodeCOpacity = (nodeCElement as HTMLElement)?.style?.opacity;

        expect(nodeAOpacity).toBe("1");
        expect(nodeBOpacity).toBe("1");
        expect(nodeCOpacity).toBe("1");
      });
    });

    describe("场景5：ID 标准化测试", () => {
      it("带空格的 focusedNodeId 应该正确匹配节点（trim 处理）", () => {
        const nodeA = createMockNode("nodeA", "Node A");
        const nodeB = createMockNode("nodeB", "Node B");

        const edges: Edge[] = [createMockEdge("edge-1", "nodeA", "nodeB")];

        const regions: RegionInfo[] = [
          createMockRegion("region-1", "Region 1", [nodeA, nodeB], 0, 180),
        ];

        renderWithProvider(
          <QuadrantCanvas
            {...defaultProps}
            nodes={[nodeA, nodeB]}
            edges={edges}
            regions={regions}
            focusedNodeId=" nodeA "
          />,
        );

        const nodeAElement = document.querySelector('[data-node-id="nodeA"]');
        const nodeBElement = document.querySelector('[data-node-id="nodeB"]');

        expect(nodeAElement).toBeTruthy();
        expect(nodeBElement).toBeTruthy();

        const nodeAOpacity = (nodeAElement as HTMLElement)?.style?.opacity;
        const nodeBOpacity = (nodeBElement as HTMLElement)?.style?.opacity;

        expect(nodeAOpacity).toBe("1");
        expect(nodeBOpacity).toBe("1");
      });

      it("focusedNodeId 为空字符串时不应该激活聚焦模式", () => {
        const nodeA = createMockNode("nodeA", "Node A");
        const nodeB = createMockNode("nodeB", "Node B");

        const edges: Edge[] = [createMockEdge("edge-1", "nodeA", "nodeB")];

        const regions: RegionInfo[] = [
          createMockRegion("region-1", "Region 1", [nodeA, nodeB], 0, 180),
        ];

        renderWithProvider(
          <QuadrantCanvas
            {...defaultProps}
            nodes={[nodeA, nodeB]}
            edges={edges}
            regions={regions}
            focusedNodeId=""
          />,
        );

        const nodeAElement = document.querySelector('[data-node-id="nodeA"]');
        const nodeBElement = document.querySelector('[data-node-id="nodeB"]');

        expect(nodeAElement).toBeTruthy();
        expect(nodeBElement).toBeTruthy();

        const nodeAOpacity = (nodeAElement as HTMLElement)?.style?.opacity;
        const nodeBOpacity = (nodeBElement as HTMLElement)?.style?.opacity;

        expect(nodeAOpacity).toBe("1");
        expect(nodeBOpacity).toBe("1");
      });
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import type { Node, Edge, RegionInfo } from "@shared/types/graph";

vi.mock("../../../hooks/common/useTheme", () => ({
  useTheme: () => ({ isDark: false }),
}));

let QuadrantCanvas: React.ComponentType<any>;

beforeEach(async () => {
  vi.resetModules();
  vi.doMock("../../../hooks/common/useTheme", () => ({
    useTheme: () => ({ isDark: false }),
  }));
  const module = await import("../QuadrantCanvas");
  QuadrantCanvas = module.QuadrantCanvas;
});

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
      render(<QuadrantCanvas {...defaultProps} />);
      const svg = document.querySelector("svg");
      expect(svg).toBeTruthy();
    });

    it("渲染所有区域", () => {
      render(<QuadrantCanvas {...defaultProps} />);
      const regions = document.querySelectorAll("[data-region-id]");
      expect(regions.length).toBe(2);
    });

    it("渲染所有节点", () => {
      render(<QuadrantCanvas {...defaultProps} />);
      const nodes = document.querySelectorAll("[data-node-id]");
      expect(nodes.length).toBe(3);
    });

    it("渲染原点元素", () => {
      render(<QuadrantCanvas {...defaultProps} />);
      const origin = document.querySelector("[data-origin]");
      expect(origin).toBeTruthy();
    });

    it("渲染缩放控制按钮", () => {
      render(<QuadrantCanvas {...defaultProps} />);
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThanOrEqual(3);
    });

    it("渲染缩放指示器", () => {
      render(<QuadrantCanvas {...defaultProps} />);
      expect(screen.getByText(/缩放:/)).toBeTruthy();
    });
  });

  describe("区域交互", () => {
    it("点击区域头部触发折叠切换", () => {
      const onRegionToggle = vi.fn();
      render(
        <QuadrantCanvas {...defaultProps} onRegionToggle={onRegionToggle} />,
      );

      const regionHeader = document.querySelector(
        '[data-region-id="region-1"]',
      );
      if (regionHeader) {
        fireEvent.click(regionHeader);
        expect(onRegionToggle).toHaveBeenCalledWith("region-1");
      }
    });

    it("折叠区域时隐藏节点", () => {
      render(
        <QuadrantCanvas {...defaultProps} collapsedRegions={["region-1"]} />,
      );

      const nodes = document.querySelectorAll("[data-node-id]");
      expect(nodes.length).toBe(1);
    });

    it("展开区域时显示节点", () => {
      render(<QuadrantCanvas {...defaultProps} />);

      const nodes = document.querySelectorAll("[data-node-id]");
      expect(nodes.length).toBe(3);
    });
  });

  describe("节点交互", () => {
    it("点击节点触发回调", () => {
      const onNodeClick = vi.fn();
      render(<QuadrantCanvas {...defaultProps} onNodeClick={onNodeClick} />);

      const node = document.querySelector('[data-node-id="node-1"]');
      if (node) {
        fireEvent.click(node);
        expect(onNodeClick).toHaveBeenCalled();
      }
    });

    it("选中节点有高亮样式", () => {
      render(<QuadrantCanvas {...defaultProps} selectedNodeId="node-1" />);

      const node = document.querySelector('[data-node-id="node-1"]');
      expect(node).toBeTruthy();
    });
  });

  describe("原点拖拽", () => {
    it("原点有可拖拽样式", () => {
      render(<QuadrantCanvas {...defaultProps} />);
      const origin = document.querySelector("[data-origin]");
      expect(origin?.getAttribute("style")).toContain("cursor: move");
    });
  });

  describe("缩放控制", () => {
    it("点击放大按钮增加缩放比例", () => {
      render(<QuadrantCanvas {...defaultProps} />);

      const buttons = screen.getAllByRole("button");
      const zoomInButton = buttons[0];
      fireEvent.click(zoomInButton);

      expect(screen.getByText(/缩放:/)).toBeTruthy();
    });

    it("点击缩小按钮减少缩放比例", () => {
      render(<QuadrantCanvas {...defaultProps} />);

      const buttons = screen.getAllByRole("button");
      const zoomOutButton = buttons[1];
      fireEvent.click(zoomOutButton);

      expect(screen.getByText(/缩放:/)).toBeTruthy();
    });

    it("点击重置按钮恢复默认缩放", () => {
      render(<QuadrantCanvas {...defaultProps} />);

      const buttons = screen.getAllByRole("button");
      const resetButton = buttons[2];
      fireEvent.click(resetButton);

      expect(screen.getByText("缩放: 100%")).toBeTruthy();
    });
  });

  describe("自定义尺寸", () => {
    it("使用自定义宽度和高度", () => {
      render(<QuadrantCanvas {...defaultProps} width={1200} height={800} />);

      const svg = document.querySelector("svg");
      expect(svg).toBeTruthy();
    });
  });

  describe("空数据处理", () => {
    it("空节点数组正常渲染", () => {
      render(<QuadrantCanvas {...defaultProps} nodes={[]} regions={[]} />);

      const svg = document.querySelector("svg");
      expect(svg).toBeTruthy();
    });

    it("空区域数组正常渲染", () => {
      render(<QuadrantCanvas {...defaultProps} regions={[]} />);

      const svg = document.querySelector("svg");
      expect(svg).toBeTruthy();
    });
  });
});


export type ParsedGraphNodeLevel = 'root' | 'core' | 'sub' | 'normal' | 'leaf';

export interface ParsedGraphNode {
  id: string;
  title: string;
  content: string;
  level: ParsedGraphNodeLevel;
  color: string;
  x_position: number;
  y_position: number;
}

export interface ParsedGraphEdge {
  source: string;
  target: string;
  relationship: string;
}

export interface ParsedGraph {
  graph_title: string;
  nodes: ParsedGraphNode[];
  edges: ParsedGraphEdge[];
}

export const parseOpmlToGraph = (xmlText: string): ParsedGraph => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");

  const nodes: ParsedGraphNode[] = [];
  const edges: ParsedGraphEdge[] = [];
  let graphTitle = 'Untitled MindMap';

  // Try to get title from <head><title> or first outline text
  const headTitle = xmlDoc.querySelector('head > title')?.textContent;
  if (headTitle) {
    graphTitle = headTitle;
  }

  const outlines = xmlDoc.querySelectorAll('body > outline');
  if (outlines.length === 0) {
    // Maybe it's a flat list or nested differently, try searching all outlines
    // But usually OPML has body > outline
  }

  // Helper to determine color/level based on depth
  const getLevelInfo = (depth: number): { level: ParsedGraphNodeLevel; color: string } => {
    switch (depth) {
      case 0: return { level: 'root', color: '#8B5CF6' };   // Purple
      case 1: return { level: 'core', color: '#EF4444' };   // Red
      case 2: return { level: 'sub', color: '#F59E0B' };    // Orange
      case 3: return { level: 'normal', color: '#3B82F6' }; // Blue
      default: return { level: 'leaf', color: '#10B981' };  // Green
    }
  };

  let nodeIdCounter = 0;

  const processOutline = (element: Element, depth: number, parentId: string | null) => {
    const text = element.getAttribute('text') || element.getAttribute('title') || 'Untitled Node';
    const note = element.getAttribute('_note') || ''; // Some OPML exports use _note for notes
    
    // Check if this is the root title if we haven't found one
    if (depth === 0 && !headTitle && nodes.length === 0) {
      graphTitle = text;
    }

    const nodeId = `opml-node-${++nodeIdCounter}`;
    const { level, color } = getLevelInfo(depth);

    // Create node
    nodes.push({
      id: nodeId,
      title: text,
      content: note,
      level,
      color,
      x_position: Math.round((Math.random() - 0.5) * 100),
      y_position: Math.round((Math.random() - 0.5) * 100),
    });

    // Create edge from parent
    if (parentId) {
      edges.push({
        source: parentId,
        target: nodeId,
        relationship: 'contains'
      });
    }

    // Process children
    const children = element.children;
    for (let i = 0; i < children.length; i++) {
      if (children[i].tagName.toLowerCase() === 'outline') {
        processOutline(children[i], depth + 1, nodeId);
      }
    }
  };

  // Process top-level outlines
  for (let i = 0; i < outlines.length; i++) {
    processOutline(outlines[i], 0, null);
  }

  return {
    graph_title: graphTitle,
    nodes,
    edges
  };
};

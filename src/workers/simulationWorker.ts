
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceY } from 'd3-force-3d';

// Types (simplified copies to avoid import issues in worker)
interface SimNode {
  id: string;
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  level?: string;
  [key: string]: any;
}

interface SimLink {
  source: string | SimNode;
  target: string | SimNode;
  id: string;
}

// Configuration (must match main thread)
const LEVEL_CONFIG: Record<string, any> = {
  root: { chargeStrength: -60, radius: 1.4 },
  core: { chargeStrength: -40, radius: 1.1 },
  sub: { chargeStrength: -30, radius: 0.8 },
  normal: { chargeStrength: -20, radius: 0.5 },
  leaf: { chargeStrength: -10, radius: 0.3 }
};

let simulation: any = null;
let nodes: SimNode[] = [];
let links: SimLink[] = [];

self.onmessage = (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'init':
    case 'updateData':
      initSimulation(payload.nodes, payload.links);
      break;
    case 'stop':
      if (simulation) simulation.stop();
      break;
  }
};

function initSimulation(newNodes: SimNode[], newLinks: SimLink[]) {
  // Preserve existing positions if IDs match
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
  nodes = newNodes.map(n => {
    const existing = nodeMap.get(n.id);
    if (existing) {
      return { ...existing, ...n, x: existing.x, y: existing.y, z: existing.z, vx: existing.vx, vy: existing.vy, vz: existing.vz };
    }
    return n;
  });
  
  links = newLinks.map(l => ({ ...l }));

  if (!simulation) {
    simulation = forceSimulation()
      .numDimensions(3)
      .force('center', forceCenter())
      .force('y', forceY(0).strength(5)) // Flattening force
      .force('collide', forceCollide().radius((d: any) => {
         const level = d.level || 'leaf';
         const config = LEVEL_CONFIG[level] || LEVEL_CONFIG.leaf;
         return config.radius * 1.5;
      }).iterations(3));
      
    simulation.on('tick', () => {
      // Send positions back to main thread
      const positions = new Float32Array(nodes.length * 3);
      for (let i = 0; i < nodes.length; i++) {
        positions[i * 3] = nodes[i].x || 0;
        positions[i * 3 + 1] = nodes[i].y || 0;
        positions[i * 3 + 2] = nodes[i].z || 0;
      }
      
      self.postMessage({ type: 'tick', nodes: nodes }); // We might need full nodes for links?
      // Actually, for InstancedMesh we just need positions. 
      // But for Lines, we need to know which node connects to which.
      // If we send full nodes array back, it's heavy.
      // Optimization: Send a Float32Array for positions.
      // But the main thread needs to map index -> ID or ID -> Position.
      // Let's return the full nodes array for now (cloned) to be safe, or just x/y/z.
      // To keep it simple for P1, let's send the nodes array (structured clone is fast enough for <5k nodes).
    });
  }

  simulation.nodes(nodes);

  simulation.force('charge', forceManyBody()
    .strength((d: any) => {
      const level = d.level || 'leaf';
      const config = LEVEL_CONFIG[level] || LEVEL_CONFIG.leaf;
      return config.chargeStrength;
    })
    .distanceMax(15)
  );

  simulation.force('link', forceLink(links)
    .id((d: any) => d.id)
    .distance((link: any) => {
      const sourceLevel = (link.source as SimNode).level || 'leaf';
      const targetLevel = (link.target as SimNode).level || 'leaf';
      
      if (sourceLevel === 'root' || targetLevel === 'root') return 3.0;
      if (sourceLevel === 'core' || targetLevel === 'core') return 2.0;
      if (sourceLevel === 'sub' || targetLevel === 'sub') return 1.5;
      return 1.0;
    })
  );

  simulation.alpha(1).restart();
}

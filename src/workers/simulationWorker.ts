
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceY } from 'd3-force-3d';
import { LEVEL_CONFIG, SimNode, SimLink } from '../config/graphConfig';

// Store simulation instance
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
    case 'dragStart':
       // Optional: Handle drag interaction from main thread
       break;
  }
};

function initSimulation(newNodes: SimNode[], newLinks: SimLink[]) {
  // Preserve existing positions if IDs match to prevent jumpiness on update
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
  // Merge new nodes with existing positions/velocities
  nodes = newNodes.map(n => {
    const existing = nodeMap.get(n.id);
    if (existing) {
      return { 
        ...existing, // Keep existing simulation state (x,y,z,vx,vy,vz)
        ...n,        // Update properties (title, content, etc.)
        // Ensure simulation properties are preserved
        x: existing.x, 
        y: existing.y, 
        z: existing.z, 
        vx: existing.vx, 
        vy: existing.vy, 
        vz: existing.vz 
      };
    }
    return n;
  });
  
  // D3 forceLink modifies link objects, so we need fresh copies or handle carefully
  // We'll map new links to ensure they are clean objects (source/target as strings initially)
  links = newLinks.map(l => ({ ...l }));

  if (!simulation) {
    simulation = forceSimulation()
      .numDimensions(3)
      .force('center', forceCenter())
      .force('y', forceY(0).strength(5)) // Flattening force (quasi-2D)
      .force('collide', forceCollide().radius((d: any) => {
         const level = d.level || 'leaf';
         const config = LEVEL_CONFIG[level] || LEVEL_CONFIG.leaf;
         return config.radius * 1.5;
      }).iterations(3));
      
    simulation.on('tick', () => {
      // Send simplified node data back to main thread
      // We mainly need positions (x, y, z)
      // To optimize transfer, we could use Float32Array, but for simplicity/flexibility 
      // with types, we'll send the node objects. 
      // Since structured clone is efficient, this is usually fine for < 2000 nodes.
      
      // Note: We don't need to send the whole node object back if we only updated x,y,z.
      // But the main thread might rely on 'nodes' array being the source of truth for rendering.
      
      self.postMessage({ type: 'tick', nodes: nodes });
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

  // Restart simulation
  // Use lower alpha for incremental updates (smooth transition)
  // Use higher alpha for initial load
  const isIncremental = nodeMap.size > 0;
  simulation.alpha(isIncremental ? 0.3 : 1).restart();
}

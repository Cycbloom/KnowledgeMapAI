
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceY, forceX, forceZ, forceRadial } from 'd3-force-3d';
import { LEVEL_CONFIG, RADIAL_DISTANCES, SimNode, SimLink } from '../config/graphConfig';

// Store simulation instance
let simulation: any = null;
let nodes: SimNode[] = [];
let links: SimLink[] = [];
let currentLayoutMode: '3d-force' | '2d-tree' | '3d-sphere' | 'solar' = '3d-force';

self.onmessage = (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'init':
    case 'updateData':
      initSimulation(payload.nodes, payload.links, payload.layoutMode);
      break;
    case 'stop':
      if (simulation) simulation.stop();
      break;
    case 'dragStart':
       // Optional: Handle drag interaction from main thread
       break;
  }
};

function initSimulation(newNodes: SimNode[], newLinks: SimLink[], layoutMode: '3d-force' | '2d-tree' | '3d-sphere' | 'solar' = '3d-force') {
  // Preserve existing positions if IDs match to prevent jumpiness on update
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const isModeChanged = currentLayoutMode !== layoutMode;
  const isCountChanged = nodes.length !== newNodes.length;
  currentLayoutMode = layoutMode;
  
  // Merge new nodes with existing positions/velocities
  nodes = newNodes.map(n => {
    const existing = nodeMap.get(n.id);
    // Reset positions only if layout mode changed.
    // We preserve positions even if node count changed (collapse/expand) to maintain continuity.
    if (existing && !isModeChanged) {
      return { 
        ...existing, // Keep existing simulation state (x,y,z,vx,vy,vz)
        ...n,        // Update properties (title, content, etc.)
        // Ensure simulation properties are explicitly preserved
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

  if (simulation) {
    simulation.stop();
  }

  simulation = forceSimulation()
    .numDimensions(3)
    .nodes(nodes);

  // Common forces
  simulation
    .force('charge', forceManyBody()
      .strength((d: any) => {
        const level = d.level || 'leaf';
        const config = LEVEL_CONFIG[level] || LEVEL_CONFIG.leaf;
        return config.chargeStrength;
      })
      .distanceMax(layoutMode === '3d-sphere' ? 50 : 15) // Relax distance for sphere
    )
    .force('link', forceLink(links)
      .id((d: any) => d.id)
      .distance((link: any) => {
        const sourceLevel = (link.source as SimNode).level || 'leaf';
        const targetLevel = (link.target as SimNode).level || 'leaf';
        
        // Tighter links for tree mode
        if (layoutMode === '2d-tree') return 1.5;

        if (sourceLevel === 'root' || targetLevel === 'root') return 3.0;
        if (sourceLevel === 'core' || targetLevel === 'core') return 2.0;
        if (sourceLevel === 'sub' || targetLevel === 'sub') return 1.5;
        return 1.0;
      })
    )
    .force('collide', forceCollide().radius((d: any) => {
       const level = d.level || 'leaf';
       const config = LEVEL_CONFIG[level] || LEVEL_CONFIG.leaf;
       return config.radius * 1.5;
    }).iterations(3));

  // Layout-specific forces
  if (layoutMode === '2d-tree') {
    // 2D Tree: Vertical hierarchy
    // Root at top, Leaves at bottom
    simulation
      .force('center', forceCenter().strength(0.1)) // Weak center to allow spread
      .force('y', forceY((d: any) => {
        const level = d.level || 'leaf';
        switch (level) {
          case 'root': return 10;
          case 'core': return 5;
          case 'sub': return 0;
          case 'normal': return -5;
          case 'leaf': return -10;
          default: return 0;
        }
      }).strength(3)) // Strong Y force to enforce layers
      .force('z', forceZ(0).strength(5)) // Flatten to 2D
      .force('x', forceX(0).strength(0.05)); // Weak X to keep centered horizontally

  } else if (layoutMode === '3d-sphere') {
    // 3D Sphere: Push nodes to surface
    simulation
      .force('center', forceCenter())
      .force('radial', forceRadial(20).strength(0.8)); // Push to radius 20

  } else if (layoutMode === 'solar') {
    // Solar mode: Concentric circles based on level
    simulation
      .force('center', forceCenter(0, 0, 0).strength(1))
      .force('radial', forceRadial((d: any) => {
        const level = (d.level || 'leaf') as keyof typeof RADIAL_DISTANCES;
        return RADIAL_DISTANCES[level] || RADIAL_DISTANCES.leaf;
      }).strength(2.5)) // Even stronger radial
      .force('z', forceZ(0).strength(2))
      // Fix root at center
      .force('x', forceX(0).strength((d: any) => d.level === 'root' ? 2 : 0))
      .force('y', forceY(0).strength((d: any) => d.level === 'root' ? 2 : 0))
      .force('charge', forceManyBody().strength((d: any) => {
        return d.level === 'root' ? -50 : -30; // Slight repulsion for root to keep space
      }));

  } else {
    // Default 3D Force (Quasi-2D)
    simulation
      .force('center', forceCenter())
      .force('y', forceY(0).strength(0.5)); // Reduced flattening force for more natural settle
  }

  simulation.on('tick', () => {
    // Send simplified node positions back to main thread using Float32Array
    // Layout: [x0, y0, z0, x1, y1, z1, ...]
    const n = nodes.length;
    const positions = new Float32Array(n * 3);
    
    for (let i = 0; i < n; i++) {
      const node = nodes[i];
      positions[i * 3] = node.x || 0;
      positions[i * 3 + 1] = node.y || 0;
      positions[i * 3 + 2] = node.z || 0;
    }

    // @ts-ignore - Worker postMessage signature differs from Window
    self.postMessage({ type: 'tick', positions }, [positions.buffer]);
  });

  // Restart simulation
  // If mode changed, use high alpha to reorganize. 
  // If just data update, use lower alpha.
  const isIncremental = nodeMap.size > 0 && !isModeChanged;
  simulation.alpha(isIncremental ? 0.3 : 1).restart();
}

import React, { forwardRef, useState, useCallback, useImperativeHandle, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { SimNode, SimLink, THEME_CONFIG } from '../../config/graphConfig';
import { Node } from '../../types/index';
import { InstancedNodes, LinkLines, NodeLabels } from './GraphRenderables';
import { CameraController } from './CameraController';
import { BoxSelection } from './BoxSelection';

export interface ScreenshotOptions {
  width?: number;
  height?: number;
  transparent?: boolean;
  fitView?: boolean; // Fit all nodes
  hideGrid?: boolean;
}

export interface GraphSceneRef {
  focusNode: (nodeId: string) => void;
  captureScreenshot: (options?: ScreenshotOptions) => Promise<string>;
}

interface GraphSceneProps {
  nodesRef: React.MutableRefObject<SimNode[]>;
  linksRef: React.MutableRefObject<SimLink[]>;
  nodesMapRef: React.MutableRefObject<Map<string, SimNode>>;
  simulationVersion: number;
  isDark: boolean;
  highlightedNodes: Set<string>;
  highlightedLinks: Set<string>;
  pulsingNodeIds?: Set<string>;
  lockedNodeIds?: Set<string>;
  masteredNodeIds?: Set<string>;
  gamificationEnabled?: boolean;
  onNodeClick: (node: Node) => void;
  onNodeCollapse?: (nodeId: string) => void;
  onSelectionChange?: (nodeIds: string[]) => void;
  onBoxUpdate?: (box: { left: number; top: number; width: number; height: number } | null) => void;
  showGrid?: boolean;
  textDisplayLevel?: 'all' | 'important' | 'root_only';
}

const getTheme = (isDark: boolean) => isDark ? THEME_CONFIG.dark : THEME_CONFIG.light;

export const GraphScene = forwardRef<GraphSceneRef, GraphSceneProps>((props, ref) => {
  const { 
    nodesRef, 
    linksRef, 
    nodesMapRef, 
    simulationVersion, 
    isDark, 
    highlightedNodes, 
    highlightedLinks,
    pulsingNodeIds,
    onNodeClick,
    onNodeCollapse,
    onSelectionChange,
    onBoxUpdate,
    showGrid 
  } = props;

  const theme = getTheme(isDark);
  const [focusTarget, setFocusTarget] = useState<{ pos: THREE.Vector3, lookAt: THREE.Vector3 } | null>(null);
  const tempQuaternion = useMemo(() => new THREE.Quaternion(), []);

  // Focus Logic
  const focusNodeInternal = useCallback((nodeId: string) => {
    const targetNode = nodesRef.current.find(n => n.id === nodeId);
    if (targetNode && typeof targetNode.x === 'number') {
      const nodePos = new THREE.Vector3(targetNode.x, targetNode.y, targetNode.z);
      setFocusTarget({
        pos: nodePos.clone().add(new THREE.Vector3(0, 2, 5)),
        lookAt: nodePos
      });
      // Auto-release focus after animation (2s)
      setTimeout(() => setFocusTarget(null), 2000);
    }
  }, [nodesRef]);

  const { gl, scene, camera: genericCamera } = useThree();
  const camera = genericCamera as THREE.PerspectiveCamera;
  const [isExporting, setIsExporting] = useState(false); // State to trigger re-render for export
  
  // Ref for accessing NodeLabels group to manually update orientations
  const nodeLabelsGroupRef = React.useRef<THREE.Group>(null);

  const captureScreenshot = useCallback(async (options?: ScreenshotOptions) => {
    // 1. Save current state
    const originalPosition = camera.position.clone();
    const originalRotation = camera.rotation.clone();
    const originalBg = scene.background;
    const originalPixelRatio = gl.getPixelRatio();
    const originalUp = camera.up.clone(); 
    
    // Trigger export mode to force labels visible via React render
    setIsExporting(true);
    
    // Wait for one frame to let React re-render NodeLabels with forceShowAllLabels={true}
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    // 2. Apply Options
    gl.setPixelRatio(3);

    if (options?.hideGrid) {
      const grid = scene.children.find(c => c.type === 'GridHelper');
      if (grid) grid.visible = false;
    }

    if (options?.transparent) {
      scene.background = null;
      gl.setClearColor(0x000000, 0);
    }

    // Calculate Bounding Box
    let center = new THREE.Vector3(0, 0, 0);
    let size = 20; 

    if (nodesRef.current.length > 0) {
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      
      nodesRef.current.forEach(node => {
        if (typeof node.x !== 'number') return;
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        minZ = Math.min(minZ, node.z);
        maxX = Math.max(maxX, node.x);
        maxY = Math.max(maxY, node.y);
        maxZ = Math.max(maxZ, node.z);
      });

      if (minX !== Infinity) {
        center.set((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
        size = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
      }
    }

    if (options?.fitView) {
      const fov = camera.fov * (Math.PI / 180);
      const distance = (size * 1.2) / (2 * Math.tan(fov / 2));
      const direction = new THREE.Vector3().subVectors(camera.position, center).normalize();
      if (direction.lengthSq() === 0) direction.set(0, 0, 1);
      camera.position.copy(center).add(direction.multiplyScalar(distance));
      camera.lookAt(center);
      camera.updateProjectionMatrix();
    }
    
    // Crucial: Update matrices after moving camera
    camera.updateMatrixWorld();

    // FORCE TEXT UPDATE BEFORE RENDER
    // 1. Manually update all objects that should face the camera
    if (nodeLabelsGroupRef.current) {
        nodeLabelsGroupRef.current.children.forEach((child) => {
            if (!child) return;

            // Force visible (in case React render didn't finish or LOD still active)
            child.visible = true;

            // Force orientation to match camera exactly
            // For screen-aligned billboards, copying the camera's quaternion is the most robust way
            // We use the world quaternion to be safe.
            camera.getWorldQuaternion(tempQuaternion);
            child.quaternion.copy(tempQuaternion);
            
            // Critical for Top-Down view: Ensure the text isn't tilted due to the camera's up vector
            // In a top-down view with camera.up = (0,0,-1), copying the quaternion is usually enough,
            // but we can also manually fix the Z-rotation if needed.
            
            child.updateMatrix();
            child.updateMatrixWorld();
        });
    }

    // 2. We need to ensure the Text components (troika-three-text) are synced.
    scene.traverse((obj: any) => {
        if (obj.isMesh && obj.textRenderInfo) { 
             // Troika text objects might also need to face the camera if they aren't already
             // via the billboard. Let's ensure their world quaternion is correct too.
             // But usually Billboard handles the rotation of its children.
             obj.sync(); 
        }
    });

    // 3. Render
    gl.render(scene, camera);
    const dataUrl = gl.domElement.toDataURL('image/png', 1.0); 

    // 4. Restore state
    camera.position.copy(originalPosition);
    camera.rotation.copy(originalRotation);
    camera.up.copy(originalUp); 
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    scene.background = originalBg;
    gl.setPixelRatio(originalPixelRatio);
    setIsExporting(false);

    if (options?.hideGrid) {
      const grid = scene.children.find(c => c.type === 'GridHelper');
      if (grid) grid.visible = true;
    }

    return dataUrl;
  }, [gl, scene, camera, nodesRef]);

  // ...
  
  // Pass isExporting to NodeLabels

  useImperativeHandle(ref, () => ({
    focusNode: focusNodeInternal,
    captureScreenshot
  }), [focusNodeInternal, captureScreenshot]);

  return (
    <>
      {showGrid && (
        <gridHelper 
          args={[100, 100, theme.grid.color1 || 0x888888, theme.grid.color2 || 0x888888]} 
          position={[0, -2, 0]} 
        />
      )}
      
      <ambientLight intensity={theme.lighting.ambientIntensity} />
      <pointLight position={[10, 10, 10]} intensity={theme.lighting.pointIntensity} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} />
      {/* 使用本地 HDR 文件作为环境贴图，避免远程加载失败 */}
      <Environment files="/assets/textures/potsdamer_platz_1k.hdr" />

      <InstancedNodes 
        nodesRef={nodesRef} 
        onNodeClick={onNodeClick} 
        onNodeDoubleClick={(node) => focusNodeInternal(node.id)}
        onNodeRightClick={(node) => onNodeCollapse?.(node.id)}
        isDark={isDark} 
        highlightedNodes={highlightedNodes} 
        pulsingNodeIds={pulsingNodeIds}
        lockedNodeIds={props.lockedNodeIds}
        masteredNodeIds={props.masteredNodeIds}
        gamificationEnabled={props.gamificationEnabled}
        simulationVersion={simulationVersion}
      />
      
      <NodeLabels 
        ref={nodeLabelsGroupRef}
        nodesRef={nodesRef} 
        isDark={isDark} 
        highlightedNodes={highlightedNodes} 
        lockedNodeIds={props.lockedNodeIds}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={(node) => focusNodeInternal(node.id)}
        simulationVersion={simulationVersion}
        forceShowAllLabels={isExporting} // Pass the export state
        textDisplayLevel={props.textDisplayLevel}
      />
      
      {/* Main Links */}
      <LinkLines 
        linksRef={linksRef} 
        nodesMapRef={nodesMapRef} 
        isDark={isDark} 
        simulationVersion={simulationVersion}
        opacity={highlightedLinks.size > 0 ? theme.link.highlightOpacity : theme.link.opacity}
      />
      
      {/* Highlighted Links Overlay */}
      {highlightedLinks.size > 0 && (
        <LinkLines 
          linksRef={linksRef}
          links={linksRef.current.filter(l => highlightedLinks.has(l.id))} 
          nodesMapRef={nodesMapRef} 
          isDark={isDark} 
          simulationVersion={simulationVersion}
          opacity={theme.link.opacity} 
        />
      )}

      <CameraController 
        targetPosition={focusTarget?.pos || null} 
        targetLookAt={focusTarget?.lookAt || null} 
      />

      {/* Selection Tool */}
      <BoxSelection 
        nodesRef={nodesRef} 
        onSelectionChange={onSelectionChange || (() => {})} 
        onBoxUpdate={onBoxUpdate}
      />
    </>
  );
});

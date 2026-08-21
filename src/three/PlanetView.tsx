import React, { useMemo, useRef, useState, useCallback, Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Stars, Line, Billboard, Html } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import * as Comlink from 'comlink';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Node, Edge, ColorScheme, GraphColorMode, NodeLevel, type Node as GraphNode } from '../types';
import type { LayoutNode3D, LayoutLink3D, LayoutResult3D } from './layout/forceLayout3D';
import { useTheme } from '../hooks';
import { truncateText } from '../utils/textUtils';
import {
  getLevelColors, getStatusColors, getHeatmapColors, getDecayColors,
  calculateNodeHeat, getLearningStatus
} from '../config/learningStatusColors';

/**
 * Per-node learning status consumed by heatmap / decay / status coloring modes.
 * Field shape mirrors the param types of `getLearningStatus` and
 * `calculateNodeHeat` in `learningStatusColors.ts`, plus `fsrs_retrievability`
 * and `display_mastery` accessed directly by the decay coloring branch.
 */
interface NodeStatus {
  locked: boolean;
  mastered: boolean;
  due_today?: boolean;
  due?: boolean;
  review_count?: number;
  next_review?: string;
  fsrs_retrievability?: number;
  display_mastery?: number;
}

interface PlanetViewProps {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  onNodeClick: (node: GraphNode) => void;
  width?: number;
  height?: number;
  colorScheme?: ColorScheme;
  coloringMode?: GraphColorMode;
  nodeStatus?: Record<string, NodeStatus>;
  focusedNodeId?: string | null;
  enableRotation?: boolean;
}

const NODE_COLORS = Object.freeze({
  selected: new THREE.Color('#FF69B4'),
  hover: new THREE.Color('#98FB98')
});

interface PlanetNodeProps {
  node: LayoutNode3D;
  isDark: boolean;
}

/**
 * Troika Text 实例的最小类型声明（troika-three-text 未提供 TypeScript 类型）。
 * 实际类继承自 THREE.Mesh，这里仅声明 PlanetView 中实际访问的字段。
 */
type TroikaTextMesh = THREE.Mesh & {
  fontSize: number;
  fillOpacity: number;
};

function PlanetNode({
  node,
  isDark,
}: PlanetNodeProps) {
  const { t } = useTranslation();
  const titleTextRef = useRef<TroikaTextMesh>(null);
  const tagTextRef = useRef<TroikaTextMesh>(null);
  const { camera } = useThree();
  const nodePosRef = useRef(new THREE.Vector3(node.x, node.z, node.y));

  // 文字距离 LOD 相关
  const lodLevelRef = useRef(0);
  const titleOpacityRef = useRef(1);
  const tagOpacityRef = useRef(1);

  const baseSize = useMemo(() => {
    const minSize = 3;
    const maxSize = 8;
    return minSize + (node.importance / 5) * (maxSize - minSize);
  }, [node.importance]);

  const tags = useMemo(() => {
    return node.data.properties?.tags || [];
  }, [node.data.properties?.tags]);

  const titleInfo = useMemo(() => truncateText(node.data.title || t('graphEditor.mindMap.unnamed')), [node.data.title, t]);

  useFrame((_, delta) => {
    const distance = camera.position.distanceTo(nodePosRef.current);
    const baseDistance = 200;
    const newScale = Math.max(0.3, Math.min(2, distance / baseDistance));

    // 阈值节流：仅当缩放变化超过 0.05 时才更新 Text fontSize
    if (titleTextRef.current) {
      titleTextRef.current.fontSize = 5 * newScale;
    }
    if (tagTextRef.current) {
      tagTextRef.current.fontSize = 3 * newScale;
    }

    // 文字距离 LOD 计算
    // LOD 0（距离 < 150）：标题 + 标签
    // LOD 1（150 <= 距离 < 350）：仅标题
    // LOD 2（距离 >= 350）：无文字
    let newLod: number;
    if (distance < 150) newLod = 0;
    else if (distance < 350) newLod = 1;
    else newLod = 2;

    if (newLod !== lodLevelRef.current) {
      lodLevelRef.current = newLod;
    }

    // 目标透明度
    const targetTitleOpacity = newLod <= 1 ? 1 : 0;
    const targetTagOpacity = newLod === 0 ? 1 : 0;

    // 平滑过渡（约 0.2 秒），基于帧间隔的 lerp
    const lerpFactor = 1 - Math.pow(0.001, delta);
    titleOpacityRef.current = THREE.MathUtils.lerp(titleOpacityRef.current, targetTitleOpacity, lerpFactor);
    tagOpacityRef.current = THREE.MathUtils.lerp(tagOpacityRef.current, targetTagOpacity, lerpFactor);

    // 直接设置 Text 的 fillOpacity 实现淡入淡出
    if (titleTextRef.current) {
      titleTextRef.current.fillOpacity = titleOpacityRef.current;
    }
    if (tagTextRef.current) {
      tagTextRef.current.fillOpacity = tagOpacityRef.current;
    }
  });

  return (
    <group position={[node.x, node.z, node.y]}>
      <Billboard position={[0, baseSize + 3, 0]}>
        <Text
          ref={titleTextRef}
          position={[0, 0, 0]}
          fontSize={5}
          color={isDark ? '#ffffff' : '#1e293b'}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.3}
          outlineColor={isDark ? '#000000' : '#ffffff'}
        >
          {titleInfo.truncated}
        </Text>
        {tags && tags.length > 0 && (
          <Text
            ref={tagTextRef}
            position={[0, 6, 0]}
            fontSize={3}
            color={isDark ? '#94a3b8' : '#64748b'}
            anchorX="center"
            anchorY="bottom"
          >
            {tags.slice(0, 3).join(' · ')}
          </Text>
        )}
      </Billboard>
    </group>
  );
}

interface PlanetLinkProps {
  source: LayoutNode3D;
  target: LayoutNode3D;
}

function PlanetLink({ source, target }: PlanetLinkProps) {
  const { camera } = useThree();
  // 边线距离 LOD 级别
  // LOD 0（距离 < 200）：贝塞尔曲线（21 点）
  // LOD 1（200 <= 距离 < 500）：直线（2 端点）
  // LOD 2（距离 >= 500）：不渲染
  const [lodLevel, setLodLevel] = useState(0);
  const lodLevelRef = useRef(0);
  const frameCountRef = useRef(0);

  // 边中点位置，用于距离计算
  const midPoint = useMemo(() =>
    new THREE.Vector3(
      (source.x + target.x) / 2,
      (source.z + target.z) / 2,
      (source.y + target.y) / 2
    ), [source, target]);

  useFrame(() => {
    // 每 10 帧检查一次距离，避免每帧计算
    frameCountRef.current++;
    if (frameCountRef.current % 10 !== 0) return;

    const distance = camera.position.distanceTo(midPoint);
    let newLod: number;
    if (distance < 200) newLod = 0;
    else if (distance < 500) newLod = 1;
    else newLod = 2;

    if (newLod !== lodLevelRef.current) {
      lodLevelRef.current = newLod;
      setLodLevel(newLod);
    }
  });

  const points = useMemo(() => {
    if (lodLevel === 1) {
      // 直线：仅 2 个端点
      return [
        [source.x, source.z, source.y] as [number, number, number],
        [target.x, target.z, target.y] as [number, number, number]
      ];
    }
    // LOD 0：贝塞尔曲线（21 点）
    const start: [number, number, number] = [source.x, source.z, source.y];
    const end: [number, number, number] = [target.x, target.z, target.y];
    const mid: [number, number, number] = [
      (source.x + target.x) / 2,
      (source.z + target.z) / 2 + 15,
      (source.y + target.y) / 2
    ];

    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(...start),
      new THREE.Vector3(...mid),
      new THREE.Vector3(...end)
    );
    return curve.getPoints(20).map(p => [p.x, p.y, p.z] as [number, number, number]);
  }, [source, target, lodLevel]);

  // LOD 2：不渲染
  if (lodLevel === 2) return null;

  return (
    <Line
      points={points}
      color="#6366f1"
      lineWidth={1.5}
      transparent
      opacity={0.5}
    />
  );
}

function StarField() {
  return <Stars radius={500} depth={100} count={3000} factor={6} saturation={0} fade speed={0.5} />;
}

function Scene({
  layoutNodes,
  layoutLinks,
  selectedNodeId,
  hoveredNodeId,
  onNodeClick,
  onNodeHover,
  colorScheme,
  coloringMode,
  nodeStatus,
  focusedNodeId,
  isDark,
  enableRotation
}: {
  layoutNodes: LayoutNode3D[];
  layoutLinks: LayoutLink3D[];
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  onNodeClick: (node: LayoutNode3D) => void;
  onNodeHover: (id: string | null) => void;
  colorScheme: ColorScheme;
  coloringMode: GraphColorMode;
  nodeStatus?: Record<string, NodeStatus>;
  focusedNodeId?: string | null;
  isDark: boolean;
  enableRotation: boolean;
}) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const { gl, camera } = useThree();
  const { t } = useTranslation();

  // 共享球体几何体：所有节点复用同一份
  const sharedSphereGeo = useMemo(() => new THREE.SphereGeometry(1, 32, 32), []);

  // 共享材质：所有 instance 复用同一份
  const sharedMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    roughness: 0.5,
    metalness: 0.15,
  }), []);

  // 获取节点颜色：根据着色模式计算
  const getNodeColor = useCallback((nodeId: string, level: number): THREE.Color => {
    const nodeLevel = (level === 0 ? 'root' : level === 1 ? 'core' : level === 2 ? 'sub' : level === 3 ? 'normal' : 'leaf') as NodeLevel;

    if (coloringMode === 'level') {
      const colors = getLevelColors(nodeLevel, isDark);
      return new THREE.Color(colors.primary);
    }

    if (coloringMode === 'heatmap') {
      if (!nodeStatus) {
        const colors = getLevelColors(nodeLevel, isDark);
        return new THREE.Color(colors.primary);
      }
      const heatValue = calculateNodeHeat(nodeStatus[nodeId]);
      const colors = getHeatmapColors(heatValue, isDark);
      return new THREE.Color(colors.primary);
    }

    if (coloringMode === 'decay') {
      if (!nodeStatus) {
        const colors = getLevelColors(nodeLevel, isDark);
        return new THREE.Color(colors.primary);
      }
      const status = nodeStatus[nodeId];
      const displayMastery = status?.display_mastery;
      const retrievability = status?.fsrs_retrievability;
      const decayValue = displayMastery != null
        ? displayMastery
        : (retrievability != null ? retrievability : -1);
      const colors = getDecayColors(decayValue, 'displayMastery', isDark);
      return new THREE.Color(colors.primary);
    }

    // status mode (default)
    if (!nodeStatus) {
      const colors = getLevelColors(nodeLevel, isDark);
      return new THREE.Color(colors.primary);
    }
    const status = getLearningStatus(nodeStatus[nodeId]);
    const colors = getStatusColors(status, isDark, colorScheme);
    return new THREE.Color(colors.primary);
  }, [coloringMode, colorScheme, nodeStatus, isDark]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, LayoutNode3D>();
    layoutNodes.forEach(n => map.set(n.id, n));
    return map;
  }, [layoutNodes]);

  // 视锥体裁剪相关
  const frustumRef = useRef(new THREE.Frustum());
  const projMatrixRef = useRef(new THREE.Matrix4());
  const tempSphereRef = useRef(new THREE.Sphere(new THREE.Vector3(), 1));
  const visibleNodeIdsRef = useRef<Set<string>>(new Set(layoutNodes.map(n => n.id)));
  const prevVisibleIdsRef = useRef<Set<string>>(new Set(layoutNodes.map(n => n.id)));
  const [cullingVersion, setCullingVersion] = useState(0);

  // 根据视锥体裁剪过滤可见节点和边
  const skipCulling = layoutNodes.length <= 50;
  const visibleNodes = useMemo(() => {
    if (skipCulling) return layoutNodes;
    return layoutNodes.filter(n => visibleNodeIdsRef.current.has(n.id));
    // cullingVersion 变化时重新计算
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutNodes, skipCulling, cullingVersion]);

  const visibleLinks = useMemo(() => {
    if (skipCulling) return layoutLinks;
    return layoutLinks.filter(link =>
      visibleNodeIdsRef.current.has(link.source) || visibleNodeIdsRef.current.has(link.target)
    );
    // cullingVersion 变化时重新计算
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutLinks, skipCulling, cullingVersion]);

  // InstancedMesh：合并所有球体为 1 个 draw call
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null);
  // 球体自转全局角度
  const rotationAngleRef = useRef(0);

  // dirtyFlags 机制：标记矩阵和颜色是否需要更新
  const dirtyFlags = useRef({ matrix: true, color: true });

  // 缓存上一帧相机位置，用于检测相机移动
  const prevCameraPosRef = useRef(new THREE.Vector3());

  // useFrame 中复用的临时对象，避免每帧创建触发 GC
  const tempMatrixRef = useRef(new THREE.Matrix4());
  const tempPositionRef = useRef(new THREE.Vector3());
  const tempQuaternionRef = useRef(new THREE.Quaternion());
  const tempScaleRef = useRef(new THREE.Vector3());
  const tempColorRef = useRef(new THREE.Color());
  const tempEulerRef = useRef(new THREE.Euler());
  const tempVisibleIdsRef = useRef(new Set<string>());

  const instancedMesh = useMemo(() => {
    const count = visibleNodes.length;
    const mesh = new THREE.InstancedMesh(sharedSphereGeo, sharedMaterial, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const tempMatrix = new THREE.Matrix4();
    const tempColor = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const node = visibleNodes[i];
      const baseSize = 3 + (node.importance / 5) * 5;

      // 设置位置和缩放
      tempMatrix.makeScale(baseSize, baseSize, baseSize);
      tempMatrix.setPosition(node.x, node.z, node.y);
      mesh.setMatrixAt(i, tempMatrix);

      // 设置颜色
      tempColor.copy(getNodeColor(node.id, node.level));
      mesh.setColorAt(i, tempColor);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.computeBoundingSphere();

    return mesh;
  }, [visibleNodes, getNodeColor, sharedSphereGeo, sharedMaterial]);

  // 释放旧 InstancedMesh 的 GPU 资源（instanceMatrix / instanceColor attribute buffer）
  // 注意：不释放 sharedSphereGeo / sharedMaterial，它们由独立的 useEffect 管理
  useEffect(() => {
    return () => {
      instancedMesh.dispose();
    };
  }, [instancedMesh]);

  // 居中动画相关
  const animationTargetRef = useRef<THREE.Vector3 | null>(null);
  const animationProgressRef = useRef(0);
  const isAnimatingRef = useRef(false);
  const ANIMATION_DURATION = 800; // ms
  const animationStartCameraPosRef = useRef<THREE.Vector3 | null>(null);
  const animationStartTargetPosRef = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (!focusedNodeId) return;
    const targetNode = layoutNodes.find(n => n.id === focusedNodeId);
    if (!targetNode) return;

    // Set animation target: camera should look at the node position
    animationTargetRef.current = new THREE.Vector3(targetNode.x, targetNode.z, targetNode.y);
    animationProgressRef.current = 0;
    isAnimatingRef.current = true;
  }, [focusedNodeId, layoutNodes]);

  // dirtyFlags 标记：颜色相关依赖变化时标记 colorDirty
  useEffect(() => { dirtyFlags.current.color = true; }, [selectedNodeId]);
  useEffect(() => { dirtyFlags.current.color = true; }, [hoveredNodeId]);
  useEffect(() => { dirtyFlags.current.color = true; }, [coloringMode]);
  useEffect(() => { dirtyFlags.current.color = true; }, [nodeStatus]);

  // dirtyFlags 标记：矩阵相关依赖变化时标记 matrixDirty
  useEffect(() => { dirtyFlags.current.matrix = true; }, [visibleNodes]);
  useEffect(() => { dirtyFlags.current.matrix = true; }, [layoutNodes]);

  // 视锥体裁剪 + InstancedMesh 批量更新
  useFrame(({ camera: cam }, delta) => {
    // 居中动画
    if (isAnimatingRef.current && animationTargetRef.current) {
      const deltaMs = delta * 1000;
      animationProgressRef.current = Math.min(1, animationProgressRef.current + deltaMs / ANIMATION_DURATION);

      // Ease out cubic
      const t = animationProgressRef.current;
      const easedT = 1 - Math.pow(1 - t, 3);

      const target = animationTargetRef.current;
      const offset = new THREE.Vector3(80, 60, 80);
      const desiredCameraPos = target.clone().add(offset);

      // Store start positions on first frame
      if (!animationStartCameraPosRef.current) {
        animationStartCameraPosRef.current = camera.position.clone();
        animationStartTargetPosRef.current = controlsRef.current ? controlsRef.current.target.clone() : new THREE.Vector3();
      }

      camera.position.lerpVectors(animationStartCameraPosRef.current, desiredCameraPos, easedT);

      if (controlsRef.current && animationStartTargetPosRef.current) {
        controlsRef.current.target.lerpVectors(animationStartTargetPosRef.current, target, easedT);
        controlsRef.current.update();
      }

      if (t >= 1) {
        isAnimatingRef.current = false;
        animationStartCameraPosRef.current = null;
        animationStartTargetPosRef.current = null;
      }
    }

    // 球体自转角度递增
    if (enableRotation) {
      rotationAngleRef.current += 0.003;
      dirtyFlags.current.matrix = true;
    }

    // 检测相机位置变化，标记矩阵需要更新
    if (!prevCameraPosRef.current.equals(cam.position)) {
      prevCameraPosRef.current.copy(cam.position);
      dirtyFlags.current.matrix = true;
    }

    // 视锥体裁剪逻辑
    if (layoutNodes.length > 50) {
      projMatrixRef.current.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      frustumRef.current.setFromProjectionMatrix(projMatrixRef.current);

      // 复用 Set，避免每帧 new Set 触发 GC
      const newVisibleIds = tempVisibleIdsRef.current;
      newVisibleIds.clear();
      for (let i = 0; i < layoutNodes.length; i++) {
        const n = layoutNodes[i];
        const baseSize = 3 + (n.importance / 5) * 5;
        tempSphereRef.current.center.set(n.x, n.z, n.y);
        tempSphereRef.current.radius = baseSize + 20;
        if (frustumRef.current.intersectsSphere(tempSphereRef.current)) {
          newVisibleIds.add(n.id);
        }
      }

      let changed = newVisibleIds.size !== prevVisibleIdsRef.current.size;
      if (!changed) {
        for (const id of newVisibleIds) {
          if (!prevVisibleIdsRef.current.has(id)) {
            changed = true;
            break;
          }
        }
      }
      if (changed) {
        // 需要新建 Set 作为快照，因为 tempVisibleIdsRef 会被下一帧 clear
        const snapshot = new Set(newVisibleIds);
        visibleNodeIdsRef.current = snapshot;
        prevVisibleIdsRef.current = snapshot;
        setCullingVersion(v => v + 1);
      }
    } else {
      if (visibleNodeIdsRef.current.size !== layoutNodes.length) {
        const allIds = new Set(layoutNodes.map(n => n.id));
        visibleNodeIdsRef.current = allIds;
        prevVisibleIdsRef.current = allIds;
        setCullingVersion(v => v + 1);
      }
    }

    // 批量更新 InstancedMesh 的矩阵和颜色
    const mesh = instancedMeshRef.current;
    if (!mesh) return;

    const count = visibleNodes.length;

    // 矩阵更新
    if (dirtyFlags.current.matrix) {
      const tempMatrix = tempMatrixRef.current;
      const tempPosition = tempPositionRef.current;
      const tempQuaternion = tempQuaternionRef.current;
      const tempScale = tempScaleRef.current;
      const tempEuler = tempEulerRef.current;

      for (let i = 0; i < count; i++) {
        const node = visibleNodes[i];
        const baseSize = 3 + (node.importance / 5) * 5;

        // 计算距离和缩放
        tempPosition.set(node.x, node.z, node.y);
        const distance = cam.position.distanceTo(tempPosition);
        const scaleFactor = Math.max(0.3, Math.min(2, distance / 200));

        // 更新矩阵：位置 + 旋转 + 缩放
        tempScale.set(baseSize * scaleFactor, baseSize * scaleFactor, baseSize * scaleFactor);
        tempEuler.set(0, rotationAngleRef.current, 0);
        tempQuaternion.setFromEuler(tempEuler);
        tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
        mesh.setMatrixAt(i, tempMatrix);
      }

      mesh.instanceMatrix.needsUpdate = true;
      dirtyFlags.current.matrix = false;
    }

    // 颜色更新
    if (dirtyFlags.current.color) {
      const tempColor = tempColorRef.current;

      for (let i = 0; i < count; i++) {
        const node = visibleNodes[i];
        if (node.id === selectedNodeId) {
          tempColor.copy(NODE_COLORS.selected);
        } else if (node.id === hoveredNodeId) {
          tempColor.copy(NODE_COLORS.hover);
        } else {
          tempColor.copy(getNodeColor(node.id, node.level));
        }
        mesh.setColorAt(i, tempColor);
      }

      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      dirtyFlags.current.color = false;
    }
  });

  // Raycaster 交互：hover 和 click
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const hoveredInstanceIdRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = gl.domElement;

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      const mesh = instancedMeshRef.current;
      if (!mesh) return;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const intersects = raycasterRef.current.intersectObject(mesh);

      if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
        const instanceId = intersects[0].instanceId;
        if (instanceId !== hoveredInstanceIdRef.current) {
          hoveredInstanceIdRef.current = instanceId;
          const node = visibleNodes[instanceId];
          if (node) {
            onNodeHover(node.id);
          }
        }
        document.body.style.cursor = 'pointer';
      } else {
        if (hoveredInstanceIdRef.current !== null) {
          hoveredInstanceIdRef.current = null;
          onNodeHover(null);
        }
        document.body.style.cursor = 'default';
      }
    };

    const onClick = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      const mesh = instancedMeshRef.current;
      if (!mesh) return;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const intersects = raycasterRef.current.intersectObject(mesh);

      if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
        const node = visibleNodes[intersects[0].instanceId];
        if (node) {
          onNodeClick(node);
        }
      }
    };

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('click', onClick);

    return () => {
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('click', onClick);
    };
  }, [gl, camera, visibleNodes, onNodeClick, onNodeHover]);

  // hover 悬浮提示：当 hover 节点标题被截断时显示完整标题
  const hoveredNode = useMemo(() => {
    if (!hoveredNodeId) return null;
    return nodeMap.get(hoveredNodeId) ?? null;
  }, [hoveredNodeId, nodeMap]);

  const hoveredTitleInfo = useMemo(() => {
    if (!hoveredNode) return null;
    return truncateText(hoveredNode.data.title || t('graphEditor.mindMap.unnamed'));
  }, [hoveredNode, t]);

  // Scene 卸载时清理共享资源
  useEffect(() => {
    return () => {
      sharedSphereGeo.dispose();
      sharedMaterial.dispose();
    };
  }, [sharedSphereGeo, sharedMaterial]);

  return (
    <>
      <ambientLight intensity={0.8} />
      <pointLight position={[200, 200, 200]} intensity={1.2} />
      <pointLight position={[-200, -100, -200]} intensity={0.6} color="#6366f1" />

      <StarField />

      {/* InstancedMesh：所有球体合并为 1 个 draw call */}
      <primitive object={instancedMesh} ref={instancedMeshRef} />

      {visibleLinks.map((link, index) => {
        const source = nodeMap.get(link.source);
        const target = nodeMap.get(link.target);
        if (!source || !target) return null;
        return (
          <PlanetLink
            key={`${link.source}-${link.target}-${index}`}
            source={source}
            target={target}
          />
        );
      })}

      {visibleNodes.map(node => (
        <PlanetNode
          key={node.id}
          node={node}
          isDark={isDark}
        />
      ))}

      {/* hover 悬浮提示：仅当标题被截断时显示完整标题 */}
      {hoveredNode && hoveredTitleInfo?.isTruncated && (
        <Html
          position={[hoveredNode.x, hoveredNode.z + 3 + (3 + (hoveredNode.importance / 5) * 5) + 10, hoveredNode.y]}
          center
          style={{
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <div
            style={{
              background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              color: isDark ? '#f1f5f9' : '#0f172a',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 500,
              boxShadow: isDark
                ? '0 4px 12px rgba(0, 0, 0, 0.4)'
                : '0 4px 12px rgba(0, 0, 0, 0.15)',
              border: isDark
                ? '1px solid rgba(255, 255, 255, 0.1)'
                : '1px solid rgba(0, 0, 0, 0.1)',
              maxWidth: '300px',
              whiteSpace: 'normal',
              wordBreak: 'break-word',
            }}
          >
            {hoveredTitleInfo.original}
          </div>
        </Html>
      )}

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.05}
        minDistance={30}
        maxDistance={800}
        enablePan
        panSpeed={0.8}
        rotateSpeed={0.8}
        maxPolarAngle={Math.PI * 2}
        minPolarAngle={0}
      />

      <EffectComposer>
        <Bloom
          intensity={0.3}
          luminanceThreshold={0.6}
          luminanceSmoothing={0.9}
        />
      </EffectComposer>
    </>
  );
}

type Planet3DLayoutWorkerApi = {
  calculate3DForceLayout: (
    nodes: Node[],
    edges: Edge[],
    options: { width?: number; height?: number; depth?: number; iterations?: number }
  ) => Promise<LayoutResult3D>;
};

export const PlanetView: React.FC<PlanetViewProps> = ({
  nodes,
  edges,
  selectedNodeId,
  onNodeClick,
  width = 800,
  height = 600,
  colorScheme = 'default',
  coloringMode = 'level',
  nodeStatus,
  focusedNodeId,
  enableRotation = false
}) => {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const ariaLabel = t('graphEditor.planetView.ariaLabel', '3D 星球视图，共 {{count}} 个节点，可拖动旋转与缩放查看节点间关系', { count: nodes.length });

  // 3D layout runs in a Web Worker (comlink) so the main thread stays
  // responsive even for large graphs. The worker is created once; the layout
  // is recomputed whenever the graph or viewport dimensions change.
  const [layout, setLayout] = useState<LayoutResult3D>({ nodes: [], links: [] });
  const [workerReady, setWorkerReady] = useState(false);
  const proxyRef = useRef<Planet3DLayoutWorkerApi | null>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/graphCalculator.worker.ts', import.meta.url),
      { type: 'module' }
    );
    proxyRef.current = Comlink.wrap<Planet3DLayoutWorkerApi>(worker);
    setWorkerReady(true);
    return () => {
      worker.terminate();
      proxyRef.current = null;
    };
  }, []);

  useEffect(() => {
    const proxy = proxyRef.current;
    if (!workerReady || !proxy) return;
    let cancelled = false;
    proxy
      .calculate3DForceLayout(nodes, edges, { width, height, depth: height })
      .then((result) => {
        if (!cancelled && result) {
          setLayout(result);
        }
      })
      .catch((error: unknown) => {
        console.warn('3D force layout computation failed', error);
      });
    return () => {
      cancelled = true;
    };
  }, [workerReady, nodes, edges, width, height]);

  const handleNodeClick = useCallback((node: LayoutNode3D) => {
    onNodeClick(node.data);
  }, [onNodeClick]);

  const handleNodeHover = useCallback((id: string | null) => {
    setHoveredNodeId(id);
  }, []);

  return (
    <div 
      style={{ 
        width: '100%', 
        height: '100%',
        background: isDark 
          ? 'linear-gradient(135deg, #050510 0%, #0a0a1a 50%, #0f0f2a 100%)'
          : 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 50%, #a5b4fc 100%)',
        borderRadius: '8px',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 0,
      }}
    >
      <Canvas
        camera={{ position: [200, 150, 200], fov: 60, near: 0.1, far: 3000 }}
        gl={{ antialias: true, alpha: true }}
        role="img"
        aria-label={ariaLabel}
      >
        <Suspense fallback={null}>
          <Scene
            layoutNodes={layout.nodes}
            layoutLinks={layout.links}
            selectedNodeId={selectedNodeId}
            hoveredNodeId={hoveredNodeId}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
            colorScheme={colorScheme}
            coloringMode={coloringMode}
            nodeStatus={nodeStatus}
            focusedNodeId={focusedNodeId}
            isDark={isDark}
            enableRotation={enableRotation}
          />
        </Suspense>
      </Canvas>
      <div className="sr-only">{ariaLabel}</div>
    </div>
  );
};

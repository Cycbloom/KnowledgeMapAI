import React, { useState, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { SimNode } from '../../config/graphConfig';

interface BoxSelectionProps {
  nodesRef: React.MutableRefObject<SimNode[]>;
  onSelectionChange: (nodeIds: string[]) => void;
  enabled?: boolean;
}

export const BoxSelection = ({ nodesRef, onSelectionChange, enabled = true }: BoxSelectionProps) => {
  const { gl, camera, controls } = useThree();
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [endPos, setEndPos] = useState({ x: 0, y: 0 });
  const [isShiftDown, setIsShiftDown] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftDown(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftDown(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Disable controls when Shift is down
  useEffect(() => {
    if (controls) {
      (controls as any).enabled = !isShiftDown;
    }
  }, [controls, isShiftDown]);

  useEffect(() => {
    if (!isShiftDown || !enabled) return;

    const canvas = gl.domElement;
    
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // Left click only
      e.preventDefault();
      setIsSelecting(true);
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setStartPos({ x, y });
      setEndPos({ x, y });
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isSelecting) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setEndPos({ x, y });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!isSelecting) return;
      setIsSelecting(false);
      
      // Calculate selection
      const rect = canvas.getBoundingClientRect();
      const minX = Math.min(startPos.x, endPos.x);
      const maxX = Math.max(startPos.x, endPos.x);
      const minY = Math.min(startPos.y, endPos.y);
      const maxY = Math.max(startPos.y, endPos.y);

      // Avoid tiny clicks being interpreted as box selection
      if (Math.abs(maxX - minX) < 5 && Math.abs(maxY - minY) < 5) {
        return; 
      }

      const selectedIds: string[] = [];
      const width = rect.width;
      const height = rect.height;

      nodesRef.current.forEach(node => {
        if (typeof node.x !== 'number' || typeof node.y !== 'number') return;
        
        const pos = new THREE.Vector3(node.x, node.y, node.z || 0);
        pos.project(camera); // -1 to 1

        const x = (pos.x * 0.5 + 0.5) * width;
        const y = (-(pos.y * 0.5) + 0.5) * height;

        if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
          selectedIds.push(node.id);
        }
      });

      onSelectionChange(selectedIds);
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isShiftDown, isSelecting, enabled, gl, camera, nodesRef, startPos, endPos]);

  if (!isSelecting) return null;

  const left = Math.min(startPos.x, endPos.x);
  const top = Math.min(startPos.y, endPos.y);
  const width = Math.abs(endPos.x - startPos.x);
  const height = Math.abs(endPos.y - startPos.y);

  return (
    <Html fullscreen style={{ pointerEvents: 'none', zIndex: 100 }}>
      <div 
        style={{
          position: 'absolute',
          left: left,
          top: top,
          width: width,
          height: height,
          border: '1px solid #3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          pointerEvents: 'none'
        }}
      />
    </Html>
  );
};

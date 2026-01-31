import React, { useState, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { SimNode } from '../../config/graphConfig';

interface BoxSelectionProps {
  nodesRef: React.MutableRefObject<SimNode[]>;
  onSelectionChange: (nodeIds: string[]) => void;
  onBoxUpdate?: (box: { left: number; top: number; width: number; height: number } | null) => void;
  enabled?: boolean;
}

export const BoxSelection = ({ nodesRef, onSelectionChange, onBoxUpdate, enabled = true }: BoxSelectionProps) => {
  const { gl, camera, controls } = useThree();
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [endPos, setEndPos] = useState({ x: 0, y: 0 });
  const [isShiftDown, setIsShiftDown] = useState(false);

  useEffect(() => {
    if (!isSelecting && onBoxUpdate) {
      onBoxUpdate(null);
    }
  }, [isSelecting, onBoxUpdate]);

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
      setStartPos({ x: e.clientX, y: e.clientY });
      setEndPos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isSelecting) return;
      e.preventDefault();
      setEndPos({ x: e.clientX, y: e.clientY });
      
      if (onBoxUpdate) {
        const left = Math.min(startPos.x, e.clientX);
        const top = Math.min(startPos.y, e.clientY);
        const width = Math.abs(e.clientX - startPos.x);
        const height = Math.abs(e.clientY - startPos.y);
        onBoxUpdate({ left, top, width, height });
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!isSelecting) return;
      setIsSelecting(false);
      if (onBoxUpdate) onBoxUpdate(null);
      
      // Calculate selection in Client Space
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

      nodesRef.current.forEach(node => {
        if (typeof node.x !== 'number' || typeof node.y !== 'number') return;
        
        const pos = new THREE.Vector3(node.x, node.y, node.z || 0);
        pos.project(camera); // -1 to 1

        // Convert Node NDC to Client Coordinates
        const clientX = (pos.x * 0.5 + 0.5) * rect.width + rect.left;
        const clientY = (-(pos.y * 0.5) + 0.5) * rect.height + rect.top;

        if (clientX >= minX && clientX <= maxX && clientY >= minY && clientY <= maxY) {
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
  }, [isShiftDown, isSelecting, enabled, gl, camera, nodesRef, startPos, endPos, onBoxUpdate]);

  return null;
};

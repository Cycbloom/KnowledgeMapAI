import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface CameraControllerProps {
  targetPosition: THREE.Vector3 | null;
  targetLookAt: THREE.Vector3 | null;
}

export const CameraController = ({ targetPosition, targetLookAt }: CameraControllerProps) => {
  const { camera, gl } = useThree();
  const controlsRef = useRef<any>(null);
  const keysRef = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      keysRef.current.add(e.code);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
  
  useFrame((state, delta) => {
    // 1. Handle Auto-Focus Animation
    if ((targetPosition || targetLookAt) && controlsRef.current) {
      if (targetPosition) {
        camera.position.lerp(targetPosition, 0.05);
      }
      if (targetLookAt) {
        controlsRef.current.target.lerp(targetLookAt, 0.05);
      }
      controlsRef.current.update();
      
      // Only skip manual control if we are actively forcing camera position
      // If we are only rotating target, maybe we still want to allow some control?
      // But for simplicity, let's block manual control during transition to avoid fighting.
      return; 
    }

    // 2. Handle Keyboard Navigation (WASD)
    const keys = keysRef.current;
    if (keys.size > 0 && controlsRef.current) {
      const speed = 30 * delta; // Movement speed
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0; // Move on XZ plane
      forward.normalize();
      
      const right = new THREE.Vector3();
      right.crossVectors(forward, camera.up).normalize();
      
      const move = new THREE.Vector3();
      
      if (keys.has('KeyW')) move.add(forward);
      if (keys.has('KeyS')) move.sub(forward);
      if (keys.has('KeyD')) move.add(right);
      if (keys.has('KeyA')) move.sub(right);
      
      // Vertical movement (Space / Shift + Arrows)
      if (keys.has('Space')) move.y += 1;
      
      // Fix: Shift alone should not move camera (conflicts with selection)
      // User requested Shift + Up/Down for vertical movement
      const isShift = keys.has('ShiftLeft') || keys.has('ShiftRight');
      
      if (isShift) {
        if (keys.has('ArrowUp')) move.y += 1;
        if (keys.has('ArrowDown')) move.y -= 1;
      }

      // Also support Q/E for vertical movement as standard alternative
      if (keys.has('KeyE')) move.y += 1; // Up
      if (keys.has('KeyQ')) move.y -= 1; // Down

      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(speed);
        camera.position.add(move);
        controlsRef.current.target.add(move);
        controlsRef.current.update();
      }
    }
  });

  return <OrbitControls ref={controlsRef} args={[camera, gl.domElement]} makeDefault />;
};

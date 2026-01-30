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
  
  useFrame(() => {
    if (targetPosition && targetLookAt && controlsRef.current) {
      camera.position.lerp(targetPosition, 0.05);
      controlsRef.current.target.lerp(targetLookAt, 0.05);
      controlsRef.current.update();
    }
  });

  return <OrbitControls ref={controlsRef} args={[camera, gl.domElement]} />;
};

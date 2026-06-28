import { useCallback, useState } from "react";
import { message } from "../../../utils/messageHelper";
import type { CustomRegion } from "@shared/types/graph";

/**
 * Manages custom region state and origin position for the quadrant canvas.
 *
 * Extracted from GraphEditor.tsx (P1-13). All dependencies come from internal
 * useState, so this hook takes no parameters.
 */
export const useRegionHandlers = () => {
  const [customRegions, setCustomRegions] = useState<CustomRegion[]>([]);
  const [originPosition, setOriginPosition] = useState({ x: 400, y: 300 });
  const [collapsedRegions, setCollapsedRegions] = useState<string[]>([]);

  const handleCreateRegion = useCallback(
    (region: Omit<CustomRegion, "id" | "createdAt" | "updatedAt">) => {
      const newRegion: CustomRegion = {
        ...region,
        id: `region-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setCustomRegions((prev) => [...prev, newRegion]);
      message.success(`区域「${region.name}」创建成功`);
    },
    [],
  );

  const handleOriginMove = useCallback((position: { x: number; y: number }) => {
    setOriginPosition(position);
  }, []);

  const handleRegionToggle = useCallback((regionId: string) => {
    setCollapsedRegions((prev) => {
      if (prev.includes(regionId)) {
        return prev.filter((id) => id !== regionId);
      } else {
        return [...prev, regionId];
      }
    });
  }, []);

  return {
    customRegions,
    originPosition,
    collapsedRegions,
    setCustomRegions,
    setOriginPosition,
    setCollapsedRegions,
    handleCreateRegion,
    handleRegionToggle,
    handleOriginMove,
  };
};

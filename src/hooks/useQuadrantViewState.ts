import { useState, useCallback, useEffect } from "react";
import type { QuadrantViewState, CustomRegion } from "@shared/types/graph";
import { useGraph } from "./queries/useGraphQueries";
import { useUpdateGraphMutation } from "./mutations/useGraphMutations";

const DEFAULT_ORIGIN_POSITION = { x: 400, y: 300 };

export const useQuadrantViewState = (graphId: string) => {
  const { data: graph } = useGraph(graphId);
  const updateGraphMutation = useUpdateGraphMutation();

  const [collapsedRegions, setCollapsedRegions] = useState<Set<string>>(
    new Set()
  );
  const [originPosition, setOriginPosition] = useState<{ x: number; y: number }>(
    DEFAULT_ORIGIN_POSITION
  );
  const [customRegions, setCustomRegions] = useState<CustomRegion[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (graph?.settings && !isInitialized) {
      const viewState = graph.settings.quadrantViewState as QuadrantViewState | undefined;
      if (viewState) {
        if (viewState.collapsedRegions) {
          setCollapsedRegions(new Set(viewState.collapsedRegions));
        }
        if (viewState.originPosition) {
          setOriginPosition(viewState.originPosition);
        }
        if (viewState.customRegions) {
          setCustomRegions(viewState.customRegions);
        }
      }
      setIsInitialized(true);
    }
  }, [graph?.settings, isInitialized]);

  const saveViewState = useCallback(
    async (state: Partial<QuadrantViewState>) => {
      if (!graphId) return;

      const currentSettings = graph?.settings || {};
      const currentViewState = (currentSettings.quadrantViewState as QuadrantViewState) || {
        originPosition: DEFAULT_ORIGIN_POSITION,
        collapsedRegions: [],
        customRegions: [],
      };

      const newViewState: QuadrantViewState = {
        ...currentViewState,
        ...state,
      };

      try {
        await updateGraphMutation.mutateAsync({
          id: graphId,
          data: {
            settings: {
              ...currentSettings,
              quadrantViewState: newViewState,
            },
          },
        });
      } catch (error) {
        console.error("Failed to save quadrant view state:", error);
      }
    },
    [graphId, graph?.settings, updateGraphMutation]
  );

  const toggleRegion = useCallback(
    (regionId: string) => {
      setCollapsedRegions((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(regionId)) {
          newSet.delete(regionId);
        } else {
          newSet.add(regionId);
        }
        saveViewState({ collapsedRegions: Array.from(newSet) });
        return newSet;
      });
    },
    [saveViewState]
  );

  const updateOriginPosition = useCallback(
    (position: { x: number; y: number }) => {
      setOriginPosition(position);
      saveViewState({ originPosition: position });
    },
    [saveViewState]
  );

  const addCustomRegion = useCallback(
    (region: Omit<CustomRegion, "id" | "createdAt" | "updatedAt">) => {
      const newRegion: CustomRegion = {
        ...region,
        id: `custom-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setCustomRegions((prev) => {
        const newRegions = [...prev, newRegion];
        saveViewState({ customRegions: newRegions });
        return newRegions;
      });
      return newRegion;
    },
    [saveViewState]
  );

  const updateCustomRegion = useCallback(
    (regionId: string, updates: Partial<CustomRegion>) => {
      setCustomRegions((prev) => {
        const newRegions = prev.map((region) =>
          region.id === regionId
            ? { ...region, ...updates, updatedAt: new Date().toISOString() }
            : region
        );
        saveViewState({ customRegions: newRegions });
        return newRegions;
      });
    },
    [saveViewState]
  );

  const removeCustomRegion = useCallback(
    (regionId: string) => {
      setCustomRegions((prev) => {
        const newRegions = prev.filter((region) => region.id !== regionId);
        saveViewState({ customRegions: newRegions });
        return newRegions;
      });
    },
    [saveViewState]
  );

  const expandAllRegions = useCallback(() => {
    setCollapsedRegions(new Set());
    saveViewState({ collapsedRegions: [] });
  }, [saveViewState]);

  const collapseAllRegions = useCallback(
    (allRegionIds: string[]) => {
      const newSet = new Set(allRegionIds);
      setCollapsedRegions(newSet);
      saveViewState({ collapsedRegions: Array.from(newSet) });
    },
    [saveViewState]
  );

  const isRegionCollapsed = useCallback(
    (regionId: string) => collapsedRegions.has(regionId),
    [collapsedRegions]
  );

  return {
    collapsedRegions,
    originPosition,
    customRegions,
    isInitialized,
    toggleRegion,
    updateOriginPosition,
    addCustomRegion,
    updateCustomRegion,
    removeCustomRegion,
    expandAllRegions,
    collapseAllRegions,
    isRegionCollapsed,
  };
};

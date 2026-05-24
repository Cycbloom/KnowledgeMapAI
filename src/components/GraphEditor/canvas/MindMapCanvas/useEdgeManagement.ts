import { useState, useCallback, useMemo } from 'react';
import type { Edge, RelationshipTypeConfig, EdgeLineStyle } from '../../../../types';
import { PRESET_RELATIONSHIP_TYPES } from '../../../../config/relationshipTypes';

interface UseEdgeManagementOptions {
  edges: Edge[];
  onEdgeContextMenu?: (event: React.MouseEvent, edge: Edge) => void;
  onEdgeUpdate?: (edgeId: string, data: Partial<Edge>) => Promise<void>;
  onEdgeDelete?: (edgeId: string) => Promise<void>;
}

export const useEdgeManagement = (options: UseEdgeManagementOptions) => {
  const {
    edges,
    onEdgeContextMenu,
    onEdgeUpdate,
    onEdgeDelete,
  } = options;

  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const relationshipTypes = useMemo<RelationshipTypeConfig[]>(() => {
    return PRESET_RELATIONSHIP_TYPES.map((type) => ({
      ...type,
      id: `preset-${type.name}`,
    }));
  }, []);

  const handleEdgeContextMenu = useCallback(
    (event: React.MouseEvent, link: { id: string }) => {
      event.preventDefault();
      event.stopPropagation();

      const edge = edges.find((e) => e.id === link.id);
      if (edge) {
        if (onEdgeContextMenu) {
          onEdgeContextMenu(event, edge);
        } else {
          setSelectedEdge(edge);
          setContextMenuPosition({ x: event.clientX, y: event.clientY });
        }
      }
    },
    [edges, onEdgeContextMenu],
  );

  const handleEditLabel = useCallback(() => {
    setIsEditDialogOpen(true);
  }, []);

  const handleChangeRelationshipType = useCallback(() => {
    setIsEditDialogOpen(true);
  }, []);

  const handleDeleteEdge = useCallback(async () => {
    if (!selectedEdge || !onEdgeDelete) return;

    try {
      await onEdgeDelete(selectedEdge.id);
      setSelectedEdge(null);
      setContextMenuPosition(null);
    } catch (error) {
      console.error('Failed to delete edge:', error);
    }
  }, [selectedEdge, onEdgeDelete]);

  const handleSaveEdge = useCallback(
    async (data: {
      custom_label?: string;
      relationship_type?: string;
      custom_color?: string;
      custom_line_style?: string;
      show_arrow?: boolean | null;
    }) => {
      if (!selectedEdge || !onEdgeUpdate) return;

      await onEdgeUpdate(selectedEdge.id, {
        custom_label: data.custom_label,
        relationship_type: data.relationship_type,
        custom_color: data.custom_color,
        custom_line_style: data.custom_line_style as EdgeLineStyle,
        show_arrow: data.show_arrow,
      });

      setIsEditDialogOpen(false);
      setSelectedEdge(null);
    },
    [selectedEdge, onEdgeUpdate],
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenuPosition(null);
  }, []);

  const handleCloseEditDialog = useCallback(() => {
    setIsEditDialogOpen(false);
  }, []);

  return {
    selectedEdge,
    contextMenuPosition,
    isEditDialogOpen,
    relationshipTypes,
    handleEdgeContextMenu,
    handleEditLabel,
    handleChangeRelationshipType,
    handleDeleteEdge,
    handleSaveEdge,
    handleCloseContextMenu,
    handleCloseEditDialog,
  };
};
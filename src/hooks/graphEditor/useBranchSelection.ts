import { useCallback } from 'react';
import type { Node, BranchSuggestion, ExplorationPathItem } from '../../types';
import type { HistoricalBranchItem } from './useExplorationState';

interface CreatedBranchNode {
  node: Node;
  suggestion: BranchSuggestion;
  isAccepted: boolean;
}

interface UseBranchSelectionProps {
  id: string | undefined;
  selectedNode: Node | null;
  branchSuggestions: BranchSuggestion[];
  setBranchSuggestions: React.Dispatch<React.SetStateAction<BranchSuggestion[]>>;
  setHistoricalAlternativeBranches: React.Dispatch<React.SetStateAction<HistoricalBranchItem[]>>;
  handleCreateBranch: (suggestion: BranchSuggestion, isAccepted: boolean) => Promise<Node | null>;
  addToPath: (item: Omit<ExplorationPathItem, 'timestamp'>) => void;
  focusNodeWithNode: (node: Node) => void;
}

interface UseBranchSelectionReturn {
  selectBranch: (selectedSuggestion: BranchSuggestion) => Promise<void>;
  switchBranch: (pathItem: ExplorationPathItem | HistoricalBranchItem, selectedSuggestion: BranchSuggestion, parentNode: Node) => Promise<void>;
}

export const useBranchSelection = ({
  id,
  selectedNode,
  branchSuggestions,
  setBranchSuggestions,
  setHistoricalAlternativeBranches,
  handleCreateBranch,
  addToPath,
  focusNodeWithNode,
}: UseBranchSelectionProps): UseBranchSelectionReturn => {
  const selectBranch = useCallback(
    async (selectedSuggestion: BranchSuggestion) => {
      if (!selectedNode || !id) return;

      const suggestionsToCreate = [...branchSuggestions];
      setBranchSuggestions([]);

      const createdNodes: CreatedBranchNode[] = [];

      for (const suggestion of suggestionsToCreate) {
        const isAccepted = suggestion.id === selectedSuggestion.id;
        const newNode = await handleCreateBranch(suggestion, isAccepted);
        if (newNode) {
          createdNodes.push({ node: newNode, suggestion, isAccepted });
        }
      }

      if (createdNodes.length > 0) {
        const selectedNodeData = createdNodes.find((n) => n.isAccepted);
        if (selectedNodeData) {
          addToPath({
            nodeId: selectedNodeData.node.id,
            nodeTitle: selectedNodeData.node.title,
            branchChoice: selectedNodeData.suggestion.title,
            parentNodeId: selectedNode?.id,
            branchSuggestionId: selectedNodeData.suggestion.id,
            alternativeBranches: suggestionsToCreate,
          });
          focusNodeWithNode(selectedNodeData.node);
        }
      }
    },
    [selectedNode, id, branchSuggestions, setBranchSuggestions, handleCreateBranch, addToPath, focusNodeWithNode],
  );

  const switchBranch = useCallback(
    async (pathItem: ExplorationPathItem | HistoricalBranchItem, selectedSuggestion: BranchSuggestion, parentNode: Node) => {
      const branches = pathItem.alternativeBranches || [];
      const createdNodes: CreatedBranchNode[] = [];

      for (const suggestion of branches) {
        const isAccepted = suggestion.id === selectedSuggestion.id;
        const newNode = await handleCreateBranch(suggestion, isAccepted);
        if (newNode) {
          createdNodes.push({ node: newNode, suggestion, isAccepted });
        }
      }

      if (createdNodes.length > 0) {
        const selectedNodeData = createdNodes.find((n) => n.isAccepted);
        if (selectedNodeData) {
          addToPath({
            nodeId: selectedNodeData.node.id,
            nodeTitle: selectedNodeData.node.title,
            branchChoice: selectedNodeData.suggestion.title,
            parentNodeId: parentNode.id,
            branchSuggestionId: selectedNodeData.suggestion.id,
            alternativeBranches: branches,
          });
          setHistoricalAlternativeBranches((prev) => [
            ...prev.filter((item) => item.nodeId !== parentNode.id),
            {
              nodeId: parentNode.id,
              branches,
              selectedBranchId: selectedSuggestion.id,
            },
          ]);
          focusNodeWithNode(selectedNodeData.node);
        }
      }
    },
    [handleCreateBranch, addToPath, setHistoricalAlternativeBranches, focusNodeWithNode],
  );

  return { selectBranch, switchBranch };
};

import { useCallback } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { message } from "../../../utils/messageHelper";
import type { ExtractedConcept } from "../../../types";
import type { UseGraphEditorPanelStateReturn } from "../../../hooks/graphEditor/useGraphEditorPanelState";

interface UseConceptExtractionHandlersParams {
  /** graph id from useParams */
  id: string | undefined;
  /** panel state setters for concept preview / literature extract */
  panelState: Pick<
    UseGraphEditorPanelStateReturn,
    | "setExtractedConcepts"
    | "setIsConceptPreviewOpen"
    | "setIsLiteratureExtractOpen"
  >;
  queryClient: QueryClient;
}

/**
 * Handles literature extraction completion and concept confirmation flow.
 *
 * Extracted from GraphEditor.tsx (P1-13).
 */
export const useConceptExtractionHandlers = ({
  id,
  panelState,
  queryClient,
}: UseConceptExtractionHandlersParams) => {
  const handleLiteratureExtractComplete = useCallback(
    (result: { concepts?: ExtractedConcept[] }) => {
      if (result.concepts && result.concepts.length > 0) {
        panelState.setExtractedConcepts(result.concepts);
        panelState.setIsConceptPreviewOpen(true);
        panelState.setIsLiteratureExtractOpen(false);
      } else {
        message.info("未从文献中提取到概念");
      }
    },
    [panelState],
  );

  const handleConfirmConcepts = useCallback(
    async (selectedConcepts: ExtractedConcept[]) => {
      if (!id || selectedConcepts.length === 0) return;

      try {
        const { literatureApi } = await import("../../../services/api/literature");
        const result = await literatureApi.applyConcepts({
          graph_id: id,
          concepts: selectedConcepts,
          relations: [],
          literature: selectedConcepts[0]?.source || {
            title: "文献来源",
            type: "document",
            processedAt: new Date().toISOString(),
          },
        });

        if (result.success) {
          message.success(
            `已添加 ${result.addedCount} 个概念，合并 ${result.mergedCount} 个相似概念`,
          );
          await queryClient.invalidateQueries({ queryKey: ["graphData", id] });
        }
      } catch (error) {
        console.error("Failed to apply concepts:", error);
        message.error("添加概念失败");
      } finally {
        panelState.setIsConceptPreviewOpen(false);
        panelState.setExtractedConcepts([]);
      }
    },
    [id, queryClient, panelState],
  );

  return {
    handleLiteratureExtractComplete,
    handleConfirmConcepts,
  };
};

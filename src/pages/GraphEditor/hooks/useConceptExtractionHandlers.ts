import { useCallback } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { message } from "../../../utils/messageHelper";
import type { ExtractedConcept } from "../../../types";
import type { UseGraphEditorPanelStateReturn } from "../../../hooks/graphEditor/useGraphEditorPanelState";
import { queryKeys } from "../../../hooks/queries/config";

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
  const { t } = useTranslation();
  const handleLiteratureExtractComplete = useCallback(
    (result: { concepts?: ExtractedConcept[] }) => {
      if (result.concepts && result.concepts.length > 0) {
        panelState.setExtractedConcepts(result.concepts);
        panelState.setIsConceptPreviewOpen(true);
        panelState.setIsLiteratureExtractOpen(false);
      } else {
        message.info(t("graphEditor.noConceptExtracted"));
      }
    },
    [panelState, t],
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
            title: t("graphEditor.conceptExtraction.literatureSource"),
            type: "document",
            processedAt: new Date().toISOString(),
          },
        });

        if (result.success) {
          message.success(
            t("graphEditor.conceptExtraction.addedCountConcepts", {
              addedCount: result.addedCount,
              mergedCount: result.mergedCount,
            }),
          );
          await queryClient.invalidateQueries({ queryKey: queryKeys.graphData(id || "") });
        }
      } catch (error) {
        console.error("Failed to apply concepts:", error);
        message.error(t("graphEditor.addConceptFailed"));
      } finally {
        panelState.setIsConceptPreviewOpen(false);
        panelState.setExtractedConcepts([]);
      }
    },
    [id, queryClient, panelState, t],
  );

  return {
    handleLiteratureExtractComplete,
    handleConfirmConcepts,
  };
};

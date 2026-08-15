import type { Node, Edge, TutorExtractedConcept, TutorMode } from "../../types";
import type { CreateNodeData } from "@shared/types/api";
import { getNextLevel, getLevelColorHex } from "../../utils/graph/graphUtils";
import { HistoryAction } from "./useHistory";
import { GraphEditorState } from "../graphEditor";
import { message } from "../../utils/messageHelper";
import { api } from "../../services/api";
import { useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { UseMutationResult } from "@tanstack/react-query";

interface TutorChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface TutorOperationsMutations {
  createNodeMutation: UseMutationResult<Node, Error, CreateNodeData, unknown>;
  createEdgeMutation: UseMutationResult<Edge, Error, { source_knowledge_point_id: string; target_knowledge_point_id: string; relationship_type: string; graphId?: string }, unknown>;
}

interface UseTutorOperationsProps {
  id: string;
  nodes: Node[];
  edges: Edge[];
  state: GraphEditorState;
  mutations: TutorOperationsMutations;
  record: (action: HistoryAction) => void;
}

export const useTutorOperations = ({
  id,
  nodes,
  edges: _edges,
  state,
  mutations,
  record,
}: UseTutorOperationsProps) => {
  const {
    tutorMode,
    setTutorMode,
    extractedConcepts,
    setExtractedConcepts,
    isTutorMode,
    setIsTutorMode,
    suggestedNextTopics: _suggestedNextTopics,
    setSuggestedNextTopics,
    selectedNode,
    selectedNodeIds,
    setLoading,
  } = state;

  const { createNodeMutation, createEdgeMutation } = mutations;

  const { t } = useTranslation();

  const chatSessionIdRef = useRef<string>(crypto.randomUUID());

  // 预计算根节点，避免多处每次调用都线性扫描 nodes（O(n) 降为一次构建）
  const rootNode = useMemo(
    () => nodes.find((n) => n.level === "root"),
    [nodes],
  );

  const getChatSessionId = useCallback(() => {
    if (!chatSessionIdRef.current) {
      chatSessionIdRef.current = crypto.randomUUID();
    }
    return chatSessionIdRef.current;
  }, []);

  const getModeLabel = useCallback((mode: TutorMode): string => {
    const modeLabels: Record<TutorMode, string> = {
      free: t("tutor.modes.freeTalk"),
      guided: t("tutor.modes.guidedLearning"),
      "learning-path": t("tutor.modes.learningPath"),
      "literature-extract": t("tutor.modes.literatureExtraction"),
      "concept-aggregation": t("tutor.modes.conceptAggregation"),
    };
    return modeLabels[mode];
  }, [t]);

  const handleTutorChat = async (
    userMessage: string,
    history: TutorChatMessage[] = [],
    onChunk: (content: string) => void,
  ) => {
    try {
      const contextNodeIds =
        selectedNodeIds.size > 0
          ? Array.from(selectedNodeIds)
          : selectedNode
            ? [selectedNode.id]
            : [];
      const sessionId = getChatSessionId();

      await api.ai.tutorChatStream(
        {
          message: userMessage,
          graph_id: id,
          history,
          context_node_ids: contextNodeIds,
          mode: tutorMode,
          session_id: sessionId,
        },
        onChunk,
      );
    } catch (error: unknown) {
      console.error("Tutor chat error:", error);
      message.error(t("tutor.messages.tutorChatFailed"));
      throw error;
    }
  };

  const handleExtractConcepts = async (text: string) => {
    setLoading(true);
    try {
      const existingNodes = nodes.map((n) => n.title);

      const result = await api.ai.extractConcepts({
        text,
        existing_nodes: existingNodes,
        max_concepts: 5,
      });

      setExtractedConcepts(result.concepts || []);

      if (result.concepts && result.concepts.length > 0) {
        message.success(t("tutor.messages.conceptsExtracted", { count: result.concepts.length }));
      } else {
        message.info(t("tutor.messages.noConceptsExtracted"));
      }
    } catch (error: unknown) {
      console.error("Extract concepts error:", error);
      message.error(t("tutor.messages.conceptExtractionFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleAddConceptToGraph = async (concept: TutorExtractedConcept) => {
    if (!id) return;
    setLoading(true);

    try {
      const parentNode = selectedNode || rootNode;

      if (!parentNode) {
        message.error(t("tutor.messages.selectParentNodeFirst"));
        return;
      }

      const parentLevel = parentNode.level || "root";
      const newLevel = getNextLevel(parentLevel);

      const angle = Math.random() * Math.PI * 2;
      const radius = 4 + Math.random() * 4;
      const x = Math.round(parentNode.x_position + Math.cos(angle) * radius);
      const y = Math.round(parentNode.y_position + Math.sin(angle) * radius);

      const newNode = await createNodeMutation.mutateAsync({
        graph_id: id,
        title: concept.title,
        content: concept.description,
        x_position: x,
        y_position: y,
        color: getLevelColorHex(newLevel),
        level: newLevel,
        properties: {
          isNew: true,
          source: "tutor-extraction",
        },
      });

      record({ type: "CREATE_NODE", payload: newNode });

      const newEdge = await createEdgeMutation.mutateAsync({
        source_knowledge_point_id: parentNode.id,
        target_knowledge_point_id: newNode.id,
        relationship_type: "contains",
        graphId: id,
      });

      record({ type: "CREATE_EDGE", payload: newEdge });

      setExtractedConcepts((prev) =>
        prev.filter((c) => c.title !== concept.title),
      );

      message.success(t("tutor.messages.conceptAddedToGraph", { title: concept.title }));

      return newNode;
    } catch (error: unknown) {
      console.error("Add concept to graph error:", error);
      message.error(t("tutor.messages.addConceptFailed"));
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleAddAllConcepts = async () => {
    if (extractedConcepts.length === 0) return;

    setLoading(true);
    const addedNodes: Node[] = [];

    try {
      const parentNode = selectedNode || rootNode;

      if (!parentNode) {
        message.error(t("tutor.messages.selectParentNodeFirst"));
        return;
      }

      const parentLevel = parentNode.level || "root";
      const newLevel = getNextLevel(parentLevel);

      for (const concept of extractedConcepts) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 4 + Math.random() * 4;
        const x = Math.round(parentNode.x_position + Math.cos(angle) * radius);
        const y = Math.round(parentNode.y_position + Math.sin(angle) * radius);

        const newNode = await createNodeMutation.mutateAsync({
          graph_id: id,
          title: concept.title,
          content: concept.description,
          x_position: x,
          y_position: y,
          color: getLevelColorHex(newLevel),
          level: newLevel,
          properties: {
            isNew: true,
            source: "tutor-extraction",
          },
        });

        record({ type: "CREATE_NODE", payload: newNode });

        const newEdge = await createEdgeMutation.mutateAsync({
          source_knowledge_point_id: parentNode.id,
          target_knowledge_point_id: newNode.id,
          relationship_type: "contains",
          graphId: id,
        });

        record({ type: "CREATE_EDGE", payload: newEdge });

        addedNodes.push(newNode);
      }

      setExtractedConcepts([]);

      message.success(t("tutor.messages.allConceptsAdded", { count: addedNodes.length }));
    } catch (error: unknown) {
      console.error("Add all concepts error:", error);
      message.error(t("tutor.messages.batchAddConceptsFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestNextTopics = async () => {
    if (!selectedNode) return;
    setLoading(true);

    try {
      const existingNodes = nodes.map((n) => n.title);

      const result = await api.ai.suggestNextTopic({
        node_title: selectedNode.title,
        node_content: selectedNode.content,
        existing_nodes: existingNodes,
        user_progress: {
          mastered_count: nodes.filter((n) => n.level === "root").length,
          due_count: 0,
          current_level: "intermediate",
        },
      });

      setSuggestedNextTopics(result.suggestions || []);

      if (result.suggestions && result.suggestions.length > 0) {
        message.success(t("tutor.messages.learningSuggestionsGenerated", { count: result.suggestions.length }));
      } else {
        message.info(t("common.tutor.empty"));
      }
    } catch (error: unknown) {
      console.error("Suggest next topics error:", error);
      message.error(t("tutor.messages.generateSuggestionsFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchTutorMode = (mode: TutorMode) => {
    setTutorMode(mode);
    setIsTutorMode(true);
    message.info(t("tutor.messages.tutorModeSwitched", { mode: getModeLabel(mode) }));
  };

  const handleToggleTutorMode = () => {
    setIsTutorMode(!isTutorMode);
    if (!isTutorMode) {
      setTutorMode("free");
      message.info(t("tutor.messages.tutorModeEnabled"));
    } else {
      message.info(t("tutor.messages.tutorModeDisabled"));
    }
  };

  return {
    handleTutorChat,
    handleExtractConcepts,
    handleAddConceptToGraph,
    handleAddAllConcepts,
    handleSuggestNextTopics,
    handleSwitchTutorMode,
    handleToggleTutorMode,
  };
};

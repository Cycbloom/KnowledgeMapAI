import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { TermTooltip } from "../components/common";
import { CodeBlock } from "../components/common";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import {
  ArrowLeft,
  BookOpen,
  MessageSquare,
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  GraduationCap,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
  Network,
  Sun,
  Moon,
  Mic,
  MicOff,
  BrainCircuit,
  Home,
  X,
  Plus,
  Route,
  MessageCircle,
  Brain,
  Settings,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLearningSettingsStore } from "../store/useLearningSettingsStore";
import { LearningSettingsPanel } from "../components/Learning/LearningSettingsPanel";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import { frontendEventBus } from "../services/timer/FrontendEventBus";
import {
  useTheme,
  useSpeechRecognition,
  useNetworkStatus,
  useAILanguage,
} from "../hooks";
import { useGraph, useGraphData, useGraphNodeStatus } from "../hooks/queries";
import { useUnifiedTimer } from "../hooks/scheduler";
import { preprocessMarkdown } from "../utils/markdownUtils";
import {
  isAppError,
  isNetworkError,
  isAuthError,
  isValidationError,
} from "../utils/errors";
import { isCapacitorMobile } from "../config/mobileApiConfig";
import { mobileAIService, AICardGenError } from "../services/mobile/aiService";
import { getMobileSupabaseClient } from "../services/mobile/client";
import { GraphOutline } from "../components/GraphEditor/panels/GraphOutline";
import { GenerateCardsModal } from "../components/Learning/GenerateCardsModal";
import { LearningPathPanel } from "../components/Learning/LearningPathPanel";
import { LearningPathOutline } from "../components/Learning/LearningPathOutline";
import { LearningFocusPanel } from "../components/Learning/LearningFocusPanel";
import { GraphOverviewPanel } from "../components/Learning/GraphOverviewPanel";
import { GraphOverviewEditModal } from "../components/Learning/GraphOverviewEditModal";
import { NodeLevel, Keyword } from "../types";
import { useFocusStore } from "../store/useFocusStore";
import { schedulerApi } from "../services/api";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
};

type OutlineMode = "graph" | "learning-path";

export const LearningMode = () => {
  const { t } = useTranslation();
  const { isDark, toggleTheme } = useTheme();
  const { language: aiLanguage } = useAILanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nodeId = searchParams.get("node_id");
  const graphId = searchParams.get("graph_id");

  const [nodeTitle, setNodeTitle] = useState("");
  const [articleContent, setArticleContent] = useState("");
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingCards, setIsGeneratingCards] = useState(false);
  const [isOutlineOpen, setIsOutlineOpen] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(window.innerWidth >= 1280);
  const [isGenModalOpen, setIsGenModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const isOnline = useNetworkStatus();

  const [isCreateNodeModalOpen, setIsCreateNodeModalOpen] = useState(false);
  const [rightPanelMode, setRightPanelMode] = useState<
    "chat" | "learning-path"
  >("chat");
  const [newNodeTitle, setNewNodeTitle] = useState("");
  const [newNodeContent, setNewNodeContent] = useState("");
  const [newNodeLevel, setNewNodeLevel] = useState<NodeLevel>("leaf");
  const [selectedParentNodeId, setSelectedParentNodeId] = useState<string>("");
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(
    new Set(),
  );
  const [outlineMode, setOutlineMode] = useState<OutlineMode>("graph");
  const [selectedLearningPathId, setSelectedLearningPathId] = useState<
    string | null
  >(null);
  const [isFocusModeOpen, setIsFocusModeOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOverviewEditModalOpen, setIsOverviewEditModalOpen] = useState(false);
  const { fontSize, readingMode, contentWidthMode } =
    useLearningSettingsStore();
  const queryClient = useQueryClient();

  const {
    start: startFocusTimer,
    complete: completeFocusTimer,
    taskId: focusTaskId,
    isActive: isFocusTimerActive,
  } = useUnifiedTimer();

  useEffect(() => {
    if (nodeId && !focusTaskId && !isFocusTimerActive) {
      startFocusTimer(nodeId, 25);
    }
  }, [nodeId, focusTaskId, isFocusTimerActive, startFocusTimer]);

  const [generateProgress, setGenerateProgress] = useState<{
    current: number;
    total: number;
    isGenerating: boolean;
  } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { enterFocusMode, exitFocusMode } = useFocusStore();

  const handleSelectLearningPath = (pathId: string) => {
    setSelectedLearningPathId(pathId);
    setOutlineMode("learning-path");
    setSelectedNodeIds(new Set());
  };

  const handleBackToGraphOutline = () => {
    setOutlineMode("graph");
    setSelectedLearningPathId(null);
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isMobile && !nodeId) {
      setIsOutlineOpen(true);
    }
  }, [isMobile, nodeId]);

  const { data: graphData } = useGraphData(graphId || "");
  const { data: graphMeta } = useGraph(graphId || "");
  const { data: _nodeStatus } = useGraphNodeStatus(graphId || "");

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: t("learning.chat.welcome"),
    },
  ]);
  const [input, setInput] = useState("");
  const [inputBeforeVoice, setInputBeforeVoice] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    error: speechError,
    hasRecognitionSupport,
  } = useSpeechRecognition();

  useEffect(() => {
    if (speechError) {
      const isNetworkError = speechError.includes(
        t("learning.speech.networkError"),
      );
      frontendEventBus.publish("message_show", {
        type: "error",
        content: speechError,
        duration: isNetworkError ? 8000 : 5000,
        action: isNetworkError
          ? {
              label: t("learning.speech.viewSolution"),
              onClick: () => {
                alert(t("learning.speech.solutionDetail"));
              },
            }
          : undefined,
      });
    }
  }, [speechError, t]);

  useEffect(() => {
    if (isListening) {
      setInput(
        inputBeforeVoice +
          (inputBeforeVoice && transcript ? " " : "") +
          transcript,
      );
    } else if (transcript) {
      setInput(
        inputBeforeVoice +
          (inputBeforeVoice && transcript ? " " : "") +
          transcript,
      );
    }
  }, [transcript, isListening, inputBeforeVoice]);

  const toggleListening = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!hasRecognitionSupport) {
      frontendEventBus.publish("message_show", {
        type: "warning",
        content: t("learning.speech.notSupported"),
      });
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      setInputBeforeVoice(input);
      startListening();
    }
  };

  const handleGenerateCards = async (targetNodeId: string) => {
    setIsGeneratingCards(true);
    try {
      const result = await api.ai.batchGenerateCards([targetNodeId], {
        count: 10,
        types: [
          "qa",
          "choice",
          "true_false",
          "multi_choice",
          "fill_in_the_blank",
        ],
      });

      if (result.success) {
        frontendEventBus.publish("message_show", {
          type: "success",
          content: t("learning.cards.taskSubmitted"),
          duration: 5000,
          action: {
            label: t("learning.cards.viewTasks"),
            onClick: () => navigate("/tasks"),
          },
        });
      }
    } catch (cardError) {
      console.error("Failed to generate cards:", cardError);
      frontendEventBus.publish("message_show", {
        type: "error",
        content: t("learning.cards.generateFailed"),
      });
    } finally {
      setIsGeneratingCards(false);
    }
  };

  useEffect(() => {
    if (!nodeId) {
      setNodeTitle("");
      setArticleContent("");
      setKeywords([]);
      return;
    }

    const loadData = async () => {
      try {
        setIsGenerating(true);

        const node = await api.nodes.get(nodeId);

        if (!node) {
          frontendEventBus.publish("message_show", {
            type: "error",
            content: t("learning.node.loadFailed"),
          });
          return;
        }

        setNodeTitle(node.title || "");
        setKeywords(node.keywords || []);

        if (
          node.learning_material &&
          node.learning_material.trim().length > 0
        ) {
          setArticleContent(node.learning_material);

          setMessages((prev) => [
            ...prev,
            {
              id: `existing-${Date.now()}`,
              role: "assistant",
              content: t("learning.node.welcomeBack", { title: node.title }),
            },
          ]);
          setIsGenerating(false);
          return;
        }

        const response = await api.ai.generateLearningMaterial({
          topic: node.title || "",
          context: node.content,
          level: node.level,
          graph_id: graphId || undefined,
          language: aiLanguage,
        });

        if (response.content) {
          setArticleContent(response.content);
          const responseKeywords = response.keywords || [];
          setKeywords(responseKeywords);

          try {
            await api.nodes.update(nodeId, {
              learning_material: response.content,
              keywords: responseKeywords,
            });

            frontendEventBus.publish("message_show", {
              type: "success",
              content: t("learning.material.generated"),
              duration: 8000,
              action: {
                label: t("learning.material.generateCards"),
                onClick: () => handleGenerateCards(nodeId),
              },
            });
          } catch (saveError) {
            console.error("Failed to save learning material:", saveError);
            frontendEventBus.publish("message_show", {
              type: "error",
              content: t("learning.material.saveFailed"),
            });
          }

          setMessages((prev) => [
            ...prev,
            {
              id: `generated-${Date.now()}`,
              role: "assistant",
              content: t("learning.material.contentGenerated"),
            },
          ]);
        } else {
          frontendEventBus.publish("message_show", {
            type: "error",
            content: t("learning.material.aiFailed"),
          });
        }
      } catch (error) {
        console.error("Failed to load learning material:", error);
        frontendEventBus.publish("message_show", {
          type: "error",
          content: t("learning.material.generateFailed"),
        });
      } finally {
        setIsGenerating(false);
      }
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isChatLoading) return;

    if (!isOnline) {
      frontendEventBus.publish("message_show", {
        type: "error",
        content: t("learning.chat.offline"),
      });
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsChatLoading(true);

    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    setMessages((prev) => [...prev, assistantMessage]);

    try {
      let fullContent = "";
      const history = messages.map((msg) => ({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      }));

      await api.ai.chatStream(
        {
          message: userMessage.content,
          graph_id: graphId || "",
          history,
          context_node_ids: nodeId ? [nodeId] : undefined,
        },
        (chunk) => {
          fullContent += chunk;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: fullContent }
                : msg,
            ),
          );
        },
      );

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg,
        ),
      );
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: t("learning.chat.error"),
                isStreaming: false,
              }
            : msg,
        ),
      );
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleCreateNode = async () => {
    if (!graphId || !newNodeTitle.trim()) {
      frontendEventBus.publish("message_show", {
        type: "warning",
        content: t("learning.node.enterTitle"),
      });
      return;
    }

    try {
      const newNode = await api.nodes.create({
        graph_id: graphId,
        title: newNodeTitle,
        content: newNodeContent,
        x_position: Math.round((Math.random() - 0.5) * 20),
        y_position: Math.round((Math.random() - 0.5) * 20),
        level: newNodeLevel,
        properties: {},
      });

      if (selectedParentNodeId) {
        await api.edges.create({
          source_knowledge_point_id: selectedParentNodeId,
          target_knowledge_point_id: newNode.id,
          graph_id: graphId,
          relationship_type: "related",
        });
      }

      frontendEventBus.publish("message_show", {
        type: "success",
        content: t("learning.node.createSuccess"),
      });

      setNewNodeTitle("");
      setNewNodeContent("");
      setNewNodeLevel("leaf");
      setSelectedParentNodeId("");
      setIsCreateNodeModalOpen(false);

      queryClient.invalidateQueries({ queryKey: ["graphData", graphId] });
      queryClient.invalidateQueries({
        queryKey: ["graphLearningPath", graphId],
      });

      if (graphData) {
        navigate(`/learning?graph_id=${graphId}&node_id=${newNode.id}`);
      }
    } catch (error) {
      console.error("Failed to create node:", error);
      frontendEventBus.publish("message_show", {
        type: "error",
        content: t("learning.node.createFailed"),
      });
    }
  };

  const handleStartChallenge = async () => {
    if (!nodeId || !graphId) {
      frontendEventBus.publish("message_show", {
        type: "warning",
        content: t("learning.challenge.missingParams"),
      });
      return;
    }

    try {
      let taskId: string;

      const existingTask = await schedulerApi.getTask(nodeId).catch(() => null);

      if (existingTask?.id) {
        taskId = existingTask.id;
      } else {
        const newTask = await schedulerApi.createTask({
          title: nodeTitle || `学习: ${nodeId}`,
          knowledge_point_id: nodeId,
          task_type: "learning",
          queue_level: 1,
          estimated_duration: 30,
        });
        taskId = newTask.id;
      }

      await completeFocusTimer();

      await schedulerApi.createFirstReviewTask({
        knowledge_point_id: nodeId,
        task_id: taskId,
      });

      frontendEventBus.publish("message_show", {
        type: "success",
        content: t("learning.challenge.completed"),
      });
    } catch (error) {
      console.error("Failed to create review task:", error);
    }

    navigate(
      `/study?node_id=${nodeId}&graph_id=${graphId}&mode=quiz&from=learning`,
    );
  };

  const handleRegenerateMaterial = async () => {
    if (!nodeId || !graphId) {
      frontendEventBus.publish("message_show", {
        type: "warning",
        content: t("learning.challenge.missingParams"),
      });
      return;
    }

    if (!isOnline) {
      frontendEventBus.publish("message_show", {
        type: "error",
        content: t("learning.material.regenerateOffline"),
      });
      return;
    }

    setIsGenerating(true);
    setArticleContent("");

    try {
      const node = await api.nodes.get(nodeId);

      const response = await api.ai.generateLearningMaterial({
        topic: node.title || "",
        context: node.content,
        level: node.level,
        graph_id: graphId,
        language: aiLanguage,
      });

      if (response.content) {
        setArticleContent(response.content);
        setKeywords(response.keywords || []);

        await api.nodes.update(nodeId, {
          learning_material: response.content,
          keywords: response.keywords || [],
        });

        queryClient.invalidateQueries({ queryKey: ["graphData", graphId] });

        frontendEventBus.publish("message_show", {
          type: "success",
          content: t("learning.material.regenerated"),
        });

        setMessages((prev) => [
          ...prev,
          {
            id: `regenerated-${Date.now()}`,
            role: "assistant",
            content: t("learning.material.regeneratedMessage"),
          },
        ]);
      }
    } catch (error) {
      console.error("Failed to regenerate learning material:", error);
      frontendEventBus.publish("message_show", {
        type: "error",
        content: t("learning.material.regenerateFailed"),
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleManualGenerateCards = async (config: {
    count: number;
    types: string[];
  }) => {
    if (!nodeId) {
      frontendEventBus.publish("message_show", {
        type: "warning",
        content: t("learning.cards.selectNode"),
      });
      return;
    }

    if (!isOnline) {
      frontendEventBus.publish("message_show", {
        type: "error",
        content: t("learning.cards.offline"),
      });
      return;
    }

    const isMobile = isCapacitorMobile();

    if (isMobile) {
      if (!mobileAIService.isConfigured()) {
        frontendEventBus.publish("message_show", {
          type: "error",
          content: t("learning.cards.configureApiKey"),
          action: {
            label: t("learning.cards.goToSettings"),
            onClick: () => navigate("/settings?tab=ai"),
          },
        });
        return;
      }

      setIsGeneratingCards(true);
      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;

      try {
        const client = getMobileSupabaseClient();
        if (!client) {
          throw new Error("Supabase client not initialized");
        }

        const { data: graphNodes, error: gnError } = await client
          .from("graph_nodes")
          .select(
            `
            knowledge_point_id,
            graph_id,
            knowledge_points (
              id,
              title,
              content
            )
          `,
          )
          .eq("knowledge_point_id", nodeId)
          .is("deleted_at", null);

        if (gnError) {
          console.error("查询 graph_nodes 失败:", gnError);
          frontendEventBus.publish("message_show", {
            type: "error",
            content: t("learning.cards.queryFailed"),
          });
          return;
        }

        if (!graphNodes || graphNodes.length === 0) {
          frontendEventBus.publish("message_show", {
            type: "error",
            content: t("learning.cards.nodeNotFound"),
          });
          return;
        }

        const graphNode = graphNodes[0] as {
          knowledge_point_id: string;
          graph_id: string;
          knowledge_points?: {
            id: string;
            title?: string | null;
            content?: string | null;
          } | null;
        };

        const node = {
          knowledge_point_id: graphNode.knowledge_point_id,
          graph_id: graphNode.graph_id,
          title: graphNode.knowledge_points?.title || "",
          content: graphNode.knowledge_points?.content || "",
        };

        const totalCards = config.count;
        setGenerateProgress({
          current: 0,
          total: totalCards,
          isGenerating: true,
        });

        let generatedCount = 0;
        let savedCount = 0;
        const batchSize = 3;
        const batches = Math.ceil(totalCards / batchSize);

        for (let i = 0; i < batches; i++) {
          if (signal.aborted) {
            frontendEventBus.publish("message_show", {
              type: "info",
              content: t("learning.cards.cancelled", { count: savedCount }),
            });
            break;
          }

          const remainingCards = totalCards - generatedCount;
          const currentBatchSize = Math.min(batchSize, remainingCards);

          setGenerateProgress({
            current: generatedCount,
            total: totalCards,
            isGenerating: true,
          });

          frontendEventBus.publish("message_show", {
            type: "info",
            content: t("learning.cards.generating", {
              start: generatedCount + 1,
              end: generatedCount + currentBatchSize,
              total: totalCards,
            }),
            duration: 3000,
          });

          try {
            const result = await mobileAIService.generateAndSaveCards(
              node.title || "",
              node.content || "",
              node.knowledge_point_id,
              node.graph_id,
              {
                types: config.types,
                count: currentBatchSize,
              },
            );

            if (result.success) {
              generatedCount += currentBatchSize;
              savedCount += result.savedCount;
              setGenerateProgress({
                current: generatedCount,
                total: totalCards,
                isGenerating: true,
              });
            }
          } catch (batchError) {
            console.error(`Batch ${i + 1} failed:`, batchError);
            frontendEventBus.publish("message_show", {
              type: "warning",
              content: t("learning.cards.batchFailed", { batch: i + 1 }),
              duration: 3000,
            });
          }
        }

        if (!signal.aborted && savedCount > 0) {
          frontendEventBus.publish("message_show", {
            type: "success",
            content: t("learning.cards.generateSuccess", { count: savedCount }),
            duration: 5000,
            action: {
              label: t("learning.cards.startChallenge"),
              onClick: handleStartChallenge,
            },
          });
        }
      } catch (error) {
        console.error("[LearningMode] 移动端题目生成异常:", error);

        const isAICardGenError = (err: unknown): err is AICardGenError => {
          return (
            typeof err === "object" &&
            err !== null &&
            "type" in err &&
            "suggestion" in err
          );
        };

        if (isAICardGenError(error)) {
          switch (error.type) {
            case "api_key_missing":
            case "api_key_invalid":
              frontendEventBus.publish("message_show", {
                type: "error",
                content: error.message,
                duration: 8000,
                action: {
                  label: t("learning.cards.goToSettings"),
                  onClick: () => navigate("/settings?tab=ai"),
                },
              });
              break;

            case "quota_exceeded":
              frontendEventBus.publish("message_show", {
                type: "error",
                content: error.message,
                duration: 8000,
              });
              frontendEventBus.publish("message_show", {
                type: "info",
                content: error.suggestion,
                duration: 8000,
              });
              break;

            case "rate_limited":
              frontendEventBus.publish("message_show", {
                type: "warning",
                content: error.message,
                duration: 5000,
                action: {
                  label: t("learning.cards.retryLater"),
                  onClick: () => setIsGenModalOpen(true),
                },
              });
              break;

            case "network_error":
            case "timeout":
              frontendEventBus.publish("message_show", {
                type: "error",
                content: error.message,
                duration: 5000,
                action: {
                  label: t("learning.cards.retry"),
                  onClick: () => handleManualGenerateCards(config),
                },
              });
              break;

            case "database_error":
              frontendEventBus.publish("message_show", {
                type: "error",
                content: error.message,
                duration: 8000,
              });
              frontendEventBus.publish("message_show", {
                type: "info",
                content: error.suggestion,
                duration: 8000,
                action: error.retryable
                  ? {
                      label: t("learning.cards.retry"),
                      onClick: () => handleManualGenerateCards(config),
                    }
                  : undefined,
              });
              break;

            case "invalid_response":
              frontendEventBus.publish("message_show", {
                type: "warning",
                content: error.message,
                duration: 5000,
                action: {
                  label: t("learning.cards.retry"),
                  onClick: () => handleManualGenerateCards(config),
                },
              });
              break;

            default:
              frontendEventBus.publish("message_show", {
                type: "error",
                content: error.message,
                duration: 5000,
              });
          }
        } else {
          let errorMessage = t("learning.cards.generateFailed");
          if (error instanceof Error) {
            errorMessage = error.message;
          }
          frontendEventBus.publish("message_show", {
            type: "error",
            content: errorMessage,
            duration: 5000,
            action: {
              label: t("learning.cards.retry"),
              onClick: () => handleManualGenerateCards(config),
            },
          });
        }
      } finally {
        setIsGeneratingCards(false);
        setGenerateProgress(null);
        abortControllerRef.current = null;
      }
      return;
    }

    setIsGeneratingCards(true);
    try {
      const result = await api.ai.batchGenerateCards([nodeId], {
        count: config.count,
        types: config.types,
      });

      if (result.success) {
        frontendEventBus.publish("message_show", {
          type: "success",
          content: t("learning.cards.taskSubmitted"),
          duration: 5000,
          action: {
            label: t("learning.cards.viewTasks"),
            onClick: () => navigate("/tasks"),
          },
        });
      } else {
        const errorMsg =
          result.message || result.error || t("learning.cards.unknownError");
        console.error("[LearningMode] 任务提交失败:", errorMsg);
        frontendEventBus.publish("message_show", {
          type: "error",
          content: t("learning.cards.submitFailed", { error: errorMsg }),
        });
      }
    } catch (error) {
      console.error("[LearningMode] 题目生成异常:", {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      let errorMessage = t("learning.cards.submitFailedShort");

      if (isNetworkError(error)) {
        errorMessage = t("learning.cards.networkError");
      } else if (isAuthError(error)) {
        errorMessage = t("learning.cards.authError");
      } else if (isValidationError(error)) {
        errorMessage = t("learning.cards.validationError");
      } else if (isAppError(error)) {
        errorMessage = t("learning.cards.submitFailed", {
          error: error.message,
        });
      } else if (error instanceof Error) {
        errorMessage = t("learning.cards.submitFailed", {
          error: error.message,
        });
      }

      frontendEventBus.publish("message_show", {
        type: "error",
        content: errorMessage,
      });
    } finally {
      setIsGeneratingCards(false);
    }
  };

  const handleCancelGenerate = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      frontendEventBus.publish("message_show", {
        type: "info",
        content: t("learning.cards.cancelling"),
      });
    }
  };

  const handleBatchAction = async (
    action: "expand_graph" | "delete" | "batch_generate_questions",
    data?: any,
  ) => {
    const nodeIds = Array.from(selectedNodeIds);
    if (nodeIds.length === 0) {
      frontendEventBus.publish("message_show", {
        type: "warning",
        content: t("learning.batch.selectNodes"),
      });
      return;
    }

    if (action === "delete") {
      try {
        await api.nodes.batchDelete(nodeIds);
        frontendEventBus.publish("message_show", {
          type: "success",
          content: t("learning.batch.deleteSuccess", { count: nodeIds.length }),
        });
        setSelectedNodeIds(new Set());
        queryClient.invalidateQueries({ queryKey: ["graphData", graphId] });
        queryClient.invalidateQueries({
          queryKey: ["graphLearningPath", graphId],
        });
      } catch (error) {
        console.error("Batch delete failed:", error);
        frontendEventBus.publish("message_show", {
          type: "error",
          content: t("learning.batch.deleteFailed"),
        });
      }
    } else if (action === "expand_graph") {
      if (!isOnline) {
        frontendEventBus.publish("message_show", {
          type: "error",
          content: t("learning.batch.expandOffline"),
        });
        return;
      }
      try {
        const result = await api.ai.batchExpandGraph(nodeIds);
        if (result.success) {
          frontendEventBus.publish("message_show", {
            type: "success",
            content: t("learning.batch.expandSuccess", {
              count: nodeIds.length,
            }),
            duration: 5000,
            action: {
              label: t("learning.cards.viewTasks"),
              onClick: () => navigate("/tasks"),
            },
          });
          setSelectedNodeIds(new Set());
        } else {
          frontendEventBus.publish("message_show", {
            type: "error",
            content: t("learning.batch.submitFailed"),
          });
        }
      } catch (error) {
        console.error("Batch expand failed:", error);
        frontendEventBus.publish("message_show", {
          type: "error",
          content: t("learning.batch.expandError"),
        });
      }
    } else if (action === "batch_generate_questions" && data) {
      if (!isOnline) {
        frontendEventBus.publish("message_show", {
          type: "error",
          content: t("learning.cards.offline"),
        });
        return;
      }

      setIsGeneratingCards(true);
      try {
        const result = await api.ai.batchGenerateCards(nodeIds, data);

        if (result.success) {
          frontendEventBus.publish("message_show", {
            type: "success",
            content: t("learning.batch.generateSuccess", {
              count: nodeIds.length,
            }),
            duration: 5000,
            action: {
              label: t("learning.cards.viewTasks"),
              onClick: () => navigate("/tasks"),
            },
          });
          setSelectedNodeIds(new Set());
        } else {
          const errorMsg =
            result.message || result.error || t("learning.cards.unknownError");
          console.error("[LearningMode] 批量生成失败:", errorMsg);
          frontendEventBus.publish("message_show", {
            type: "error",
            content: t("learning.cards.submitFailed", { error: errorMsg }),
          });
        }
      } catch (error) {
        console.error("[LearningMode] 批量生成异常:", {
          error,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        let errorMessage = t("learning.batch.generateFailed");

        if (isNetworkError(error)) {
          errorMessage = t("learning.cards.networkError");
        } else if (isAuthError(error)) {
          errorMessage = t("learning.cards.authError");
        } else if (isValidationError(error)) {
          errorMessage = t("learning.cards.validationError");
        } else if (isAppError(error)) {
          errorMessage = error.message;
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }

        frontendEventBus.publish("message_show", {
          type: "error",
          content: errorMessage,
        });
      } finally {
        setIsGeneratingCards(false);
      }
    }
  };

  return (
    <div
      className={`h-screen flex flex-col ${isDark ? "bg-slate-900 text-slate-100" : "bg-gray-50 text-gray-900"}`}
    >
      {/* Header */}
      <header
        className={`${isMobile && nodeId ? "min-h-14 py-2" : isMobile ? "h-14" : "h-16"} border-b flex items-center justify-between px-3 lg:px-6 flex-shrink-0 ${
          isDark
            ? "bg-slate-900 border-slate-700"
            : "bg-white border-gray-200 shadow-sm"
        }`}
      >
        <div className="flex items-center space-x-2 lg:space-x-4">
          <button
            onClick={() => {
              if (isMobile && nodeId) {
                navigate(`/learning?graph_id=${graphId}`);
              } else {
                window.history.back();
              }
            }}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center p-1.5 lg:p-2 rounded-lg transition-colors ${
              isDark
                ? "hover:bg-slate-800 text-slate-400"
                : "hover:bg-gray-100 text-gray-600"
            }`}
            title={t("learning.header.back")}
          >
            <ArrowLeft size={isMobile ? 18 : 20} />
          </button>

          <button
            onClick={() => navigate("/")}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center p-1.5 lg:p-2 rounded-lg transition-colors ${
              isDark
                ? "hover:bg-slate-800 text-slate-400"
                : "hover:bg-gray-100 text-gray-600"
            }`}
            title={t("learning.header.home")}
          >
            <Home size={isMobile ? 18 : 20} />
          </button>

          <button
            onClick={() => setIsOutlineOpen(!isOutlineOpen)}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded-lg transition-colors hidden lg:block ${
              isDark
                ? "hover:bg-slate-800 text-slate-400"
                : "hover:bg-gray-100 text-gray-600"
            }`}
            title={
              isOutlineOpen
                ? t("learning.header.collapseOutline")
                : t("learning.header.expandOutline")
            }
          >
            {isOutlineOpen ? (
              <PanelLeftClose size={20} />
            ) : (
              <PanelLeftOpen size={20} />
            )}
          </button>

          <div className="flex items-center space-x-2">
            <div
              className={`p-1 rounded-lg ${isDark ? "bg-primary-900/50 text-primary-400" : "bg-primary-50 text-primary-600"}`}
            >
              <BookOpen size={isMobile ? 16 : 20} />
            </div>
            <div className={isMobile && nodeId ? "hidden sm:block" : "block"}>
              <h1 className="font-bold text-sm lg:text-lg whitespace-nowrap">
                {t("learning.header.title")}
              </h1>
              {!isMobile && (
                <p
                  className={`text-[10px] lg:text-xs ${isDark ? "text-slate-500" : "text-gray-500"} truncate max-w-[150px]`}
                >
                  {nodeTitle ||
                    (graphData
                      ? t("learning.header.selectChapter")
                      : t("learning.header.loading"))}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center p-1.5 lg:p-2 rounded-lg transition-colors xl:hidden ${
              isDark
                ? "hover:bg-slate-800 text-slate-400"
                : "hover:bg-gray-100 text-gray-600"
            }`}
            title={
              isChatOpen
                ? t("learning.header.hideAI")
                : t("learning.header.showAI")
            }
          >
            <MessageSquare
              size={isMobile ? 18 : 20}
              className={isChatOpen ? "text-primary-500" : ""}
            />
          </button>
        </div>

        <div
          className={`flex items-center ${isMobile && nodeId ? "gap-1" : "space-x-2 lg:space-x-3"}`}
        >
          <button
            onClick={toggleTheme}
            className={`flex items-center justify-center p-1.5 lg:p-2 rounded-lg transition-colors ${
              isMobile
                ? "min-w-[36px] min-h-[36px]"
                : "min-w-[44px] min-h-[44px]"
            } ${
              isDark
                ? "hover:bg-slate-800 text-amber-400"
                : "hover:bg-gray-100 text-primary-600"
            }`}
            title={
              isDark
                ? t("learning.header.lightMode")
                : t("learning.header.darkMode")
            }
          >
            {isDark ? (
              <Sun size={isMobile ? 18 : 20} />
            ) : (
              <Moon size={isMobile ? 18 : 20} />
            )}
          </button>
          {!isMobile && (
            <button
              onClick={() => setIsSettingsOpen(true)}
              className={`flex items-center justify-center p-1.5 lg:p-2 rounded-lg transition-colors ${
                isMobile
                  ? "min-w-[36px] min-h-[36px]"
                  : "min-w-[44px] min-h-[44px]"
              } ${
                isDark
                  ? "hover:bg-slate-800 text-slate-400"
                  : "hover:bg-gray-100 text-gray-600"
              }`}
              title={t("learning.header.settings")}
            >
              <Settings size={isMobile ? 18 : 20} />
            </button>
          )}

          {!isMobile && (
            <>
              <button
                onClick={() => {
                  if (nodeId && articleContent) {
                    enterFocusMode(nodeId);
                    frontendEventBus.publish("focus_enter", {
                      nodeId,
                      taskId: focusTaskId ?? undefined,
                    });
                    setIsFocusModeOpen(true);
                  }
                }}
                disabled={!nodeId || !articleContent}
                className={`flex items-center space-x-2 px-4 py-2 rounded-full font-medium transition-all ${
                  !nodeId || !articleContent
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600"
                    : isDark
                      ? "bg-primary-900/30 text-primary-400 hover:bg-primary-900/50 border border-primary-500/30"
                      : "bg-primary-50 text-primary-600 hover:bg-primary-100 border border-primary-200"
                }`}
                title={
                  !nodeId || !articleContent
                    ? t("learning.focus.selectContent")
                    : t("learning.focus.enter")
                }
              >
                <Brain size={18} />
                <span className="hidden sm:inline">
                  {t("learning.focus.title")}
                </span>
              </button>
              <button
                onClick={() => {
                  setRightPanelMode("learning-path");
                  setIsChatOpen(true);
                }}
                className={`flex items-center space-x-2 px-4 py-2 rounded-full font-medium transition-all ${
                  rightPanelMode === "learning-path" && isChatOpen
                    ? "bg-primary-600 text-white"
                    : isDark
                      ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                title={t("learning.path.title")}
              >
                <Route size={18} />
                <span className="hidden sm:inline">
                  {t("learning.path.title")}
                </span>
              </button>
              <button
                onClick={() => navigate(`/graph/${graphId}`)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-full font-medium transition-all ${
                  isDark
                    ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                title={t("learning.header.mindMap")}
              >
                <Network size={18} />
                <span className="hidden sm:inline">
                  {t("learning.header.mindMap")}
                </span>
              </button>
            </>
          )}

          {nodeId && (
            <div className="group relative">
              <button
                onClick={() => isOnline && setIsGenModalOpen(true)}
                disabled={!isOnline || generateProgress?.isGenerating}
                className={`flex items-center ${isMobile ? "px-2 py-1.5" : "space-x-2 px-3 lg:px-4 py-2"} rounded-full font-medium transition-all ${
                  !isOnline || generateProgress?.isGenerating
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 dark:bg-slate-800 dark:text-slate-600 dark:border-slate-700"
                    : isDark
                      ? "bg-primary-900/30 text-primary-400 hover:bg-primary-900/50 border border-primary-500/30"
                      : "bg-primary-50 text-primary-600 hover:bg-primary-100 border border-primary-200"
                }`}
                title={
                  isOnline
                    ? t("learning.cards.configure")
                    : t("learning.cards.offlineUnavailable")
                }
              >
                <BrainCircuit size={isMobile ? 16 : 18} />
                <span className="hidden md:inline">
                  {t("learning.cards.generate")}
                </span>
              </button>
              {!isOnline && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-max px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  {t("learning.cards.offlineUnavailable")}
                </div>
              )}
            </div>
          )}

          {nodeId && (
            <div className="flex flex-col items-end">
              {generateProgress?.isGenerating && (
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] text-primary-500 animate-pulse flex items-center gap-1">
                    <Sparkles size={10} />{" "}
                    {t("learning.cards.generatingProgress", {
                      current: generateProgress.current,
                      total: generateProgress.total,
                    })}
                  </span>
                  <button
                    onClick={handleCancelGenerate}
                    className="text-[10px] px-2 py-0.5 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                  >
                    {t("learning.cards.cancel")}
                  </button>
                </div>
              )}
              {isGeneratingCards &&
                !generateProgress?.isGenerating &&
                !isMobile && (
                  <span className="text-[10px] text-primary-500 animate-pulse flex items-center gap-1">
                    <Sparkles size={10} />{" "}
                    {t("learning.cards.generatingChallenge")}
                  </span>
                )}
              <button
                onClick={handleStartChallenge}
                disabled={isGeneratingCards}
                className={`flex items-center justify-center ${isMobile ? "p-2" : "space-x-2 px-3 lg:px-6 py-2"} bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-700 hover:to-violet-700 text-white rounded-full font-bold shadow-lg shadow-primary-200 dark:shadow-none transition-all ${isMobile ? "" : "hover:scale-105 active:scale-95"} ${
                  isGeneratingCards ? "opacity-70 cursor-not-allowed" : ""
                }`}
                title={t("learning.challenge.start")}
              >
                <GraduationCap size={isMobile ? 18 : 18} />
                <span className="hidden sm:inline">
                  {t("learning.challenge.complete")}
                </span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content - Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Outline Sidebar */}
        <div
          className={`${
            isMobile
              ? !nodeId
                ? "w-full"
                : "w-0"
              : isOutlineOpen
                ? "w-80"
                : "w-0"
          } transition-all duration-300 ease-in-out border-r dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 relative`}
        >
          <div className={`absolute inset-0 ${isMobile ? "w-full" : "w-80"}`}>
            {outlineMode === "learning-path" && selectedLearningPathId ? (
              <LearningPathOutline
                learningPathId={selectedLearningPathId}
                currentNodeId={nodeId || undefined}
                onNodeClick={(nodeId) =>
                  navigate(`/learning?graph_id=${graphId}&node_id=${nodeId}`)
                }
                onBackToGraph={handleBackToGraphOutline}
                className="h-full border-none"
              />
            ) : graphData ? (
              <GraphOutline
                nodes={graphData.nodes}
                edges={graphData.edges}
                onNodeClick={(node) =>
                  navigate(`/learning?graph_id=${graphId}&node_id=${node.id}`)
                }
                selectedNodeId={nodeId}
                selectedNodeIds={selectedNodeIds}
                onSelectionChange={setSelectedNodeIds}
                onBatchAction={handleBatchAction}
                onAddNode={() => setIsCreateNodeModalOpen(true)}
                className="h-full border-none"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                <Loader2 className="animate-spin mr-2" />
                {t("learning.header.loading")}
              </div>
            )}
          </div>
        </div>

        {/* Content Area */}
        {nodeId ? (
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="flex-1 flex overflow-hidden">
              {/* Left: Article Reader */}
              <div
                className={`flex-1 overflow-y-auto custom-scrollbar ${isMobile ? "p-4" : "p-8 lg:p-12"} border-r dark:border-slate-800 relative bg-white dark:bg-slate-900`}
              >
                {isGenerating ? (
                  <div
                    className={`flex flex-col items-center justify-center h-full space-y-6 text-center ${isMobile ? "pt-8" : ""}`}
                  >
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Sparkles
                          size={24}
                          className="text-primary-600 animate-pulse"
                        />
                      </div>
                    </div>
                    <div>
                      <h3
                        className={`text-xl font-bold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}
                      >
                        {t("learning.material.generating")}
                      </h3>
                      <p
                        className={isDark ? "text-slate-400" : "text-gray-500"}
                      >
                        {t("learning.material.generatingTopic", {
                          title: nodeTitle,
                        })}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="w-full">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-slate-700">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() =>
                            navigate(`/learning?graph_id=${graphId}`)
                          }
                          className={`flex items-center gap-1 px-2 py-1 text-sm rounded-lg transition-colors ${
                            isDark
                              ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                              : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                          }`}
                          title={t("learning.overview.back")}
                        >
                          <ArrowLeft size={16} />
                          <span className="hidden sm:inline">
                            {t("learning.overview.title")}
                          </span>
                        </button>
                        <div>
                          <h2
                            className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}
                          >
                            {nodeTitle}
                          </h2>
                          {keywords.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {keywords.slice(0, 5).map((kw, idx) => (
                                <span
                                  key={idx}
                                  className={`px-2 py-0.5 text-xs rounded-full ${
                                    isDark
                                      ? "bg-primary-900/30 text-primary-300"
                                      : "bg-primary-50 text-primary-600"
                                  }`}
                                >
                                  {kw.term}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleRegenerateMaterial}
                          disabled={isGenerating || !isOnline}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            isGenerating || !isOnline
                              ? "bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600"
                              : isDark
                                ? "bg-primary-900/30 text-primary-400 hover:bg-primary-900/50 border border-primary-500/30"
                                : "bg-primary-50 text-primary-600 hover:bg-primary-100 border border-primary-200"
                          }`}
                          title={
                            isOnline
                              ? t("learning.material.regenerate")
                              : t("learning.cards.offlineUnavailable")
                          }
                        >
                          <RefreshCw
                            size={16}
                            className={isGenerating ? "animate-spin" : ""}
                          />
                          <span className="hidden sm:inline">
                            {t("learning.material.regenerate")}
                          </span>
                        </button>
                      </div>
                    </div>
                    <div
                      className={`prose dark:prose-invert prose-indigo ${
                        contentWidthMode === "full"
                          ? "max-w-none"
                          : contentWidthMode === "comfortable"
                            ? "max-w-4xl mx-auto"
                            : "max-w-3xl mx-auto"
                      } ${
                        readingMode === "default"
                          ? isDark
                            ? "bg-slate-900 text-slate-50"
                            : "bg-white text-gray-900"
                          : readingMode === "eye-care"
                            ? "bg-amber-50 text-gray-800"
                            : "bg-slate-900 text-slate-50"
                      }`}
                      style={{ fontSize: `${fontSize}px` }}
                    >
                      <div
                        className={isMobile ? "leading-relaxed space-y-4" : ""}
                      >
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[[rehypeKatex, { output: "html" }]]}
                          components={{
                            code: ({ className, children, node: _node }) => (
                              <CodeBlock
                                className={className}
                                isDark={isDark || readingMode === "dark"}
                                node={_node}
                              >
                                {children}
                              </CodeBlock>
                            ),
                            a: ({ node: _node, ...props }) => {
                              const { href, children } = props;
                              if (href && href.startsWith("term:")) {
                                const explanation = href.replace("term:", "");
                                return (
                                  <TermTooltip
                                    term={String(children)}
                                    explanation={decodeURIComponent(
                                      explanation,
                                    )}
                                  />
                                );
                              }
                              return (
                                <a
                                  {...props}
                                  className="text-primary-600 hover:underline"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                />
                              );
                            },
                          }}
                        >
                          {preprocessMarkdown(articleContent)}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div
            className={`${isMobile ? "hidden" : "flex-1"} flex flex-col overflow-hidden`}
          >
            <GraphOverviewPanel
              graph={graphMeta || null}
              onEdit={() => setIsOverviewEditModalOpen(true)}
            />
          </div>
        )}

        {/* Right: AI Tutor */}
        <AnimatePresence>
          {isChatOpen && (
            <>
              {/* Mobile Backdrop */}
              {isMobile && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsChatOpen(false)}
                  className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
                />
              )}
              <motion.div
                initial={isMobile ? { x: "100%" } : { width: 0, opacity: 0 }}
                animate={isMobile ? { x: 0 } : { width: 384, opacity: 1 }}
                exit={isMobile ? { x: "100%" } : { width: 0, opacity: 0 }}
                transition={{
                  type: "spring",
                  damping: 25,
                  stiffness: 200,
                }}
                className={`
                  ${isMobile ? "fixed inset-y-0 right-0 z-50 w-[85%] max-w-sm shadow-2xl" : "relative h-full border-l"} 
                  flex flex-col dark:border-slate-800 ${isDark ? "bg-slate-900" : "bg-white"}
                `}
              >
                {/* Chat Header */}
                <div className="p-4 border-b dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-primary-600 dark:text-primary-400">
                      {rightPanelMode === "chat" ? (
                        <Bot size={18} />
                      ) : (
                        <Route size={18} />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">
                        {rightPanelMode === "chat"
                          ? t("learning.chat.aiTutor")
                          : t("learning.path.title")}
                      </h3>
                      <div className="flex items-center text-[10px] text-green-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1"></span>
                        {rightPanelMode === "chat"
                          ? t("learning.chat.online")
                          : t("learning.path.aiDriven")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="flex gap-1 mr-2">
                      <button
                        onClick={() => setRightPanelMode("chat")}
                        className={`p-1.5 rounded-md transition-colors ${
                          rightPanelMode === "chat"
                            ? "bg-primary-500 text-white"
                            : isDark
                              ? "hover:bg-slate-700 text-slate-400"
                              : "hover:bg-gray-100 text-gray-500"
                        }`}
                        title={t("learning.chat.aiTutor")}
                      >
                        <MessageCircle size={14} />
                      </button>
                      <button
                        onClick={() => setRightPanelMode("learning-path")}
                        className={`p-1.5 rounded-md transition-colors ${
                          rightPanelMode === "learning-path"
                            ? "bg-primary-500 text-white"
                            : isDark
                              ? "hover:bg-slate-700 text-slate-400"
                              : "hover:bg-gray-100 text-gray-500"
                        }`}
                        title={t("learning.path.title")}
                      >
                        <Route size={14} />
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        if (rightPanelMode === "chat") {
                          setMessages([
                            {
                              id: "welcome",
                              role: "assistant",
                              content: t("learning.chat.welcomeShort"),
                            },
                          ]);
                        }
                      }}
                      className={`p-1.5 rounded-md transition-colors ${isDark ? "hover:bg-slate-700 text-slate-400" : "hover:bg-gray-100 text-gray-500"}`}
                      title={
                        rightPanelMode === "chat"
                          ? t("learning.chat.clear")
                          : t("learning.path.refresh")
                      }
                    >
                      <RefreshCw size={14} />
                    </button>
                    <button
                      onClick={() => setIsChatOpen(false)}
                      className={`p-1.5 rounded-md transition-colors ${isDark ? "hover:bg-slate-700 text-slate-400" : "hover:bg-gray-100 text-gray-500"}`}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {rightPanelMode === "learning-path" ? (
                    <div className="p-4">
                      <LearningPathPanel
                        graphId={graphId || ""}
                        onNodeSelect={(nodeId) => {
                          navigate(
                            `/learning?graph_id=${graphId}&node_id=${nodeId}`,
                          );
                        }}
                        onPathSelect={handleSelectLearningPath}
                        selectedPathId={selectedLearningPathId}
                      />
                    </div>
                  ) : (
                    <div className="p-4 space-y-4">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`flex max-w-[90%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"} items-start gap-2`}
                          >
                            <div
                              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                                msg.role === "user"
                                  ? "bg-primary-600 text-white"
                                  : isDark
                                    ? "bg-slate-800 text-primary-400 border border-slate-700"
                                    : "bg-white text-primary-600 border border-gray-100 shadow-sm"
                              }`}
                            >
                              {msg.role === "user" ? (
                                <User size={16} />
                              ) : (
                                <Bot size={16} />
                              )}
                            </div>
                            <div
                              className={`p-3 rounded-2xl text-sm leading-relaxed ${
                                msg.role === "user"
                                  ? "bg-primary-600 text-white rounded-tr-none"
                                  : isDark
                                    ? "bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700"
                                    : "bg-gray-50 text-gray-800 rounded-tl-none border border-gray-100"
                              }`}
                            >
                              {msg.isStreaming && !msg.content ? (
                                <div className="flex items-center space-x-2">
                                  <div
                                    className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce"
                                    style={{ animationDelay: "0ms" }}
                                  ></div>
                                  <div
                                    className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce"
                                    style={{ animationDelay: "150ms" }}
                                  ></div>
                                  <div
                                    className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce"
                                    style={{ animationDelay: "300ms" }}
                                  ></div>
                                </div>
                              ) : (
                                <div
                                  className={
                                    msg.role === "user"
                                      ? "text-white"
                                      : "prose prose-sm dark:prose-invert prose-indigo max-w-none"
                                  }
                                >
                                  <ReactMarkdown
                                    remarkPlugins={[remarkGfm, remarkMath]}
                                    rehypePlugins={[
                                      [rehypeKatex, { output: "html" }],
                                    ]}
                                    components={{
                                      code: ({
                                        className,
                                        children,
                                        node: _node,
                                      }) => (
                                        <CodeBlock
                                          className={className}
                                          isDark={isDark}
                                          node={_node}
                                        >
                                          {children}
                                        </CodeBlock>
                                      ),
                                      a: ({ node: _node, ...props }) => {
                                        const { href, children } = props;
                                        if (href && href.startsWith("term:")) {
                                          const explanation = href.replace(
                                            "term:",
                                            "",
                                          );
                                          return (
                                            <TermTooltip
                                              term={String(children)}
                                              explanation={decodeURIComponent(
                                                explanation,
                                              )}
                                            />
                                          );
                                        }
                                        return msg.role === "user" ? (
                                          <a
                                            {...props}
                                            className="text-white/80 hover:text-white hover:underline"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                          />
                                        ) : (
                                          <a
                                            {...props}
                                            className="text-primary-600 hover:underline"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                          />
                                        );
                                      },
                                    }}
                                  >
                                    {msg.role === "assistant"
                                      ? preprocessMarkdown(msg.content)
                                      : msg.content}
                                  </ReactMarkdown>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                {/* Chat Input - Only show in chat mode */}
                {rightPanelMode === "chat" && (
                  <div className="p-4 border-t dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                    <form onSubmit={handleChatSubmit} className="relative">
                      <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleChatSubmit(e);
                          }
                        }}
                        placeholder={t("learning.chat.placeholder")}
                        className={`w-full p-3 pr-20 pl-4 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all ${
                          isDark
                            ? "bg-slate-800 text-white placeholder-slate-500 border-slate-700"
                            : "bg-white text-gray-900 placeholder-gray-400 border-gray-200"
                        } border`}
                        rows={2}
                      />
                      <div className="absolute right-2 bottom-2 flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={toggleListening}
                          className={`p-2 rounded-lg transition-all ${
                            isListening
                              ? "bg-red-500 text-white animate-pulse"
                              : isDark
                                ? "text-slate-400 hover:bg-slate-700 hover:text-primary-400"
                                : "text-gray-400 hover:bg-gray-100 hover:text-primary-600"
                          }`}
                          title={
                            isListening
                              ? t("learning.speech.stop")
                              : t("learning.speech.start")
                          }
                        >
                          {isListening ? (
                            <Mic size={18} />
                          ) : (
                            <MicOff size={18} />
                          )}
                        </button>
                        <button
                          type="submit"
                          disabled={!input.trim() || isChatLoading}
                          className={`p-2 rounded-lg transition-all ${
                            input.trim() && !isChatLoading
                              ? "bg-primary-600 text-white shadow-lg shadow-primary-500/30"
                              : "bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-700 dark:text-slate-500"
                          }`}
                        >
                          {isChatLoading ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <Send size={18} />
                          )}
                        </button>
                      </div>
                    </form>
                    <p
                      className={`text-[10px] mt-2 text-center ${isDark ? "text-slate-500" : "text-gray-400"}`}
                    >
                      {t("learning.chat.disclaimer")}
                    </p>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
      {/* Modal */}
      <GenerateCardsModal
        isOpen={isGenModalOpen}
        onClose={() => setIsGenModalOpen(false)}
        onGenerate={handleManualGenerateCards}
        nodeTitle={nodeTitle}
        generateProgress={generateProgress}
      />

      {/* Create Node Modal */}
      {isCreateNodeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div
            className={`${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200"} rounded-xl shadow-2xl w-full max-w-md mx-4 border`}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3
                  className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}
                >
                  {t("learning.node.createTitle")}
                </h3>
                <button
                  onClick={() => setIsCreateNodeModalOpen(false)}
                  className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-slate-700 text-slate-400" : "hover:bg-gray-100 text-gray-500"}`}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    {t("learning.node.titleLabel")}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newNodeTitle}
                    onChange={(e) => setNewNodeTitle(e.target.value)}
                    placeholder={t("learning.node.titlePlaceholder")}
                    className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all ${
                      isDark
                        ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                        : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
                    }`}
                  />
                </div>

                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    {t("learning.node.contentLabel")}
                  </label>
                  <textarea
                    value={newNodeContent}
                    onChange={(e) => setNewNodeContent(e.target.value)}
                    placeholder={t("learning.node.contentPlaceholder")}
                    rows={4}
                    className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all resize-none ${
                      isDark
                        ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                        : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
                    }`}
                  />
                </div>

                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    {t("learning.node.levelLabel")}
                  </label>
                  <select
                    value={newNodeLevel}
                    onChange={(e) =>
                      setNewNodeLevel(e.target.value as NodeLevel)
                    }
                    className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all ${
                      isDark
                        ? "bg-slate-700 border-slate-600 text-white"
                        : "bg-white border-gray-300 text-gray-900"
                    }`}
                  >
                    <option value="root">{t("learning.node.levelRoot")}</option>
                    <option value="core">{t("learning.node.levelCore")}</option>
                    <option value="sub">{t("learning.node.levelSub")}</option>
                    <option value="normal">
                      {t("learning.node.levelNormal")}
                    </option>
                    <option value="leaf">{t("learning.node.levelLeaf")}</option>
                  </select>
                </div>

                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    {t("learning.node.parentLabel")}
                  </label>
                  <select
                    value={selectedParentNodeId}
                    onChange={(e) => setSelectedParentNodeId(e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all ${
                      isDark
                        ? "bg-slate-700 border-slate-600 text-white"
                        : "bg-white border-gray-300 text-gray-900"
                    }`}
                  >
                    <option value="">{t("learning.node.noParent")}</option>
                    {graphData?.nodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setIsCreateNodeModalOpen(false)}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                    isDark
                      ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {t("learning.node.cancel")}
                </button>
                <button
                  onClick={handleCreateNode}
                  disabled={!newNodeTitle.trim()}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                    !newNodeTitle.trim()
                      ? "opacity-50 cursor-not-allowed"
                      : "bg-primary-600 text-white hover:bg-primary-700"
                  }`}
                >
                  <Plus size={18} />
                  {t("learning.node.createButton")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <LearningFocusPanel
        isOpen={isFocusModeOpen}
        onClose={() => {
          setIsFocusModeOpen(false);
          exitFocusMode();
          frontendEventBus.publish("focus_exit", {
            nodeId: nodeId ?? undefined,
          });
        }}
        articleContent={articleContent}
        nodeTitle={nodeTitle}
        isMobile={isMobile}
        keywords={keywords}
      />

      <LearningSettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        initialScenarioId="learning_material"
        graphId={graphId || undefined}
      />
      <GraphOverviewEditModal
        isOpen={isOverviewEditModalOpen}
        onClose={() => setIsOverviewEditModalOpen(false)}
        graph={graphMeta || null}
        onSave={async (data) => {
          if (!graphMeta) return;
          try {
            await api.graphs.update(graphMeta.id, data);
            queryClient.invalidateQueries({ queryKey: ["graph", graphId] });
            setIsOverviewEditModalOpen(false);
          } catch (error) {
            console.error("Failed to save graph overview:", error);
          }
        }}
      />
    </div>
  );
};

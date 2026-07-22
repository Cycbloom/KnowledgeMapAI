import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { realtimeQueryConfig, DEFAULT_STALE_TIME, GC_TIME } from "./config";
import type {
  CreateQuizSetData,
  UpdateQuizSetData,
  GenerateQuizData,
  QuizGenerationProgress,
  RegenerateCardData,
  CardType,
} from "@shared/types/quiz";

export const quizQueryKeys = {
  quizSets: ["quizSets"] as const,
  quizSet: (id: string) => ["quizSet", id] as const,
  quizGenerationProgress: (taskId: string) => ["quizGenerationProgress", taskId] as const,
};

export const useQuizSets = () => {
  return useQuery({
    queryKey: quizQueryKeys.quizSets,
    queryFn: () => api.quiz.list(),
    staleTime: DEFAULT_STALE_TIME,
    gcTime: GC_TIME,
  });
};

export const useQuizSet = (id: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: quizQueryKeys.quizSet(id),
    queryFn: () => api.quiz.get(id),
    enabled: enabled && !!id,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: GC_TIME,
  });
};

export const useQuizGenerationProgress = (taskId: string | null, enabled: boolean = true) => {
  return useQuery({
    queryKey: quizQueryKeys.quizGenerationProgress(taskId || ""),
    queryFn: () => {
      if (!taskId) throw new Error("taskId is required");
      return api.quiz.getGenerationProgress(taskId);
    },
    enabled: enabled && !!taskId,
    ...realtimeQueryConfig,
    refetchInterval: (query) => {
      const data = query.state.data as QuizGenerationProgress | undefined;
      if (!data) return 1000;
      if (data.status === "completed" || data.status === "failed") return false;
      return 1000;
    },
  });
};

export const useCreateQuizSetMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateQuizSetData) => api.quiz.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quizQueryKeys.quizSets });
    },
  });
};

export const useUpdateQuizSetMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateQuizSetData }) =>
      api.quiz.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: quizQueryKeys.quizSets });
      queryClient.invalidateQueries({ queryKey: quizQueryKeys.quizSet(variables.id) });
    },
  });
};

export const useDeleteQuizSetMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.quiz.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quizQueryKeys.quizSets });
    },
  });
};

export const useGenerateQuizMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: GenerateQuizData) => api.quiz.generate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quizQueryKeys.quizSets });
    },
  });
};

export const useRegenerateCardMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      quizSetId,
      cardId,
      data,
    }: {
      quizSetId: string;
      cardId: string;
      data?: { card_type?: CardType; custom_prompt?: string };
    }) => api.quiz.regenerateCard(quizSetId, cardId, data as RegenerateCardData | undefined),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: quizQueryKeys.quizSet(variables.quizSetId) });
    },
  });
};

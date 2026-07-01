import { useState, useCallback, useRef } from "react";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  timestamp: Date;
  isStreaming?: boolean;
}

export interface Source {
  id: string;
  title: string;
  content: string;
  similarity: number;
  relationshipPath?: string;
  hopDistance?: number;
}

export interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export interface ChatState {
  messages: Message[];
  input: string;
  isLoading: boolean;
  suggestedQuestions: string[];
  currentSpeakingMessageId: string | null;
  isResizing: boolean;
  sessionId: string;
}

export interface EditAndResendResult {
  newContent: string;
  history: ChatHistoryItem[];
}

export const useChatState = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [currentSpeakingMessageId, setCurrentSpeakingMessageId] = useState<
    string | null
  >(null);
  const [isResizing, setIsResizing] = useState(false);
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());

  const abortControllerRef = useRef<AbortController | null>(null);

  const addMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg)),
    );
  }, []);

  const removeMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== id));
  }, []);

  const clearInput = useCallback(() => {
    setInput("");
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setSuggestedQuestions([]);
    setSessionId(crypto.randomUUID());
  }, []);

  const setSuggestedQuestionsWrapper = useCallback((questions: string[]) => {
    setSuggestedQuestions(questions);
  }, []);

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  const editAndResend = useCallback(
    (messageId: string, newContent: string): EditAndResendResult | null => {
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx === -1) return null;
      const history: ChatHistoryItem[] = messages
        .slice(0, idx)
        .map((m) => ({ role: m.role, content: m.content }));
      setMessages((prev) => {
        const i = prev.findIndex((m) => m.id === messageId);
        if (i === -1) return prev;
        return prev
          .map((m) => (m.id === messageId ? { ...m, content: newContent } : m))
          .slice(0, i + 1);
      });
      return { newContent, history };
    },
    [messages],
  );

  return {
    messages,
    input,
    setInput,
    isLoading,
    setIsLoading,
    suggestedQuestions,
    setSuggestedQuestions: setSuggestedQuestionsWrapper,
    currentSpeakingMessageId,
    setCurrentSpeakingMessageId,
    isResizing,
    setIsResizing,
    sessionId,
    abortControllerRef,
    addMessage,
    updateMessage,
    removeMessage,
    clearInput,
    clearMessages,
    stopGeneration,
    editAndResend,
  };
};

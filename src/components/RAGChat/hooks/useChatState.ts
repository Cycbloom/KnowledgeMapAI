import { useState, useCallback } from 'react';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
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
}

export interface ChatState {
  messages: Message[];
  input: string;
  isLoading: boolean;
  suggestedQuestions: string[];
  currentSpeakingMessageId: string | null;
  isResizing: boolean;
}

export const useChatState = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [currentSpeakingMessageId, setCurrentSpeakingMessageId] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const addMessage = useCallback((message: Message) => {
    setMessages(prev => [...prev, message]);
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(msg => 
      msg.id === id ? { ...msg, ...updates } : msg
    ));
  }, []);

  const clearInput = useCallback(() => {
    setInput('');
  }, []);

  const setSuggestedQuestionsWrapper = useCallback((questions: string[]) => {
    setSuggestedQuestions(questions);
  }, []);

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
    addMessage,
    updateMessage,
    clearInput,
  };
};

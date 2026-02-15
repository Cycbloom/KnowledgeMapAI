import { useState } from 'react';
import { NodeLevel, TutorMode, ExtractedConcept } from '../../types';

export interface FormState {
  nodeForm: {
    title: string;
    content: string;
    parentNodeIds: string[];
    level: NodeLevel;
    tags: string[];
  };
  setNodeForm: React.Dispatch<React.SetStateAction<{
    title: string;
    content: string;
    parentNodeIds: string[];
    level: NodeLevel;
    tags: string[];
  }>>;
  aiPrompt: string;
  setAiPrompt: React.Dispatch<React.SetStateAction<string>>;
  tutorMode: TutorMode;
  setTutorMode: React.Dispatch<React.SetStateAction<TutorMode>>;
  extractedConcepts: ExtractedConcept[];
  setExtractedConcepts: React.Dispatch<React.SetStateAction<ExtractedConcept[]>>;
  isTutorMode: boolean;
  setIsTutorMode: React.Dispatch<React.SetStateAction<boolean>>;
  suggestedNextTopics: Array<{ title: string; description: string; priority: 'high' | 'medium' | 'low'; estimatedDifficulty: number }>;
  setSuggestedNextTopics: React.Dispatch<React.SetStateAction<Array<{ title: string; description: string; priority: 'high' | 'medium' | 'low'; estimatedDifficulty: number }>>>;
}

export const useFormState = (): FormState => {
  const [nodeForm, setNodeForm] = useState<{
    title: string;
    content: string;
    parentNodeIds: string[];
    level: NodeLevel;
    tags: string[];
  }>({
    title: '',
    content: '',
    parentNodeIds: [],
    level: 'leaf',
    tags: []
  });
  const [aiPrompt, setAiPrompt] = useState('');
  const [tutorMode, setTutorMode] = useState<TutorMode>('free');
  const [extractedConcepts, setExtractedConcepts] = useState<ExtractedConcept[]>([]);
  const [isTutorMode, setIsTutorMode] = useState(false);
  const [suggestedNextTopics, setSuggestedNextTopics] = useState<Array<{ title: string; description: string; priority: 'high' | 'medium' | 'low'; estimatedDifficulty: number }>>([]);

  return {
    nodeForm,
    setNodeForm,
    aiPrompt,
    setAiPrompt,
    tutorMode,
    setTutorMode,
    extractedConcepts,
    setExtractedConcepts,
    isTutorMode,
    setIsTutorMode,
    suggestedNextTopics,
    setSuggestedNextTopics,
  };
};

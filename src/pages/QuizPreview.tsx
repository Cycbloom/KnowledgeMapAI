import React, { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Trash2,
  Plus,
  Loader2,
  FileQuestion,
  Layers,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../hooks';
import { useQuizSet, useDeleteQuizSetMutation, useRegenerateCardMutation } from '../hooks/queries';
import { QuestionList } from '../components/Quiz';
import { QuestionForm, type QuestionFormData } from '../components/Study/QuestionForm';
import { api } from '../services/api';
import { useQueryClient } from '@tanstack/react-query';
import { quizQueryKeys } from '../hooks/queries/useQuizQueries';
import type { StudyCard } from '@shared/types/common';

const statusConfig: Record<string, { label: string; color: string; bgColor: string; darkBg: string; darkColor: string }> = {
  draft: {
    label: '草稿',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    darkBg: 'bg-slate-700',
    darkColor: 'text-slate-400',
  },
  generating: {
    label: '生成中',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    darkBg: 'bg-amber-900/30',
    darkColor: 'text-amber-400',
  },
  ready: {
    label: '就绪',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    darkBg: 'bg-emerald-900/30',
    darkColor: 'text-emerald-400',
  },
};

const difficultyLabels: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
  mixed: '混合',
};

export const QuizPreview: React.FC = () => {
  const { quizSetId } = useParams<{ quizSetId: string }>();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const queryClient = useQueryClient();

  const [editingCard, setEditingCard] = useState<StudyCard | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [regeneratingCardId, setRegeneratingCardId] = useState<string | null>(null);

  const { data: quizSet, isLoading, error } = useQuizSet(quizSetId!, !!quizSetId);
  const deleteMutation = useDeleteQuizSetMutation();
  const regenerateMutation = useRegenerateCardMutation();

  const status = quizSet ? statusConfig[quizSet.status] || statusConfig.draft : null;
  const isGenerating = quizSet?.status === 'generating';
  const isReady = quizSet?.status === 'ready';

  const cards = useMemo(() => {
    if (!quizSet?.cards) return [];
    return quizSet.cards as StudyCard[];
  }, [quizSet]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDeleteQuiz = async () => {
    if (!quizSet) return;
    if (confirm(`确定要删除测验 "${quizSet.title}" 吗？此操作不可恢复。`)) {
      await deleteMutation.mutateAsync(quizSet.id);
      navigate('/study');
    }
  };

  const handleStartPractice = () => {
    if (!quizSet || !isReady) return;
    navigate(`/quiz/${quizSet.id}/practice`);
  };

  const handleEditCard = useCallback((card: StudyCard) => {
    setEditingCard(card);
    setShowAddForm(false);
  }, []);

  const handleDeleteCard = useCallback(async (cardId: string) => {
    if (!quizSetId) return;
    try {
      await api.quiz.removeCard(quizSetId, cardId);
      await api.study.delete(cardId);
      queryClient.invalidateQueries({ queryKey: quizQueryKeys.quizSet(quizSetId) });
    } catch (error) {
      console.error('Failed to delete card:', error);
      alert('删除题目失败');
    }
  }, [quizSetId, queryClient]);

  const handleRegenerateCard = useCallback(async (cardId: string) => {
    if (!quizSetId) return;
    setRegeneratingCardId(cardId);
    try {
      await regenerateMutation.mutateAsync({ quizSetId, cardId });
    } catch (error) {
      console.error('Failed to regenerate card:', error);
      alert('重新生成题目失败');
    } finally {
      setRegeneratingCardId(null);
    }
  }, [quizSetId, regenerateMutation]);

  const handleSaveCard = async (data: QuestionFormData) => {
    if (!quizSetId || !quizSet) return;
    setIsSubmitting(true);
    try {
      if (editingCard) {
        await api.study.update(editingCard.id, {
          question: data.question,
          answer: data.answer,
          card_type: data.card_type,
          explanation: data.explanation,
          options: data.options,
        });
      } else {
        const knowledgePointId = quizSet.config?.knowledgePointIds?.[0] || '';
        const graphId = quizSet.graph_id || '';
        
        const newCards = await api.study.createCardsBatch([{
          knowledge_point_id: knowledgePointId,
          user_id: '',
          graph_id: graphId,
          question: data.question,
          answer: data.answer,
          card_type: data.card_type,
          explanation: data.explanation,
          options: data.options,
        }]);

        if (newCards && Array.isArray(newCards) && newCards.length > 0) {
          await api.quiz.addCard(quizSetId, newCards[0].id);
        }
      }
      queryClient.invalidateQueries({ queryKey: quizQueryKeys.quizSet(quizSetId) });
      setEditingCard(null);
      setShowAddForm(false);
    } catch (error) {
      console.error('Failed to save card:', error);
      alert('保存题目失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingCard(null);
    setShowAddForm(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 size={48} className={`animate-spin mx-auto mb-4 ${isDark ? 'text-primary-400' : 'text-primary-600'}`} />
          <p className={isDark ? 'text-slate-400' : 'text-gray-500'}>加载测验中...</p>
        </div>
      </div>
    );
  }

  if (error || !quizSet) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
          <p className="text-red-500 mb-4">加载测验失败</p>
          <button
            onClick={() => navigate('/study')}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            返回学习页面
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <button
            onClick={() => navigate('/study')}
            className={`flex items-center gap-2 text-sm ${
              isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ArrowLeft size={16} />
            返回测验列表
          </button>
        </div>

        <div
          className={`rounded-2xl border overflow-hidden mb-6 ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
          }`}
        >
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold">{quizSet.title}</h1>
                  {status && (
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                        isDark ? `${status.darkBg} ${status.darkColor}` : `${status.bgColor} ${status.color}`
                      }`}
                    >
                      {isGenerating && <Loader2 size={10} className="inline mr-1 animate-spin" />}
                      {status.label}
                    </span>
                  )}
                </div>
                {quizSet.description && (
                  <p className={`mb-4 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                    {quizSet.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                    <Layers size={16} className="text-primary-400" />
                    <span>{cards.length} 道题目</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                    <FileQuestion size={16} className="text-emerald-400" />
                    <span>
                      {quizSet.config?.difficulty
                        ? difficultyLabels[quizSet.config.difficulty] || quizSet.config.difficulty
                        : '未设置难度'}
                    </span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                    <Clock size={16} className="text-amber-400" />
                    <span>创建于 {formatDate(quizSet.created_at)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isReady && (
                  <button
                    onClick={handleStartPractice}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    <Play size={18} />
                    开始练习
                  </button>
                )}
                <button
                  onClick={() => setShowAddForm(true)}
                  disabled={isGenerating}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    isGenerating
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : isDark
                        ? 'bg-slate-700 text-white hover:bg-slate-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Plus size={18} />
                  添加题目
                </button>
                <button
                  onClick={handleDeleteQuiz}
                  className={`p-2 rounded-lg transition-colors ${
                    isDark
                      ? 'text-slate-400 hover:text-red-400 hover:bg-slate-700'
                      : 'text-gray-400 hover:text-red-600 hover:bg-gray-100'
                  }`}
                  title="删除测验"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {(showAddForm || editingCard) && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`rounded-xl border mb-6 ${
                isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
              }`}
            >
              <div className={`p-4 border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                <h3 className="font-medium">
                  {editingCard ? '编辑题目' : '添加新题目'}
                </h3>
              </div>
              <QuestionForm
                initialData={editingCard || undefined}
                onSubmit={handleSaveCard}
                onCancel={handleCancelEdit}
                isSubmitting={isSubmitting}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {regeneratingCardId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className={`p-6 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
              <Loader2 size={32} className="animate-spin mx-auto mb-3 text-primary-500" />
              <p className={isDark ? 'text-slate-300' : 'text-gray-600'}>正在重新生成题目...</p>
            </div>
          </div>
        )}

        <QuestionList
          cards={cards}
          quizSetId={quizSet.id}
          onEdit={handleEditCard}
          onDelete={handleDeleteCard}
          onRegenerate={handleRegenerateCard}
          readOnly={isGenerating}
        />
      </div>
    </div>
  );
};

export default QuizPreview;

import React, { useId } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Info } from 'lucide-react';
import { StudyCard } from '../../types';
import { useFocusTrap, useEscapeKey } from '../../hooks';
import { FocusTopicBadge, CardSourceLine } from './common';

interface StudyCardDetailModalProps {
  card: StudyCard | null;
  isOpen: boolean;
  onClose: () => void;
  onPractice?: (card: StudyCard) => void;
  isDark: boolean;
}

export const StudyCardDetailModal: React.FC<StudyCardDetailModalProps> = ({
  card,
  isOpen,
  onClose,
  onPractice,
  isDark,
}) => {
  const { t } = useTranslation();
  const containerRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen && Boolean(card) });
  useEscapeKey(() => onClose(), isOpen && Boolean(card));
  const titleId = useId();

  if (!card) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={`relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-[2.5rem] shadow-2xl flex flex-col ${
              isDark ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-gray-100'
            }`}
          >
            {/* Modal Header */}
            <div className={`p-6 border-b flex items-center justify-between shrink-0 ${
              isDark ? 'border-slate-800' : 'border-gray-50'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-2xl ${isDark ? 'bg-primary-900/40 text-primary-400' : 'bg-primary-50 text-primary-600'}`}>
                  <Info size={20} />
                </div>
                <div>
                  <h3 id={titleId} className={`font-black text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('study.cardDetail.title')}</h3>
                  <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                    {card.card_type === 'choice' ? t('study.quizPractice.cardType.choice') : 
                     card.card_type === 'multi_choice' ? t('study.quizPractice.cardType.multi_choice') : 
                     card.card_type === 'fill_in_the_blank' ? t('study.quizPractice.cardType.fill_in_the_blank') : 
                     card.card_type === 'true_false' ? t('study.quizPractice.cardType.true_false') :
                     card.card_type === 'essay' ? t('study.quizPractice.cardType.essay') :
                     card.card_type === 'cloze' ? t('study.quizPractice.cardType.cloze') :
                     card.card_type === 'select_from_options' ? t('study.quizPractice.cardType.select_from_options') :
                     card.card_type === 'matching' ? t('study.quizPractice.cardType.matching') :
                     card.card_type === 'ordering' ? t('study.quizPractice.cardType.ordering') : t('study.quizPractice.cardType.qa')}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className={`p-2 rounded-xl transition-all ${
                  isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-gray-100 text-gray-400'
                }`}
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">
              <section className="space-y-3">
                <h4 className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{t('study.questionForm.questionLabel')}</h4>
                <FocusTopicBadge focusTopic={card.focus_topic} variant="pill" />
                <CardSourceLine
                  knowledgePointTitle={card.knowledgePointTitle}
                  graphTitle={card.graphTitle}
                />
                <div className={`text-xl font-bold leading-relaxed ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {card.question}
                </div>
              </section>

              {/* Options for Choice Cards */}
              {(card.card_type === 'choice' || card.card_type === 'multi_choice') && card.options && (
                <section className="space-y-3">
                  <h4 className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{t('study.cardDetail.options')}</h4>
                  <div className="grid gap-3">
                    {(() => {
                      let opts = [];
                      try {
                        opts = typeof card.options === 'string' ? JSON.parse(card.options) : card.options;
                      } catch { opts = []; }
                      return Array.isArray(opts) ? opts.map((opt, i) => (
                        <div key={i} className={`p-4 rounded-2xl border ${
                          isDark ? 'bg-slate-800/50 border-slate-700 text-slate-300' : 'bg-gray-50 border-gray-100 text-slate-600'
                        }`}>
                          <span className="font-bold mr-3 opacity-50">{String.fromCharCode(65 + i)}.</span>
                          {opt}
                        </div>
                      )) : null;
                    })()}
                  </div>
                </section>
              )}

              <section className="space-y-3">
                <h4 className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{t('study.cardDetail.correctAnswer')}</h4>
                <div className={`p-5 rounded-2xl font-bold ${
                  isDark ? 'bg-emerald-900/20 border border-emerald-900/50 text-emerald-400' : 'bg-emerald-50 border border-emerald-100 text-emerald-700'
                }`}>
                  {card.answer}
                </div>
              </section>

              {card.explanation && (
                <section className="space-y-3">
                  <h4 className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{t('study.quiz.explanation')}</h4>
                  <div className={`p-5 rounded-2xl leading-relaxed ${
                    isDark ? 'bg-slate-800/50 text-slate-300' : 'bg-slate-50 text-slate-600'
                  }`}>
                    {card.explanation}
                  </div>
                </section>
              )}
            </div>

            {/* Modal Footer */}
            {onPractice && (
              <div className={`p-6 border-t shrink-0 flex gap-3 ${isDark ? 'border-slate-800' : 'border-gray-50'}`}>
                <button
                  onClick={() => {
                    onPractice(card);
                    onClose();
                  }}
                  className="flex-1 py-4 bg-primary-600 text-white rounded-2xl font-black shadow-lg shadow-primary-200 hover:bg-primary-700 transition-all flex items-center justify-center gap-2"
                >
                  <Play size={20} fill="currentColor" />
                  {t('study.cardDetailModal.startNow')}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

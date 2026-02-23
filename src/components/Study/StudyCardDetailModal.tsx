import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Info } from 'lucide-react';
import { StudyCard } from '../../types';

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
  if (!card) return null;

  return (
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
                <div className={`p-2.5 rounded-2xl ${isDark ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                  <Info size={20} />
                </div>
                <div>
                  <h3 className={`font-black text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>卡片详情</h3>
                  <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                    {card.card_type === 'choice' ? '单选题' : 
                     card.card_type === 'multi_choice' ? '多选题' : 
                     card.card_type === 'fill_in_the_blank' ? '填空题' : 
                     card.card_type === 'true_false' ? '判断题' :
                     card.card_type === 'essay' ? '问答题' : '问答题'}
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
                <h4 className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>问题</h4>
                <div className={`text-xl font-bold leading-relaxed ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {card.question}
                </div>
              </section>

              {/* Options for Choice Cards */}
              {(card.card_type === 'choice' || card.card_type === 'multi_choice') && card.options && (
                <section className="space-y-3">
                  <h4 className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>选项</h4>
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
                <h4 className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>正确答案</h4>
                <div className={`p-5 rounded-2xl font-bold ${
                  isDark ? 'bg-emerald-900/20 border border-emerald-900/50 text-emerald-400' : 'bg-emerald-50 border border-emerald-100 text-emerald-700'
                }`}>
                  {card.answer}
                </div>
              </section>

              {card.explanation && (
                <section className="space-y-3">
                  <h4 className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>解析</h4>
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
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                >
                  <Play size={20} fill="currentColor" />
                  立即开始练习
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

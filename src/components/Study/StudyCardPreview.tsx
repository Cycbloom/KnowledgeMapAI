import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, Tag, Eye, Play, Trash2, Edit2, CheckSquare, Square } from 'lucide-react';
import { StudyCard } from '../../types';

interface StudyCardPreviewProps {
  card: StudyCard;
  isDark: boolean;
  onPreview?: (card: StudyCard) => void;
  onPractice?: (card: StudyCard) => void;
  onEdit?: (card: StudyCard) => void;
  onDelete?: (card: StudyCard) => void;
  onSelect?: (card: StudyCard) => void;
  selected?: boolean;
  selectionMode?: boolean;
  showStatus?: boolean; // Whether to show New/Review status (useful for Dashboard, maybe less for Bank)
  compact?: boolean; // For denser lists if needed
}

export const StudyCardPreview: React.FC<StudyCardPreviewProps> = ({
  card,
  isDark,
  onPreview,
  onPractice,
  onEdit,
  onDelete,
  onSelect,
  selected = false,
  selectionMode = false,
  showStatus = true,
}) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`group p-5 rounded-2xl border transition-all hover:shadow-xl flex flex-col h-full relative ${
        selected 
          ? (isDark ? 'bg-indigo-900/20 border-indigo-500' : 'bg-indigo-50 border-indigo-200')
          : (isDark 
              ? 'bg-slate-800 border-slate-700 hover:border-indigo-500/50' 
              : 'bg-white border-gray-100 hover:border-indigo-200 shadow-sm')
      }`}
      onClick={() => selectionMode && onSelect && onSelect(card)}
    >
      {/* Selection Checkbox */}
      {(selectionMode || onSelect) && (
        <div className="absolute top-4 right-4 z-10">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onSelect && onSelect(card);
            }}
            className={`transition-colors ${selected ? 'text-indigo-500' : 'text-gray-300 hover:text-gray-400'}`}
          >
             {selected ? <CheckSquare size={20} /> : <Square size={20} />}
          </button>
        </div>
      )}

      <div className="flex-1 space-y-3">
        <div className="flex items-start justify-between gap-2 pr-8">
          {showStatus && (
            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
              (card.review_count || 0) > 0 
                ? (isDark ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-600')
                : (isDark ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500')
            }`}>
              {(card.review_count || 0) > 0 ? '已学习' : '新内容'}
            </span>
          )}
          
          <div className={`flex items-center gap-1 text-[10px] ml-auto ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
            <Calendar size={10} />
            <span>{card.next_review ? new Date(card.next_review).toLocaleDateString() : '尚未开始'}</span>
          </div>
        </div>
        
        <h4 className="font-bold line-clamp-2 leading-snug min-h-[2.8rem]">{card.question}</h4>
        <p className={`text-sm line-clamp-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{card.answer}</p>
      </div>

      <div className="mt-5 pt-4 border-t border-gray-50 dark:border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${isDark ? 'bg-slate-700' : 'bg-gray-50'}`}>
            <Tag size={12} className="text-indigo-400" />
          </div>
          <span className={`text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
            {card.card_type === 'choice' ? '单选题' : 
             card.card_type === 'multi_choice' ? '多选题' : 
             card.card_type === 'fill_in_the_blank' ? '填空题' : 
             card.card_type === 'true_false' ? '判断题' :
             card.card_type === 'essay' ? '问答题' : '问答题'}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          {onPreview && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onPreview(card);
              }}
              className={`p-1.5 rounded-lg transition-all ${
                isDark 
                  ? 'text-slate-400 hover:text-indigo-400 hover:bg-slate-700' 
                  : 'text-gray-400 hover:text-indigo-600 hover:bg-gray-100'
              }`}
              title="预览内容"
            >
              <Eye size={16} />
            </button>
          )}
          
          {onEdit && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onEdit(card);
              }}
              className={`p-1.5 rounded-lg transition-all ${
                isDark 
                  ? 'text-slate-400 hover:text-amber-400 hover:bg-slate-700' 
                  : 'text-gray-400 hover:text-amber-600 hover:bg-gray-100'
              }`}
              title="编辑"
            >
              <Edit2 size={16} />
            </button>
          )}

          {onDelete && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onDelete(card);
              }}
              className={`p-1.5 rounded-lg transition-all ${
                isDark 
                  ? 'text-slate-400 hover:text-red-400 hover:bg-slate-700' 
                  : 'text-gray-400 hover:text-red-600 hover:bg-gray-100'
              }`}
              title="删除"
            >
              <Trash2 size={16} />
            </button>
          )}

          {onPractice && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onPractice(card);
              }}
              className={`ml-1 text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                isDark 
                  ? 'text-indigo-400 hover:bg-indigo-500/10' 
                  : 'text-indigo-600 hover:bg-indigo-50'
              }`}
            >
              <Play size={12} />
              练习
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

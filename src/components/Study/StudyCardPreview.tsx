import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Calendar, Tag, Eye, Play, Trash2, Edit2, CheckSquare, Square } from 'lucide-react';
import { StudyCard } from '../../types';
import { formatDate } from '../../utils/formatters';

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

const StudyCardPreviewComponent: React.FC<StudyCardPreviewProps> = ({
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
  const { t } = useTranslation();
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`group p-4 md:p-5 rounded-2xl border transition-all hover:shadow-xl flex flex-col h-full relative ${
        selected 
          ? (isDark ? 'bg-primary-900/20 border-primary-500' : 'bg-primary-50 border-primary-200')
          : (isDark 
              ? 'bg-slate-800 border-slate-700 hover:border-primary-500/50' 
              : 'bg-white border-gray-100 hover:border-primary-200 shadow-sm')
      }`}
      onClick={() => { if (selectionMode && onSelect) onSelect(card); }}
    >
      {(selectionMode || onSelect) && (
        <div className="absolute top-4 right-4 z-10">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              if (onSelect) onSelect(card);
            }}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors ${selected ? 'text-primary-500' : 'text-gray-300 hover:text-gray-400'}`}
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
              {(card.review_count || 0) > 0 ? t('study.cardPreview.status.studied') : t('study.cardPreview.status.new')}
            </span>
          )}
          
          <div className={`flex items-center gap-1 text-[10px] ml-auto ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
            <Calendar size={10} />
            <span>{card.next_review ? formatDate(card.next_review, 'short') : t('study.cardPreview.notStarted')}</span>
          </div>
        </div>
        
        <h4 className="font-bold line-clamp-2 leading-snug min-h-[2.8rem]">{card.question}</h4>
        <p className={`text-sm line-clamp-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{card.answer}</p>
      </div>

      <div className="mt-5 pt-4 border-t border-gray-50 dark:border-slate-500/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${isDark ? 'bg-slate-700' : 'bg-gray-50'}`}>
            <Tag size={12} className="text-primary-400" />
          </div>
          <span className={`text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
            {t(`study.cardPreview.cardType.${card.card_type}`, { defaultValue: '' })}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          {onPreview && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onPreview(card);
              }}
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-all ${
                isDark 
                  ? 'text-slate-400 hover:text-primary-400 hover:bg-slate-700' 
                  : 'text-gray-400 hover:text-primary-600 hover:bg-gray-100'
              }`}
              title={t('study.cardPreview.button.preview')}
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
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-all ${
                isDark 
                  ? 'text-slate-400 hover:text-amber-400 hover:bg-slate-700' 
                  : 'text-gray-400 hover:text-amber-600 hover:bg-gray-100'
              }`}
              title={t('study.cardPreview.button.edit')}
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
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-all ${
                isDark 
                  ? 'text-slate-400 hover:text-red-400 hover:bg-slate-700' 
                  : 'text-gray-400 hover:text-red-600 hover:bg-gray-100'
              }`}
              title={t('study.cardPreview.button.delete')}
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
              className={`ml-1 min-w-[64px] min-h-[44px] text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${
                isDark 
                  ? 'text-primary-400 hover:bg-primary-500/10' 
                  : 'text-primary-600 hover:bg-primary-50'
              }`}
            >
              <Play size={12} />
              {t('study.cardPreview.button.practice')}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const areEqual = (prev: StudyCardPreviewProps, next: StudyCardPreviewProps) => {
  return (
    prev.card.id === next.card.id &&
    prev.card.review_count === next.card.review_count &&
    prev.card.next_review === next.card.next_review &&
    prev.isDark === next.isDark &&
    prev.selected === next.selected &&
    prev.selectionMode === next.selectionMode &&
    prev.showStatus === next.showStatus
  );
};

export const StudyCardPreview = React.memo(StudyCardPreviewComponent, areEqual);

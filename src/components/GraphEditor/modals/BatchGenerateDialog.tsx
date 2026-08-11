import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { ModalShell } from '../../common';

interface BatchGenerateConfig {
  types: string[];
  count: number;
  pack_template: string | null;
}

export type { BatchGenerateConfig };

interface BatchGenerateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedNodeIds: string[];
  onSuccess?: (config?: BatchGenerateConfig) => void;
}

export const BatchGenerateDialog: React.FC<BatchGenerateDialogProps> = ({
  isOpen,
  onClose,
  selectedNodeIds,
  onSuccess
}) => {
  const { t } = useTranslation();
  const [types, setTypes] = useState<string[]>(['qa', 'choice']);
  const [count, setCount] = useState(3);
  const [isLoading] = useState(false);
  const [packTemplate, setPackTemplate] = useState<string | null>(null);

  const packPresets: Array<{ id: string; label: string; desc: string; types: string[]; count: number }> = [
    { id: 'quick', label: t('graphEditor.batchGenerate.presets.quick.label'), desc: t('graphEditor.batchGenerate.presets.quick.desc'), types: ['qa', 'choice', 'true_false'], count: 3 },
    { id: 'standard', label: t('graphEditor.batchGenerate.presets.standard.label'), desc: t('graphEditor.batchGenerate.presets.standard.desc'), types: ['choice', 'multi_choice', 'fill_in_the_blank', 'essay'], count: 10 },
    { id: 'exam', label: t('graphEditor.batchGenerate.presets.exam.label'), desc: t('graphEditor.batchGenerate.presets.exam.desc'), types: ['choice', 'multi_choice', 'essay'], count: 15 },
  ];

  const handleSelectPreset = (preset: { id: string; types: string[]; count: number }) => {
    setPackTemplate(preset.id);
    setTypes(preset.types);
    setCount(preset.count);
  };

  const handleToggleType = (typeId: string) => {
    setTypes(prev => 
      prev.includes(typeId) 
        ? prev.filter(t => t !== typeId)
        : [...prev, typeId]
    );
  };

  // Poll task status (Removed polling, just close on submission)
  /*
  interface AiBatchTaskStatus {
    status: 'completed' | 'failed' | 'processing';
    error?: string;
    result?: {
      totalCards?: number;
      progress?: number;
      current_node?: string;
    };
  }
  React.useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (taskId) {
        interval = setInterval(async () => {
            try {
                const res: AiBatchTaskStatus = await api.ai.getTaskStatus(taskId);
                const task = res;
                
                if (task.status === 'completed') {
                    setTaskId(null);
                    setIsLoading(false);
                    onSuccess?.();
                    onClose();
                    message.success(t('graphEditor.batchGenerateSuccess', { count: task.result.totalCards }));
                } else if (task.status === 'failed') {
                    setTaskId(null);
                    setIsLoading(false);
                    message.error(t('graphEditor.batchGenerateFailed', { message: task.error }));
                } else if (task.status === 'processing' && task.result) {
                    setProgress({
                        current: task.result.progress || 0,
                        total: 100,
                        message: task.result.current_node ? t('graphEditor.batchGenerate.processing', { current_node: task.result.current_node }) : t('graphEditor.batchGenerate.generating')
                    });
                }
            } catch (e) {
                console.error("Polling error", e);
            }
        }, 2000);
    }
    return () => clearInterval(interval);
  }, [taskId, onClose, onSuccess]);
  */

  const handleGenerate = () => {
    if (types.length === 0) return;
    
    onSuccess?.({
      types,
      count,
      pack_template: packTemplate
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      titleId="batch-generate-dialog-title"
      className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200"
      overlayClassName="p-4 backdrop-blur-sm"
    >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-center">
             <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400">
               <Sparkles size={20} />
               <h3 id="batch-generate-dialog-title" className="text-lg font-semibold">{t('graphEditor.outline.batchGenerateQuestions')}</h3>
             </div>
             <button onClick={onClose} aria-label={t('common.aria.close')} className="text-slate-400 hover:text-slate-500 p-2 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 touch-target flex items-center justify-center">
               <X size={20} />
             </button>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {t('graphEditor.batchGenerate.summary', { count: selectedNodeIds.length })}
          </p>
        </div>
        
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Presets / Packs */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('graphEditor.batchGenerate.selectPreset')}</label>
            <div className="grid grid-cols-1 gap-3">
              {packPresets.map(preset => (
                <div 
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset)}
                  className={`cursor-pointer p-3 rounded-lg border transition-all
                    ${packTemplate === preset.id 
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 dark:border-primary-400' 
                      : 'border-slate-200 hover:border-slate-300 dark:border-slate-500'}`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className={`font-semibold text-sm ${packTemplate === preset.id ? 'text-primary-600 dark:text-primary-300' : 'text-slate-700 dark:text-slate-200'}`}>
                      {preset.label}
                    </span>
                    {packTemplate === preset.id && <div className="w-2 h-2 rounded-full bg-primary-500" />}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{preset.desc}</p>
                </div>
              ))}
              <div 
                onClick={() => setPackTemplate(null)}
                className={`cursor-pointer p-3 rounded-lg border transition-all text-center text-xs font-medium
                  ${packTemplate === null 
                    ? 'border-primary-500 bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:border-primary-400 dark:text-primary-300' 
                    : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-500'}`}
              >
                {t('graphEditor.batchGenerate.customSettings')}
              </div>
            </div>
          </div>

          {packTemplate === null && (
            <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">
              {/* Types */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('graphEditor.batchGenerate.questionTypesLabel')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'qa' },
                    { id: 'choice' },
                    { id: 'true_false' },
                    { id: 'multi_choice' },
                    { id: 'fill_in_the_blank' },
                    { id: 'essay' }
                  ].map(type => (
                    <div 
                      key={type.id}
                      onClick={() => handleToggleType(type.id)}
                      className={`cursor-pointer px-2 py-2 rounded-md border text-xs font-medium transition-all text-center
                        ${types.includes(type.id) 
                          ? 'border-primary-500 bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:border-primary-400 dark:text-primary-300' 
                          : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-500 dark:text-slate-400'}`}
                    >
                      {t(`graphEditor.batchGenerate.questionTypes.${type.id}`, { defaultValue: '' })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Count */}
              <div className="space-y-3">
                <div className="flex justify-between">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('graphEditor.batchGenerate.countLabel')}</label>
                    <span className="text-sm text-primary-600 font-medium">{count}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value))}
                  aria-label={t('graphEditor.batchGenerate.countLabel')}
                  aria-valuetext={t('graphEditor.batchGenerate.countValue', { count })}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700"
                />
                <div className="flex justify-between text-xs text-slate-400">
                  <span>1</span>
                  <span>20</span>
                </div>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="bg-primary-50 dark:bg-primary-900/20 p-3 rounded text-xs text-primary-600 dark:text-primary-400">
             {t('graphEditor.batchGenerate.estimatedCountPrefix')}<span className="font-bold">{selectedNodeIds.length * count}</span>{t('graphEditor.batchGenerate.estimatedCountSuffix')}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-md text-sm font-medium transition-colors"
          >
            {t('graphEditor.batchGenerate.buttons.cancel')}
          </button>
          <button
            onClick={handleGenerate}
            disabled={isLoading || types.length === 0}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px] justify-center"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {t('graphEditor.batchGenerate.buttons.startGenerate')}
          </button>
        </div>
    </ModalShell>
  );
};

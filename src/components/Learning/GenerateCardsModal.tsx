import React, { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, BrainCircuit, Settings, AlertCircle, Cloud, CloudUpload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isCapacitorMobile } from '../../config/mobileApiConfig';
import { mobileAIService } from '../../services/mobile/aiService';
import { ModalShell } from '../common';

interface GenerateProgress {
  current: number;
  total: number;
  isGenerating: boolean;
}

interface GenerateCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (config: { count: number; types: string[] }) => Promise<void>;
  nodeTitle: string;
  generateProgress?: GenerateProgress | null;
}

export const GenerateCardsModal: React.FC<GenerateCardsModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
  nodeTitle,
  generateProgress
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [types, setTypes] = useState<string[]>(['qa', 'choice', 'true_false', 'multi_choice', 'fill_in_the_blank']);
  const [count, setCount] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileAIConfigured, setIsMobileAIConfigured] = useState(true);

  useEffect(() => {
    const mobile = isCapacitorMobile();
    setIsMobile(mobile);
    if (mobile) {
      const configured = mobileAIService.isConfigured();
      setIsMobileAIConfigured(configured);
    }
  }, [isOpen]);

  const handleGoToSettings = () => {
    onClose();
    navigate('/settings#prompts');
  };

  const handleToggleType = (typeId: string) => {
    setTypes(prev => 
      prev.includes(typeId) 
        ? prev.filter(t => t !== typeId)
        : [...prev, typeId]
    );
  };

  const handleConfirm = async () => {
    if (types.length === 0) return;
    if (isMobile && !isMobileAIConfigured) return;
    setIsLoading(true);
    try {
      await onGenerate({ count, types });
      if (!isMobile) {
        onClose();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const isGenerating = isLoading || (generateProgress?.isGenerating ?? false);
  const progressPercent = generateProgress 
    ? Math.round((generateProgress.current / generateProgress.total) * 100) 
    : 0;

  if (!isOpen) return null;

  const cardTypes = [
    { id: 'qa', label: t('learning.generateCards.typeQA') },
    { id: 'choice', label: t('learning.generateCards.typeChoice') },
    { id: 'true_false', label: t('learning.generateCards.typeTrueFalse') },
    { id: 'multi_choice', label: t('learning.generateCards.typeMultiChoice') },
    { id: 'fill_in_the_blank', label: t('learning.generateCards.typeFillBlank') },
    { id: 'essay', label: t('learning.generateCards.typeEssay') }
  ];

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      titleId="generate-cards-modal-title"
      className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 border dark:border-slate-800"
      overlayClassName="z-[60] p-4 backdrop-blur-sm"
    >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-center">
             <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400">
               <BrainCircuit size={24} />
               <h3 id="generate-cards-modal-title" className="text-xl font-bold">{t('learning.generateCards.title')}</h3>
             </div>
             <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400">
               <X size={20} />
             </button>
          </div>
          <p className="text-sm text-slate-500 mt-2">
            {t('learning.generateCards.configuring', { title: nodeTitle })}
          </p>
        </div>
        
        <div className="p-6 space-y-8">
          {/* Types */}
          <div className="space-y-4">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-primary-500 rounded-full"></span>
              {t('learning.generateCards.typeSelect')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {cardTypes.map(type => (
                <button 
                  key={type.id}
                  onClick={() => handleToggleType(type.id)}
                  className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-center flex items-center justify-center gap-2
                    ${types.includes(type.id) 
                      ? 'border-primary-500 bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:border-primary-400 dark:text-primary-300 shadow-sm' 
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  {type.label}
                  {types.includes(type.id) && <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />}
                </button>
              ))}
            </div>
          </div>

          {/* Count */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-primary-500 rounded-full"></span>
                  {t('learning.generateCards.countLabel')}
                </label>
                <span className="px-3 py-1 bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400 rounded-full text-sm font-bold">{t('learning.generateCards.countUnit', { count })}</span>
            </div>
            <div className="px-2">
              <input 
                type="range" 
                min="1" 
                max="30" 
                value={count} 
                onChange={(e) => setCount(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-medium">
                <span>1</span>
                <span>15</span>
                <span>30</span>
              </div>
            </div>
          </div>

          {/* Warning/Info */}
          {isMobile && !isMobileAIConfigured ? (
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-900/30 text-xs text-red-700 dark:text-red-400 flex gap-3">
              <div className="p-1 bg-red-100 dark:bg-red-800 rounded-full h-fit mt-0.5">
                <AlertCircle size={12} className="text-red-600 dark:text-red-300" />
              </div>
              <div className="flex-1">
                <p className="font-semibold mb-1">{t('learning.generateCards.configureApiKey')}</p>
                <p className="leading-relaxed opacity-80">
                  {t('learning.generateCards.mobileAIRequired')}
                </p>
              </div>
            </div>
          ) : (
            <div className={`p-4 rounded-xl border text-xs flex gap-3 ${
              isMobile 
                ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-100 dark:border-primary-900/30 text-primary-700 dark:text-primary-400' 
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/30 text-amber-700 dark:text-amber-400'
            }`}>
              <div className={`p-1 rounded-full h-fit mt-0.5 ${
                isMobile 
                  ? 'bg-primary-100 dark:bg-primary-800' 
                  : 'bg-amber-100 dark:bg-amber-800'
              }`}>
                {isMobile 
                  ? <CloudUpload size={12} className="text-primary-600 dark:text-primary-300" /> 
                  : <Cloud size={12} className="text-amber-600 dark:text-amber-300" />
                }
              </div>
              <p className="leading-relaxed">
                {isMobile
                  ? t('learning.generateCards.localGenerate')
                  : t('learning.generateCards.backgroundProcess')}
              </p>
            </div>
          )}
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 flex justify-end gap-3">
          {isMobile && isGenerating && generateProgress ? (
            <>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t('learning.generateCards.generating')}
                  </span>
                  <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                    {t('learning.generateCards.progress', { current: generateProgress.current, total: generateProgress.total })}
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-primary-500 to-violet-500 h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 text-center">
                  {t('learning.generateCards.keepForeground')}
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-4 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-sm font-bold transition-colors"
              >
                {t('learning.generateCards.hide')}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={isLoading}
                className="px-6 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-sm font-bold transition-colors"
              >
                {t('learning.generateCards.cancel')}
              </button>
              {isMobile && !isMobileAIConfigured ? (
                <button
                  onClick={handleGoToSettings}
                  className="px-8 py-2.5 bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-700 hover:to-violet-700 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-primary-200 dark:shadow-none hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Settings size={18} />
                  {t('learning.generateCards.goToSettings')}
                </button>
              ) : (
                <button
                  onClick={handleConfirm}
                  disabled={isLoading || types.length === 0}
                  className="px-8 py-2.5 bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-700 hover:to-violet-700 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-200 dark:shadow-none hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                  {t('learning.generateCards.startGenerate')}
                </button>
              )}
            </>
          )}
        </div>
    </ModalShell>
  );
};

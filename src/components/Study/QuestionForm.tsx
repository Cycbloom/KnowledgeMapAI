import React, { useState, useLayoutEffect, useRef, useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StudyCard } from '../../types';
import { CheckSquare, Plus, X, Loader2 } from 'lucide-react';
import { useTheme, useFormDraft, useBeforeUnload } from "../../hooks";
import { useKeyboardHandler } from "../../hooks/gesture/useKeyboardHandler";
import { ConfirmationModal } from '../common/ConfirmationModal';

export interface QuestionFormData {
  question: string;
  answer: string;
  card_type: StudyCard['card_type'];
  explanation: string;
  options: string[];
}

interface QuestionFormProps {
  initialData?: StudyCard;
  onSubmit: (data: QuestionFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const getInitialFormData = (initialData?: StudyCard): QuestionFormData => {
  if (initialData) {
    return {
      question: initialData.question,
      answer: initialData.answer,
      card_type: initialData.card_type,
      explanation: initialData.explanation || '',
      options: initialData.options || (
        (initialData.card_type === 'choice' || initialData.card_type === 'multi_choice' || initialData.card_type === 'select_from_options') 
          ? ['', '', '', ''] 
          : []
      )
    };
  }
  return {
    question: '',
    answer: '',
    card_type: 'qa',
    explanation: '',
    options: []
  };
};

export const QuestionForm: React.FC<QuestionFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false
}) => {
  useKeyboardHandler();
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const {
    value: formData,
    setValue: setFormData,
    clearDraft,
    showRestorePrompt,
    onRestore,
    onDiscard,
  } = useFormDraft<QuestionFormData>({
    key: 'questionForm_draft',
    initialValue: getInitialFormData(initialData),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const prevInitialDataRef = useRef(initialData);

  // 预构建多选题已选答案集合，替代逐选项 JSON.parse + includes 的 O(options*answers)
  const multiAnswerSet = useMemo(() => {
    if (formData.card_type !== 'multi_choice') return null;
    try {
      const ans = JSON.parse(formData.answer || '[]');
      return Array.isArray(ans) ? new Set(ans as string[]) : null;
    } catch {
      return null;
    }
  }, [formData.card_type, formData.answer]);

  // 可访问性：为各字段及错误消息生成唯一 id
  const questionId = useId();
  const questionErrorId = useId();
  const typeId = useId();
  const optionsErrorId = useId();
  const optionsInputBaseId = useId();
  const answerId = useId();
  const answerErrorId = useId();
  const explanationId = useId();

  const questionRef = useRef<HTMLTextAreaElement>(null);
  const answerRef = useRef<HTMLTextAreaElement>(null);
  const explanationRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight  }px`;
  };

  useLayoutEffect(() => {
    adjustHeight(questionRef.current);
    adjustHeight(answerRef.current);
    adjustHeight(explanationRef.current);
  }, [formData.question, formData.answer, formData.explanation, formData.card_type]);

  useLayoutEffect(() => {
    if (initialData !== prevInitialDataRef.current) {
      prevInitialDataRef.current = initialData;
      setFormData(getInitialFormData(initialData));
    }
  }, [initialData]);

  // Warn user before leaving when there are unsaved changes
  // 用 useMemo 缓存 isDirty，避免每次渲染重复两次 JSON.stringify（序列化计算降为依赖变化时才执行）
  const isDirty = useMemo(
    () =>
      JSON.stringify(formData) !== JSON.stringify(getInitialFormData(initialData)),
    [formData, initialData],
  );
  useBeforeUnload(isDirty, t("common.unsavedChanges"));

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.question.trim()) newErrors.question = t('study.questionForm.validation.questionRequired');
    else if (formData.question.length > 500) newErrors.question = t('study.questionForm.validation.questionTooLong');

    if (!formData.answer.trim()) newErrors.answer = t('study.questionForm.validation.answerRequired');

    if ((formData.card_type === 'choice' || formData.card_type === 'multi_choice' || formData.card_type === 'select_from_options')) {
      if (formData.options.length < 2) {
        newErrors.options = t('study.questionForm.validation.optionsMinLength');
      } else if (formData.options.some(o => !o.trim())) {
        newErrors.options = t('study.questionForm.validation.optionContentRequired');
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (submitting || isSubmitting) return;
    setSubmitting(true);
    try {
      await onSubmit(formData);
      clearDraft();
    } finally {
      setSubmitting(false);
    }
  };

  // Option Handlers
  const addOption = () => {
    setFormData(prev => ({ ...prev, options: [...prev.options, ''] }));
  };
  
  const updateOption = (index: number, value: string) => {
    const newOptions = [...formData.options];
    const oldOption = newOptions[index];
    newOptions[index] = value;
    
    // Sync answer if it matches the old option
    let newAnswer = formData.answer;
    
    if (formData.card_type === 'choice' || formData.card_type === 'select_from_options') {
      if (formData.answer === oldOption) {
        newAnswer = value;
      }
    } else if (formData.card_type === 'multi_choice') {
      try {
        const currentAnswers: string[] = JSON.parse(formData.answer || '[]');
        if (Array.isArray(currentAnswers) && currentAnswers.includes(oldOption)) {
          const updatedAnswers = currentAnswers.map(a => a === oldOption ? value : a);
          newAnswer = JSON.stringify(updatedAnswers);
        }
      } catch (_e) {
        // Ignore parse errors
      }
    }

    setFormData(prev => ({ ...prev, options: newOptions, answer: newAnswer }));
  };
  
  const removeOption = (index: number) => {
    setFormData(prev => ({ ...prev, options: prev.options.filter((_, i) => i !== index) }));
  };

  // answer 字段在 判断/单选/多选/选词填空 之外 渲染为 textarea
  const isAnswerTextarea =
    formData.card_type !== 'true_false' &&
    formData.card_type !== 'choice' &&
    formData.card_type !== 'multi_choice' &&
    formData.card_type !== 'select_from_options';

  return (
    <div className={`p-4 sm:p-4 border-b ${isDark ? 'bg-slate-800/50' : 'bg-primary-50/50'}`}>
      <div className="space-y-4 max-w-2xl">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor={questionId} className="block text-sm font-medium mb-1 label-mobile">
              {t('study.questionForm.questionLabel')} <span aria-hidden="true" className="text-red-500">*</span>
              <span className={`ml-2 text-xs font-normal ${formData.question.length > 500 ? 'text-red-500' : 'text-gray-400'}`}>
                {formData.question.length}/500
              </span>
            </label>
            <textarea
              ref={questionRef}
              id={questionId}
              aria-required={true}
              aria-invalid={!!errors.question}
              aria-describedby={errors.question ? questionErrorId : undefined}
              value={formData.question}
              onChange={e => setFormData({...formData, question: e.target.value})}
              className={`w-full p-3 border rounded-lg text-base ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} ${errors.question ? 'border-red-500' : ''} resize-none overflow-hidden min-h-[44px]`}
              rows={1}
              placeholder={t('study.questionForm.questionPlaceholder')}
            />
            {errors.question && <p role="alert" id={questionErrorId} className="text-red-500 text-xs mt-1">{errors.question}</p>}
          </div>
          <div className="w-full sm:w-32">
            <label htmlFor={typeId} className="block text-sm font-medium mb-1 label-mobile">{t('study.questionForm.typeLabel')}</label>
            <select
              id={typeId}
              value={formData.card_type}
              onChange={e => {
                  const type = e.target.value as StudyCard['card_type'];
                  setFormData({
                      ...formData, 
                      card_type: type, 
                      options: (type === 'choice' || type === 'multi_choice' || type === 'select_from_options') ? ['', '', '', ''] : [],
                      answer: ''
                  });
              }}
              className={`w-full p-3 border rounded-lg text-base min-h-[44px] ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}
              disabled={!!initialData}
            >
              <option value="qa">{t('study.questionForm.cardType.qa')}</option>
              <option value="choice">{t('study.questionForm.cardType.choice')}</option>
              <option value="multi_choice">{t('study.questionForm.cardType.multi_choice')}</option>
              <option value="true_false">{t('study.questionForm.cardType.true_false')}</option>
              <option value="fill_in_the_blank">{t('study.questionForm.cardType.fill_in_the_blank')}</option>
              <option value="essay">{t('study.questionForm.cardType.essay')}</option>
              <option value="cloze">{t('study.questionForm.cardType.cloze')}</option>
              <option value="select_from_options">{t('study.questionForm.cardType.select_from_options')}</option>
              <option value="matching">{t('study.questionForm.cardType.matching')}</option>
              <option value="ordering">{t('study.questionForm.cardType.ordering')}</option>
            </select>
          </div>
        </div>
        
        {/* Options for Choice/Multi-Choice/Select-from-options */}
        {(formData.card_type === 'choice' || formData.card_type === 'multi_choice' || formData.card_type === 'select_from_options') && (
            <div>
                <label htmlFor={`${optionsInputBaseId}-0`} className="block text-sm font-medium mb-1 label-mobile">
                    {t('study.questionForm.optionsAndAnswer')} <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                    {formData.options.map((option, idx) => {
                        const isChecked = (formData.card_type === 'choice' || formData.card_type === 'select_from_options') 
                            ? formData.answer === option
                            : (multiAnswerSet?.has(option) ?? false);

                        return (
                        <div key={idx} className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    if (!option.trim()) return;
                                    if (formData.card_type === 'choice' || formData.card_type === 'select_from_options') {
                                        setFormData({...formData, answer: option});
                                    } else {
                                        let currentAnswers: string[] = [];
                                        try { currentAnswers = JSON.parse(formData.answer || '[]'); } catch { currentAnswers = []; }
                                        if (!Array.isArray(currentAnswers)) currentAnswers = [];
                                        
                                        if (currentAnswers.includes(option)) {
                                            currentAnswers = currentAnswers.filter(a => a !== option);
                                        } else {
                                            currentAnswers.push(option);
                                        }
                                        setFormData({...formData, answer: JSON.stringify(currentAnswers)});
                                    }
                                }}
                                className={`w-8 h-8 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full border transition-colors touch-target ${
                                    isChecked
                                    ? 'bg-green-500 border-green-500 text-white' 
                                    : 'border-gray-300 hover:border-green-400'
                                }`}
                                title={t('study.questionForm.setAsAnswer')}
                            >
                                {isChecked && <CheckSquare size={18} />}
                            </button>
                            <span className="font-mono text-gray-400 w-6">{String.fromCharCode(65 + idx)}.</span>
                            <input
                                type="text"
                                id={`${optionsInputBaseId}-${idx}`}
                                aria-required={true}
                                aria-invalid={!!errors.options}
                                aria-describedby={errors.options ? optionsErrorId : undefined}
                                value={option}
                                onChange={e => updateOption(idx, e.target.value)}
                                className={`flex-1 p-3 border rounded-lg text-base min-h-[44px] ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}
                                placeholder={t('study.questionForm.optionN', { n: idx + 1 })}
                            />
                            <button
                                onClick={() => removeOption(idx)}
                                aria-label={t('common.aria.removeOption')}
                                className="text-gray-400 hover:text-red-500 p-2 touch-target"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        );
                    })}
                    <button 
                        onClick={addOption}
                        className="text-sm text-primary-500 hover:text-primary-600 font-medium flex items-center gap-1 min-h-[44px] touch-target"
                    >
                        <Plus size={16} /> {t('study.questionForm.addOption')}
                    </button>
                </div>
                {errors.options && <p role="alert" id={optionsErrorId} className="text-red-500 text-xs mt-1">{errors.options}</p>}
            </div>
        )}

        {/* Answer Input */}
        <div>
          <label htmlFor={isAnswerTextarea ? answerId : undefined} className="block text-sm font-medium mb-1 label-mobile">
            {(formData.card_type === 'choice' || formData.card_type === 'multi_choice' || formData.card_type === 'select_from_options') ? t('study.questionForm.answerPreview') : t('study.questionForm.answerLabel')} <span aria-hidden="true" className="text-red-500">*</span>
          </label>
          
          {formData.card_type === 'true_false' ? (
              <fieldset
                role="radiogroup"
                aria-label={t('study.questionForm.trueFalseGroupLabel')}
                className="flex gap-4"
              >
                  <legend className="sr-only">{t('study.questionForm.answerLegend')}</legend>
                  {['True', 'False'].map(val => {
                    const isChecked = formData.answer === val;
                    return (
                      <label
                        key={val}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                          <input
                              type="radio"
                              name="tf_answer"
                              required
                              value={val}
                              checked={isChecked}
                              onChange={e => setFormData({...formData, answer: e.target.value})}
                              className="w-5 h-5 text-primary-600"
                          />
                          <span className="text-base">{val === 'True' ? t('study.questionForm.trueLabel') : t('study.questionForm.falseLabel')}</span>
                      </label>
                    );
                  })}
              </fieldset>
          ) : (formData.card_type === 'choice' || formData.card_type === 'multi_choice' || formData.card_type === 'select_from_options') ? (
              <div className={`p-3 rounded-lg text-sm ${isDark ? 'bg-slate-900 text-slate-400' : 'bg-gray-100 text-gray-600'}`}>
                  {formData.answer || t('study.questionForm.clickToSelectAnswer')}
              </div>
          ) : (
              <textarea
                ref={answerRef}
                id={answerId}
                aria-required={true}
                aria-invalid={!!errors.answer}
                aria-describedby={errors.answer ? answerErrorId : undefined}
                value={formData.answer}
                onChange={e => setFormData({...formData, answer: e.target.value})}
                className={`w-full p-3 border rounded-lg text-base ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} ${errors.answer ? 'border-red-500' : ''} resize-none overflow-hidden min-h-[44px]`}
                rows={1}
                placeholder={formData.card_type === 'cloze' ? t('study.questionForm.answerJsonHint.cloze')
                  : formData.card_type === 'matching' ? t('study.questionForm.answerJsonHint.matching')
                    : formData.card_type === 'ordering' ? t('study.questionForm.answerJsonHint.ordering')
                      : t('study.questionForm.answerPlaceholder')}
              />
          )}
          {errors.answer && <p role="alert" id={answerErrorId} className="text-red-500 text-xs mt-1">{errors.answer}</p>}
        </div>

        <div>
          <label htmlFor={explanationId} className="block text-sm font-medium mb-1 label-mobile">{t('study.questionForm.explanationLabel')}</label>
          <textarea
            ref={explanationRef}
            id={explanationId}
            value={formData.explanation}
            onChange={e => setFormData({...formData, explanation: e.target.value})}
            className={`w-full p-3 border rounded-lg text-base ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} resize-none overflow-hidden min-h-[44px]`}
            rows={1}
            placeholder={t('study.questionForm.explanationPlaceholder')}
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
          <button 
            onClick={onCancel}
            className="px-4 py-3 text-gray-500 hover:text-gray-700 min-h-[44px] touch-target font-medium rounded-lg"
            disabled={isSubmitting}
          >
            {t('study.questionForm.cancel')}
          </button>
          <button 
            onClick={handleSubmit}
            disabled={!formData.question || !formData.answer || isSubmitting || submitting}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 min-h-[44px] touch-target font-medium inline-flex items-center gap-2"
          >
            {(isSubmitting || submitting) ? (
              <><Loader2 size={16} className="animate-spin" />{t('study.questionForm.saving')}</>
            ) : t('study.questionForm.save')}
          </button>
        </div>
      </div>
      {!initialData && showRestorePrompt && (
        <ConfirmationModal
          isOpen={showRestorePrompt}
          onClose={onDiscard}
          onConfirm={onRestore}
          title={t('common.restoreDraftTitle')}
          message={t('common.restoreDraftMessage')}
          isDangerous={false}
        />
      )}
    </div>
  );
};

import React, { useState, useLayoutEffect, useRef } from 'react';
import { StudyCard } from '../../types';
import { CheckSquare, Plus, X } from 'lucide-react';
import { useTheme } from "../../hooks";

export interface QuestionFormData {
  question: string;
  answer: string;
  card_type: string;
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
        (initialData.card_type === 'choice' || initialData.card_type === 'multi_choice') 
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
  const { isDark } = useTheme();
  const [formData, setFormData] = useState<QuestionFormData>(() => getInitialFormData(initialData));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const prevInitialDataRef = useRef(initialData);

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

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.question.trim()) newErrors.question = '请输入问题';
    else if (formData.question.length > 500) newErrors.question = '问题不能超过500字';
    
    if (!formData.answer.trim()) newErrors.answer = '请输入答案';
    
    if ((formData.card_type === 'choice' || formData.card_type === 'multi_choice')) {
      if (formData.options.length < 2) {
        newErrors.options = '选择题至少需要2个选项';
      } else if (formData.options.some(o => !o.trim())) {
        newErrors.options = '选项内容不能为空';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    await onSubmit(formData);
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
    
    if (formData.card_type === 'choice') {
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

  return (
    <div className={`p-4 border-b ${isDark ? 'bg-slate-800/50' : 'bg-indigo-50/50'}`}>
      <div className="space-y-4 max-w-2xl">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">
              问题 <span className="text-red-500">*</span>
              <span className={`ml-2 text-xs font-normal ${formData.question.length > 500 ? 'text-red-500' : 'text-gray-400'}`}>
                {formData.question.length}/500
              </span>
            </label>
            <textarea
              ref={questionRef}
              value={formData.question}
              onChange={e => setFormData({...formData, question: e.target.value})}
              className={`w-full p-2 border rounded-lg ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} ${errors.question ? 'border-red-500' : ''} resize-none overflow-hidden`}
              rows={1}
              placeholder="输入问题内容..."
            />
            {errors.question && <p className="text-red-500 text-xs mt-1">{errors.question}</p>}
          </div>
          <div className="w-32">
            <label className="block text-sm font-medium mb-1">类型</label>
            <select
              value={formData.card_type}
              onChange={e => {
                  const type = e.target.value;
                  setFormData({
                      ...formData, 
                      card_type: type, 
                      options: (type === 'choice' || type === 'multi_choice') ? ['', '', '', ''] : [],
                      answer: ''
                  });
              }}
              className={`w-full p-2 border rounded-lg ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}
              disabled={!!initialData} // Disable type change in edit mode if desired, but usually okay to keep enabled. Let's keep enabled.
            >
              <option value="qa">问答</option>
              <option value="choice">单选</option>
              <option value="multi_choice">多选</option>
              <option value="true_false">判断</option>
              <option value="fill_in_the_blank">填空</option>
              <option value="essay">论述</option>
            </select>
          </div>
        </div>
        
        {/* Options for Choice/Multi-Choice */}
        {(formData.card_type === 'choice' || formData.card_type === 'multi_choice') && (
            <div>
                <label className="block text-sm font-medium mb-1">
                    选项 & 正确答案 <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                    {formData.options.map((option, idx) => {
                        const isChecked = formData.card_type === 'choice' 
                            ? formData.answer === option
                            : (() => {
                                try {
                                    const ans = JSON.parse(formData.answer || '[]');
                                    return Array.isArray(ans) && ans.includes(option);
                                } catch { return false; }
                            })();

                        return (
                        <div key={idx} className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    if (!option.trim()) return;
                                    if (formData.card_type === 'choice') {
                                        setFormData({...formData, answer: option});
                                    } else {
                                        // Multi-choice logic
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
                                className={`w-6 h-6 flex items-center justify-center rounded-full border transition-colors ${
                                    isChecked
                                    ? 'bg-green-500 border-green-500 text-white' 
                                    : 'border-gray-300 hover:border-green-400'
                                }`}
                                title="设为正确答案"
                            >
                                {isChecked && <CheckSquare size={14} />}
                            </button>
                            <span className="font-mono text-gray-400 w-6">{String.fromCharCode(65 + idx)}.</span>
                            <input
                                type="text"
                                value={option}
                                onChange={e => updateOption(idx, e.target.value)}
                                className={`flex-1 p-2 border rounded-lg ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}
                                placeholder={`选项 ${idx + 1}`}
                            />
                            <button onClick={() => removeOption(idx)} className="text-gray-400 hover:text-red-500">
                                <X size={18} />
                            </button>
                        </div>
                        );
                    })}
                    <button 
                        onClick={addOption}
                        className="text-sm text-indigo-500 hover:text-indigo-600 font-medium flex items-center gap-1"
                    >
                        <Plus size={16} /> 添加选项
                    </button>
                </div>
                {errors.options && <p className="text-red-500 text-xs mt-1">{errors.options}</p>}
            </div>
        )}

        {/* Answer Input */}
        <div>
          <label className="block text-sm font-medium mb-1">
            {(formData.card_type === 'choice' || formData.card_type === 'multi_choice') ? '答案预览 (自动生成)' : '答案'} <span className="text-red-500">*</span>
          </label>
          
          {formData.card_type === 'true_false' ? (
              <div className="flex gap-4">
                  {['True', 'False'].map(val => (
                      <label key={val} className="flex items-center gap-2 cursor-pointer">
                          <input 
                              type="radio" 
                              name="tf_answer" 
                              value={val}
                              checked={formData.answer === val}
                              onChange={e => setFormData({...formData, answer: e.target.value})}
                              className="w-4 h-4 text-indigo-600"
                          />
                          <span>{val === 'True' ? '正确 (True)' : '错误 (False)'}</span>
                      </label>
                  ))}
              </div>
          ) : (formData.card_type === 'choice' || formData.card_type === 'multi_choice') ? (
              <div className={`p-2 rounded-lg text-sm ${isDark ? 'bg-slate-900 text-slate-400' : 'bg-gray-100 text-gray-600'}`}>
                  {formData.answer || '请点击上方选项左侧圆圈选择正确答案'}
              </div>
          ) : (
              <textarea
                ref={answerRef}
                value={formData.answer}
                onChange={e => setFormData({...formData, answer: e.target.value})}
                className={`w-full p-2 border rounded-lg ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} ${errors.answer ? 'border-red-500' : ''} resize-none overflow-hidden`}
                rows={1}
                placeholder="输入标准答案..."
              />
          )}
          {errors.answer && <p className="text-red-500 text-xs mt-1">{errors.answer}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">解析 (可选)</label>
          <textarea
            ref={explanationRef}
            value={formData.explanation}
            onChange={e => setFormData({...formData, explanation: e.target.value})}
            className={`w-full p-2 border rounded-lg ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} resize-none overflow-hidden`}
            rows={1}
            placeholder="输入解析..."
          />
        </div>

        <div className="flex justify-end gap-2">
          <button 
            onClick={onCancel}
            className="px-3 py-1.5 text-gray-500 hover:text-gray-700"
            disabled={isSubmitting}
          >
            取消
          </button>
          <button 
            onClick={handleSubmit}
            disabled={!formData.question || !formData.answer || isSubmitting}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSubmitting ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
};

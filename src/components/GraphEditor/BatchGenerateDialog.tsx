import React, { useState } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';

interface BatchGenerateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedNodeIds: string[];
  onSuccess?: (config?: any) => void;
}

export const BatchGenerateDialog: React.FC<BatchGenerateDialogProps> = ({
  isOpen,
  onClose,
  selectedNodeIds,
  onSuccess
}) => {
  const [types, setTypes] = useState<string[]>(['qa', 'choice']);
  const [count, setCount] = useState(3);
  const [isLoading] = useState(false);
  const [packTemplate, setPackTemplate] = useState<string | null>(null);

  const packPresets = [
    { id: 'quick', label: '快速自测', desc: '每节点3题 (问答/选择/判断)', types: ['qa', 'choice', 'true_false'], count: 3 },
    { id: 'standard', label: '标准题目包', desc: '每节点10题 (含多选/填空/解答)', types: ['choice', 'multi_choice', 'fill_in_the_blank', 'essay'], count: 10 },
    { id: 'exam', label: '考前冲刺', desc: '每节点15题 (偏重复杂题型)', types: ['choice', 'multi_choice', 'essay'], count: 15 },
  ];

  const handleSelectPreset = (preset: any) => {
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
  React.useEffect(() => {
    let interval: any;
    if (taskId) {
        interval = setInterval(async () => {
            try {
                const res: any = await api.ai.getTaskStatus(taskId);
                const task = res;
                
                if (task.status === 'completed') {
                    setTaskId(null);
                    setIsLoading(false);
                    onSuccess?.();
                    onClose();
                    alert(`生成完成！共生成 ${task.result.totalCards} 道题目`);
                } else if (task.status === 'failed') {
                    setTaskId(null);
                    setIsLoading(false);
                    alert(`生成失败: ${task.error}`);
                } else if (task.status === 'processing' && task.result) {
                    setProgress({
                        current: task.result.progress || 0,
                        total: 100,
                        message: task.result.current_node ? `正在处理: ${task.result.current_node}` : '生成中...'
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-center">
             <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
               <Sparkles size={20} />
               <h3 className="text-lg font-semibold">批量生成题目</h3>
             </div>
             <button onClick={onClose} className="text-slate-400 hover:text-slate-500">
               <X size={20} />
             </button>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            将为 {selectedNodeIds.length} 个节点生成题目，支持上下文感知。
          </p>
        </div>
        
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Presets / Packs */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">选择题目包预设</label>
            <div className="grid grid-cols-1 gap-3">
              {packPresets.map(preset => (
                <div 
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset)}
                  className={`cursor-pointer p-3 rounded-lg border transition-all
                    ${packTemplate === preset.id 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400' 
                      : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'}`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className={`font-semibold text-sm ${packTemplate === preset.id ? 'text-blue-600 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'}`}>
                      {preset.label}
                    </span>
                    {packTemplate === preset.id && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{preset.desc}</p>
                </div>
              ))}
              <div 
                onClick={() => setPackTemplate(null)}
                className={`cursor-pointer p-3 rounded-lg border transition-all text-center text-xs font-medium
                  ${packTemplate === null 
                    ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:border-blue-400 dark:text-blue-300' 
                    : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700'}`}
              >
                自定义设置
              </div>
            </div>
          </div>

          {packTemplate === null && (
            <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">
              {/* Types */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">题目类型</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'qa', label: '问答题' },
                    { id: 'choice', label: '单选题' },
                    { id: 'true_false', label: '判断题' },
                    { id: 'multi_choice', label: '多选题' },
                    { id: 'fill_in_the_blank', label: '填空题' },
                    { id: 'essay', label: '解答题' }
                  ].map(type => (
                    <div 
                      key={type.id}
                      onClick={() => handleToggleType(type.id)}
                      className={`cursor-pointer px-2 py-2 rounded-md border text-xs font-medium transition-all text-center
                        ${types.includes(type.id) 
                          ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:border-blue-400 dark:text-blue-300' 
                          : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400'}`}
                    >
                      {type.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Count */}
              <div className="space-y-3">
                <div className="flex justify-between">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">每节点生成数量</label>
                    <span className="text-sm text-blue-600 font-medium">{count}</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="20" 
                  value={count} 
                  onChange={(e) => setCount(parseInt(e.target.value))}
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
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded text-xs text-blue-600 dark:text-blue-400">
             预计生成: <span className="font-bold">{selectedNodeIds.length * count}</span> 道题目
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-md text-sm font-medium transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleGenerate}
            disabled={isLoading || types.length === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px] justify-center"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            开始生成
          </button>
        </div>
      </div>
    </div>
  );
};

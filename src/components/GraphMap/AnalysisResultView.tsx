import React, { useState } from 'react';
import { CheckCircle2, Copy, Check, Link2, ArrowRight, CheckCircle, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { StructuredAnalysisResult } from '../../services/api/agent';
import { agentApi } from '../../services/api/agent';

interface AnalysisResultViewProps {
  result: string;
  structuredResult?: StructuredAnalysisResult;
}

const relationTypeLabels: Record<string, string> = {
  prerequisite: '前置依赖',
  extension: '扩展',
  related: '相关',
  cross_domain: '跨领域',
};

export const AnalysisResultView: React.FC<AnalysisResultViewProps> = ({ result, structuredResult }) => {
  const [copied, setCopied] = useState(false);
  const [selectedRecs, setSelectedRecs] = useState<Set<string>>(new Set());
  const [isApplying, setIsApplying] = useState(false);
  const [appliedRecs, setAppliedRecs] = useState<Set<string>>(new Set());

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleRecommendation = (id: string) => {
    const newSet = new Set(selectedRecs);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedRecs(newSet);
  };

  const selectAll = () => {
    if (structuredResult?.recommendations) {
      const allIds = new Set(structuredResult.recommendations.map(r => r.id));
      setSelectedRecs(allIds);
    }
  };

  const applySelected = async () => {
    if (!structuredResult || selectedRecs.size === 0) return;

    setIsApplying(true);
    try {
      const recsToApply = structuredResult.recommendations.filter(r => selectedRecs.has(r.id));
      await agentApi.applyRecommendations(recsToApply);
      setAppliedRecs(new Set(selectedRecs));
      setSelectedRecs(new Set());
    } catch (error) {
      console.error('Failed to apply recommendations:', error);
    } finally {
      setIsApplying(false);
    }
  };

  const hasRecommendations = structuredResult?.recommendations && structuredResult.recommendations.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium">分析完成</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>

      <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300 max-h-[300px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none prose-headings:text-gray-900 dark:prose-headings:text-white prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-li:text-gray-700 dark:prose-li:text-gray-300 prose-strong:text-gray-900 dark:prose-strong:text-white prose-code:text-indigo-600 dark:prose-code:text-indigo-400 prose-pre:bg-gray-100 dark:prose-pre:bg-slate-900">
        <ReactMarkdown>{result}</ReactMarkdown>
      </div>

      {hasRecommendations && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              推荐的图谱关联
            </h4>
            <div className="flex items-center gap-2">
              <button
                onClick={selectAll}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                全选
              </button>
              <span className="text-xs text-gray-400">|</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                已选择 {selectedRecs.size} 项
              </span>
            </div>
          </div>

          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {structuredResult!.recommendations.map((rec) => {
              const isSelected = selectedRecs.has(rec.id);
              const isApplied = appliedRecs.has(rec.id);

              return (
                <div
                  key={rec.id}
                  onClick={() => !isApplied && toggleRecommendation(rec.id)}
                  className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                    isApplied
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800'
                        : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {isApplied ? (
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <div
                          className={`w-4 h-4 rounded border flex-shrink-0 ${
                            isSelected
                              ? 'bg-indigo-500 border-indigo-500'
                              : 'border-gray-300 dark:border-gray-600'
                          }`}
                        >
                          {isSelected && (
                            <svg className="w-4 h-4 text-white" viewBox="0 0 16 16" fill="currentColor">
                              <path d="M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z" />
                            </svg>
                          )}
                        </div>
                      )}
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {rec.source_graph_title}
                      </span>
                      <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {rec.target_graph_title}
                      </span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 ml-2 flex-shrink-0">
                      {relationTypeLabels[rec.relation_type] || rec.relation_type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                    {rec.reason}
                  </p>
                </div>
              );
            })}
          </div>

          {selectedRecs.size > 0 && (
            <button
              onClick={applySelected}
              disabled={isApplying}
              className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isApplying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  应用中...
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4" />
                  应用选中项 ({selectedRecs.size})
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

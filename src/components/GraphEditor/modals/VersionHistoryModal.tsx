import { useState, useEffect } from 'react';
import { useTranslation } from "react-i18next";
import { X, History, RotateCcw, GitCompare, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { knowledgePointsApi } from '../../../services/api/knowledgePoints';
import type { KnowledgePointVersionWithDiff, KnowledgePointVersionDiff } from '../../../types';
import { message } from "../../../utils/messageHelper";
import { formatDate as formatDateUtil } from '../../../utils/formatters';
import { asyncConfirm } from '@/utils/asyncConfirm';
import { ModalShell } from '../../common';
import { EmptyState } from '../../common/EmptyState';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  knowledgePointId: string;
  knowledgePointTitle: string;
  onRollback?: () => void;
}

export const VersionHistoryModal = ({
  isOpen,
  onClose,
  knowledgePointId,
  knowledgePointTitle,
  onRollback,
}: VersionHistoryModalProps) => {
  const [versions, setVersions] = useState<KnowledgePointVersionWithDiff[]>([]);
  const [total, setTotal] = useState(0);
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<KnowledgePointVersionWithDiff | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareVersions, setCompareVersions] = useState<[number | null, number | null]>([null, null]);
  const [compareResult, setCompareResult] = useState<KnowledgePointVersionWithDiff[] | null>(null);
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    if (isOpen && knowledgePointId) {
      loadVersions();
    }
  }, [isOpen, knowledgePointId, offset]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const result = await knowledgePointsApi.getVersions(knowledgePointId, {
        limit: pageSize,
        offset,
      });
      setVersions(result.versions);
      setTotal(result.total);
    } catch (error) {
      console.error('Failed to load versions:', error);
      message.error(t('graphEditor.versionHistory.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (versionNumber: number) => {
    if (!await asyncConfirm({
      title: t('common.confirm.rollbackTitle'),
      message: t('common.confirm.rollbackMessage', { version: versionNumber }),
      isDangerous: true,
    })) {
      return;
    }

    setRollbackLoading(true);
    try {
      await knowledgePointsApi.rollbackVersion(knowledgePointId, versionNumber);
      message.success(t('graphEditor.versionHistory.rollbackSuccess', { version: versionNumber }));
      loadVersions();
      onRollback?.();
    } catch (error) {
      console.error('Rollback failed:', error);
      message.error(t('graphEditor.versionHistory.rollbackFailed'));
    } finally {
      setRollbackLoading(false);
    }
  };

  const handleCompareSelect = (versionNumber: number) => {
    if (compareVersions[0] === null) {
      setCompareVersions([versionNumber, null]);
    } else if (compareVersions[1] === null && versionNumber !== compareVersions[0]) {
      setCompareVersions([compareVersions[0], versionNumber]);
    } else {
      setCompareVersions([versionNumber, null]);
    }
  };

  const executeCompare = async () => {
    if (compareVersions[0] === null || compareVersions[1] === null) return;

    setLoading(true);
    try {
      const result = await knowledgePointsApi.compareVersions(
        knowledgePointId,
        compareVersions[0],
        compareVersions[1]
      );
      setCompareResult(result);
    } catch (error) {
      console.error('Compare failed:', error);
      message.error(t('graphEditor.versionHistory.compareFailed'));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return formatDateUtil(dateStr, 'full-datetime');
  };

  const renderDiffItem = (diff: KnowledgePointVersionDiff) => {
    const fieldLabels: Record<string, string> = {
      title: t('graphEditor.versionHistory.fieldLabel.title'),
      content: t('graphEditor.versionHistory.fieldLabel.content'),
      learning_material: t('graphEditor.versionHistory.fieldLabel.learningMaterial'),
      properties: t('graphEditor.versionHistory.fieldLabel.properties'),
    };

    return (
      <div key={diff.field} className="mb-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {fieldLabels[diff.field] || diff.field}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-100 dark:border-red-800">
            <div className="text-red-600 dark:text-red-400 font-medium mb-1">{t('graphEditor.versionHistory.oldValueLabel')}</div>
            <div className="text-gray-600 dark:text-gray-400 line-clamp-3">
              {typeof diff.old_value === 'object' 
                ? JSON.stringify(diff.old_value, null, 2) 
                : String(diff.old_value || t('graphEditor.diffDetail.emptyValue'))}
            </div>
          </div>
          <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-100 dark:border-green-800">
            <div className="text-green-600 dark:text-green-400 font-medium mb-1">{t('graphEditor.versionHistory.newValueLabel')}</div>
            <div className="text-gray-600 dark:text-gray-400 line-clamp-3">
              {typeof diff.new_value === 'object' 
                ? JSON.stringify(diff.new_value, null, 2) 
                : String(diff.new_value || t('graphEditor.diffDetail.emptyValue'))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      titleId="version-history-modal-title"
      className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden animate-fade-in-up"
    >
        <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg text-primary-600 dark:text-primary-400">
              <History size={24} />
            </div>
            <div>
              <h2 id="version-history-modal-title" className="text-xl font-bold text-gray-800 dark:text-gray-100">{t('graphEditor.versionHistory.title')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                {knowledgePointTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.aria.close')}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex border-b border-gray-100 dark:border-gray-800 px-6">
          <button
            onClick={() => { setCompareMode(false); setCompareVersions([null, null]); setCompareResult(null); }}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              !compareMode 
                ? 'border-primary-500 text-primary-600 dark:text-primary-400' 
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            {t('graphEditor.versionHistory.tabVersionList')}
          </button>
          <button
            onClick={() => { setCompareMode(true); setCompareResult(null); }}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center ${
              compareMode 
                ? 'border-primary-500 text-primary-600 dark:text-primary-400' 
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            <GitCompare size={16} className="mr-1" />
            {t('graphEditor.diffDetail.title')}
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-180px)] p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-primary-500" size={32} />
            </div>
          ) : compareMode ? (
            <div>
              {compareResult ? (
                <div className="space-y-6">
                  <button
                    onClick={() => setCompareResult(null)}
                    className="text-sm text-primary-600 dark:text-primary-400 underline"
                  >
                    {t('graphEditor.versionHistory.backToSelection')}
                  </button>
                  {compareResult.map((version, idx) => (
                    <div 
                      key={version.id}
                      className={`p-4 rounded-xl border ${
                        idx === 0 
                          ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' 
                          : 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-bold text-gray-800 dark:text-gray-200">
                          {t('graphEditor.versionHistory.versionLabel', { number: version.version_number })}
                        </h4>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(version.created_at)}
                        </span>
                      </div>
                      {version.diffs && version.diffs.length > 0 && (
                        <div className="space-y-2">
                          {version.diffs.map(renderDiffItem)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    {t('graphEditor.versionHistory.selectTwoToCompare')}
                  </p>
                  <div className="space-y-2 mb-4">
                    {versions.map((version) => (
                      <button
                        key={version.id}
                        onClick={() => handleCompareSelect(version.version_number)}
                        className={`w-full p-3 rounded-lg border text-left transition-all ${
                          compareVersions.includes(version.version_number)
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-primary-300'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-gray-800 dark:text-gray-200">
                            {t('graphEditor.versionHistory.versionLabel', { number: version.version_number })}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(version.created_at)}
                          </span>
                        </div>
                        {version.change_summary && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
                            {version.change_summary}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                  {compareVersions[0] !== null && compareVersions[1] !== null && (
                    <button
                      onClick={executeCompare}
                      className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                    >
                      {t('graphEditor.versionHistory.compareButton', { v1: compareVersions[0], v2: compareVersions[1] })}
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : selectedVersion ? (
            <div>
              <button
                onClick={() => setSelectedVersion(null)}
                className="text-sm text-primary-600 dark:text-primary-400 underline mb-4"
              >
                {t('graphEditor.versionHistory.backToList')}
              </button>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold text-gray-800 dark:text-gray-200">
                    {t('graphEditor.versionHistory.versionLabel', { number: selectedVersion.version_number })}
                  </h4>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(selectedVersion.created_at)}
                  </span>
                </div>
                {selectedVersion.change_summary && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {selectedVersion.change_summary}
                  </p>
                )}
              </div>
              
              <div className="space-y-4">
                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('graphEditor.versionHistory.fieldLabel.title')}</h5>
                  <p className="text-gray-800 dark:text-gray-200">{selectedVersion.title}</p>
                </div>
                
                {selectedVersion.content && (
                  <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('graphEditor.versionHistory.fieldLabel.content')}</h5>
                    <div className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap text-sm max-h-60 overflow-y-auto">
                      {selectedVersion.content}
                    </div>
                  </div>
                )}

                {selectedVersion.learning_material && (
                  <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('graphEditor.versionHistory.fieldLabel.learningMaterial')}</h5>
                    <div className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap text-sm max-h-60 overflow-y-auto">
                      {selectedVersion.learning_material}
                    </div>
                  </div>
                )}

                {selectedVersion.diffs && selectedVersion.diffs.length > 0 && (
                  <div className="mt-4">
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t('graphEditor.versionHistory.changeContent')}</h5>
                    {selectedVersion.diffs.map(renderDiffItem)}
                  </div>
                )}
              </div>

              <button
                onClick={() => handleRollback(selectedVersion.version_number)}
                disabled={rollbackLoading}
                className="mt-6 w-full py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium flex items-center justify-center disabled:opacity-50"
              >
                {rollbackLoading ? (
                  <Loader2 className="animate-spin mr-2" size={18} />
                ) : (
                  <RotateCcw size={18} className="mr-2" />
                )}
                {t('graphEditor.versionHistory.rollbackToThisVersion')}
              </button>
            </div>
          ) : (
            <div>
              {versions.length === 0 ? (
                <EmptyState
                  icon={<History size={32} />}
                  title={t('graphEditor.empty.versionHistory')}
                />
              ) : (
                <div className="space-y-3">
                  {versions.map((version) => (
                    <button
                      key={version.id}
                      onClick={() => setSelectedVersion(version)}
                      className="w-full p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 transition-all text-left group"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center">
                          <span className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center text-sm font-bold mr-3">
                            {version.version_number}
                          </span>
                          <span className="font-medium text-gray-800 dark:text-gray-200 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                            {version.title}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(version.created_at)}
                        </span>
                      </div>
                      {version.change_summary && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 ml-11 truncate">
                          {version.change_summary}
                        </p>
                      )}
                      {version.diffs && version.diffs.length > 0 && (
                        <div className="ml-11 mt-2 flex flex-wrap gap-2">
                          {version.diffs.map((diff) => (
                            <span 
                              key={diff.field}
                              className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-400"
                            >
                              {diff.field === 'title' ? t('graphEditor.versionHistory.fieldLabel.title') :
                               diff.field === 'content' ? t('graphEditor.versionHistory.fieldLabel.content') :
                               diff.field === 'learning_material' ? t('graphEditor.versionHistory.fieldLabel.learningMaterial') : diff.field}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {total > pageSize && (
                <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <button
                    onClick={() => setOffset(Math.max(0, offset - pageSize))}
                    disabled={offset === 0}
                    className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={16} className="mr-1" />
                    {t('graphEditor.versionHistory.prevPage')}
                  </button>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {t('graphEditor.versionHistory.pageIndicator', { current: Math.floor(offset / pageSize) + 1, total: Math.ceil(total / pageSize) })}
                  </span>
                  <button
                    onClick={() => setOffset(offset + pageSize)}
                    disabled={offset + pageSize >= total}
                    className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('graphEditor.versionHistory.nextPage')}
                    <ChevronRight size={16} className="ml-1" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
    </ModalShell>
  );
};

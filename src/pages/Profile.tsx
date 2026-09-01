import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUser } from '../hooks/queries';
import { useLogoutMutation } from '../hooks/mutations';
import { queryKeys } from '../hooks/queries/config';
import { useStore } from '../store/useStore';
import { LogOut, User, Settings as SettingsIcon, ExternalLink, Database, Download, Upload, AlertTriangle, Trash2, RotateCcw, Clock, Plus, RefreshCw } from 'lucide-react';
import { backupApi, BackupSnapshot } from '../services/api/backup';
import { queryClient } from '../main';
import { asyncConfirm } from '@/utils/asyncConfirm';
import { formatDate } from '@/utils/formatters';
import { EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/common/Skeleton';
import { message } from '@/utils/messageHelper';
import { motion } from 'framer-motion';

export const Profile = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, token, setUser } = useStore();
  const logoutMutation = useLogoutMutation();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('replace');
  const [snapshots, setSnapshots] = useState<BackupSnapshot[]>([]);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: userData, isLoading } = useUser(!!token);

  const refreshAllData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.graphs }),
      queryClient.invalidateQueries({ queryKey: queryKeys.graphMap() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.domainTree() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats }),
      queryClient.invalidateQueries({ queryKey: ['studyCards'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.statistics }),
      queryClient.invalidateQueries({ queryKey: ['tasks'] }),
      // 备份导入/恢复会重写任务、队列与路径，需让首页「下一步」也失效后重新调度，
      // 否则 staleTime 内的 next-step 缓存不及时反映新数据（需 force reload 才更新）。
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduler() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.schedulerNextStep() }),
    ]);
  };

  const loadSnapshots = async () => {
    setIsLoadingSnapshots(true);
    try {
      const data = await backupApi.getSnapshots();
      setSnapshots(data);
    } catch (e) {
      console.error(e);
      message.error(t('profile.snapshotFailed'));
    } finally {
      setIsLoadingSnapshots(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadSnapshots();
    }
  }, [token]);

  const profile = userData?.user?.profile;
  const displayName = profile?.name || userData?.user?.user_metadata?.name || user?.name || t('profile.accountInfo.unnamedUser');
  const email = userData?.user?.email || user?.email || '-';

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (e) {
      console.error(e);
      message.error(t('profile.logoutFailed'));
    }
    setUser(null, null);
    message.success(t('profile.messages.logoutSuccess'));
    navigate('/login');
  };

  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const blob = await backupApi.export();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `knowledgemap-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      message.success(t('profile.messages.exportSuccess'));
    } catch (e) {
      console.error(e);
      message.error(t('profile.messages.exportFailed'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.version || !data.data) {
        throw new Error(t('profile.messages.invalidBackupFormat'));
      }

      const result = await backupApi.import(data, importMode);
      message.success(t('profile.messages.importSuccess', {
        message: result.message,
        graphs: result.stats.graphs,
        nodes: result.stats.nodes,
        cards: result.stats.study_cards
      }));
      await refreshAllData();
      loadSnapshots();
    } catch (e: unknown) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : t('profile.messages.importFailed');
      message.error(errorMessage);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCreateSnapshot = async () => {
    setIsCreatingSnapshot(true);
    try {
      await backupApi.createSnapshot('manual');
      message.success(t('profile.messages.snapshotCreateSuccess'));
      loadSnapshots();
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : t('profile.messages.snapshotCreateFailed');
      message.error(errorMessage);
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  const handleRestoreSnapshot = async (id: string) => {
    if (!await asyncConfirm({ title: t('profile.backup.restoreSnapshot'), message: t('profile.messages.confirmRestore'), isDangerous: true })) return;

    setRestoringId(id);
    try {
      const result = await backupApi.restoreSnapshot(id);
      message.success(t('profile.messages.snapshotRestoreSuccess', {
        message: result.message,
        graphs: result.stats.graphs,
        nodes: result.stats.nodes
      }));
      await refreshAllData();
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : t('profile.messages.snapshotRestoreFailed');
      message.error(errorMessage);
    } finally {
      setRestoringId(null);
    }
  };

  const handleDeleteSnapshot = async (id: string) => {
    if (!await asyncConfirm({ title: t('profile.backup.deleteSnapshot'), message: t('profile.messages.confirmDelete'), isDangerous: true })) return;

    setDeletingId(id);
    try {
      await backupApi.deleteSnapshot(id);
      message.success(t('profile.messages.snapshotDeleteSuccess'));
      setSnapshots(prev => prev.filter(s => s.id !== id));
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : t('profile.messages.snapshotDeleteFailed');
      message.error(errorMessage);
    } finally {
      setDeletingId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'auto_30min': return t('profile.backup.snapshotTypes.auto_30min');
      case 'auto_5hour': return t('profile.backup.snapshotTypes.auto_5hour');
      case 'auto_1day': return t('profile.backup.snapshotTypes.auto_1day');
      case 'manual': return t('profile.backup.snapshotTypes.manual');
      default: return type;
    }
  };

  return (
    <div className="h-full overflow-y-auto p-8 bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{t('profile.title')}</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">{t('profile.subtitle')}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white flex items-center gap-2 transition-colors"
            disabled={logoutMutation.isPending}
          >
            <LogOut className="w-4 h-4" />
            <span>{logoutMutation.isPending ? t('profile.loggingOut') : t('profile.logout')}</span>
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-500 p-6 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('profile.accountInfo.title')}</h2>
          </div>

          {isLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              <Skeleton variant="rectangular" height={80} className="rounded-lg" />
              <Skeleton variant="rectangular" height={80} className="rounded-lg" />
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-500">
                <div className="text-gray-500 dark:text-gray-400">{t('profile.accountInfo.nickname')}</div>
                <div className="mt-1 font-semibold text-gray-900 dark:text-gray-100 break-words">{displayName}</div>
              </div>
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-500">
                <div className="text-gray-500 dark:text-gray-400">{t('profile.accountInfo.email')}</div>
                <div className="mt-1 font-semibold text-gray-900 dark:text-gray-100 break-words">{email}</div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-500 p-6 transition-colors">
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <SettingsIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('profile.systemSettings.title')}</h2>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t('profile.systemSettings.description')}</p>
                </div>
                <button
                    onClick={() => navigate('/settings')}
                    className="px-4 py-2 rounded-md bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-slate-600 flex items-center gap-2 transition-colors"
                >
                    <span>{t('profile.systemSettings.goToSettings')}</span>
                    <ExternalLink className="w-4 h-4" />
                </button>
            </div>
        </div>

        {/* Data Backup Section */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-500 p-6 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('profile.backup.title')}</h2>
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {t('profile.backup.description')}
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleExportBackup}
              disabled={isExporting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              <Download className="w-5 h-5" />
              <span>{isExporting ? t('profile.backup.exporting') : t('profile.backup.exportBackup')}</span>
            </button>

            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                autoComplete="off"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-slate-500 text-gray-600 dark:text-gray-400 hover:border-primary-400 hover:text-primary-600 dark:hover:border-primary-500 dark:hover:text-primary-400 disabled:opacity-50 transition-colors"
              >
                <Upload className="w-5 h-5" />
                <span>{isImporting ? t('profile.backup.importing') : t('profile.backup.importBackup')}</span>
              </button>
            </div>
          </div>

          <div className="mt-4 p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-500">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('profile.backup.importMode')}</div>
            <fieldset className="flex gap-4">
              <legend className="sr-only">{t('profile.importMode.legend')}</legend>
              <label htmlFor="import-mode-replace" aria-label={t('profile.backup.snapshotRestore')} className="flex items-center gap-2 cursor-pointer">
                <input
                  id="import-mode-replace"
                  type="radio"
                  name="importMode"
                  autoComplete="off"
                  value="replace"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                  className="w-4 h-4 text-primary-600"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">{t('profile.backup.snapshotRestore')}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-500 ml-1">{t('profile.backup.snapshotRestoreHint')}</span>
                </span>
              </label>
              <label htmlFor="import-mode-merge" aria-label={t('profile.backup.mergeImport')} className="flex items-center gap-2 cursor-pointer">
                <input
                  id="import-mode-merge"
                  type="radio"
                  name="importMode"
                  autoComplete="off"
                  value="merge"
                  checked={importMode === 'merge'}
                  onChange={() => setImportMode('merge')}
                  className="w-4 h-4 text-primary-600"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">{t('profile.backup.mergeImport')}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-500 ml-1">{t('profile.backup.mergeImportHint')}</span>
                </span>
              </label>
            </fieldset>
          </div>

          <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-800 dark:text-amber-300">
                <strong>{t('profile.backup.tip')}</strong>{t('profile.backup.tipContent')}
              </div>
            </div>
          </div>

          {/* Snapshots List */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('profile.backup.snapshotList')}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={loadSnapshots}
                  disabled={isLoadingSnapshots}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-slate-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingSnapshots ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={handleCreateSnapshot}
                  disabled={isCreatingSnapshot}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 text-white text-sm hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isCreatingSnapshot ? t('profile.backup.creating') : t('profile.backup.createSnapshot')}</span>
                </button>
              </div>
            </div>

            {isLoadingSnapshots ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">{t('profile.accountInfo.loading')}</div>
            ) : snapshots.length === 0 ? (
              <EmptyState
                icon={<Database size={32} />}
                title={t('profile.backup.noSnapshots')}
                description={t('profile.backup.noSnapshotsHint')}
                action={{ label: t('profile.createSnapshot'), onClick: handleCreateSnapshot }}
              />
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {snapshots.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-500"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          snapshot.type === 'manual' 
                            ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-400'
                        }`}>
                          {getTypeLabel(snapshot.type)}
                        </span>
                        <span className="text-sm text-gray-900 dark:text-gray-100">
                          {t('profile.backup.graphsAndNodes', { graphs: snapshot.graphs_count, nodes: snapshot.nodes_count })}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {formatDate(snapshot.created_at, 'short-datetime')} · {formatFileSize(snapshot.file_size)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => handleRestoreSnapshot(snapshot.id)}
                        disabled={restoringId === snapshot.id}
                        className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20 disabled:opacity-50 transition-colors"
                        title={t('profile.backup.restoreSnapshot')}
                      >
                        <RotateCcw className={`w-4 h-4 ${restoringId === snapshot.id ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        onClick={() => handleDeleteSnapshot(snapshot.id)}
                        disabled={deletingId === snapshot.id}
                        className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                        title={t('profile.backup.deleteSnapshot')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

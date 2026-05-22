import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUser } from '../hooks/queries';
import { useLogoutMutation } from '../hooks/mutations';
import { useStore } from '../store/useStore';
import { frontendEventBus } from "../services/timer/FrontendEventBus";
import { LogOut, User, Settings as SettingsIcon, ExternalLink, MessageSquare, X, Database, Download, Upload, AlertTriangle, Trash2, RotateCcw, Clock, Plus, RefreshCw } from 'lucide-react';
import { PromptSettingsPanel } from '../components/GraphEditor/panels/PromptSettingsPanel';
import { AIActionSettingsPanel } from '../components/GraphEditor/panels/AIActionSettingsPanel';
import { backupApi, BackupSnapshot } from '../services/api/backup';
import { queryClient } from '../main';

export const Profile = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, token, setUser } = useStore();
  const logoutMutation = useLogoutMutation();
  const [isPromptSettingsOpen, setIsPromptSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'prompts' | 'actions'>('prompts');
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
      queryClient.invalidateQueries({ queryKey: ['graphs'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] }),
      queryClient.invalidateQueries({ queryKey: ['studyCards'] }),
      queryClient.invalidateQueries({ queryKey: ['statistics'] }),
      queryClient.invalidateQueries({ queryKey: ['tasks'] }),
    ]);
  };

  const loadSnapshots = async () => {
    setIsLoadingSnapshots(true);
    try {
      const data = await backupApi.getSnapshots();
      setSnapshots(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingSnapshots(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadSnapshots();
    }
  }, [token]);

  const profile = (userData as any)?.user?.profile;
  const displayName = profile?.name || (userData as any)?.user?.user_metadata?.name || user?.name || t('profile.accountInfo.unnamedUser');
  const email = (userData as any)?.user?.email || user?.email || '-';

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (e) {
      console.error(e);
    }
    setUser(null, null);
    frontendEventBus.publish("message_show", { type: 'success', content: t('profile.messages.logoutSuccess') });
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
      frontendEventBus.publish("message_show", { type: 'success', content: t('profile.messages.exportSuccess') });
    } catch (e) {
      console.error(e);
      frontendEventBus.publish("message_show", { type: 'error', content: t('profile.messages.exportFailed') });
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
      frontendEventBus.publish("message_show", { 
        type: 'success', 
        content: t('profile.messages.importSuccess', {
          message: result.message,
          graphs: result.stats.graphs,
          nodes: result.stats.nodes,
          cards: result.stats.study_cards
        })
      });
      await refreshAllData();
      loadSnapshots();
    } catch (e: unknown) {
      console.error(e);
      const message = e instanceof Error ? e.message : t('profile.messages.importFailed');
      frontendEventBus.publish("message_show", { type: 'error', content: message });
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
      frontendEventBus.publish("message_show", { type: 'success', content: t('profile.messages.snapshotCreateSuccess') });
      loadSnapshots();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t('profile.messages.snapshotCreateFailed');
      frontendEventBus.publish("message_show", { type: 'error', content: message });
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  const handleRestoreSnapshot = async (id: string) => {
    if (!confirm(t('profile.messages.confirmRestore'))) return;
    
    setRestoringId(id);
    try {
      const result = await backupApi.restoreSnapshot(id);
      frontendEventBus.publish("message_show", { 
        type: 'success', 
        content: t('profile.messages.snapshotRestoreSuccess', {
          message: result.message,
          graphs: result.stats.graphs,
          nodes: result.stats.nodes
        })
      });
      await refreshAllData();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t('profile.messages.snapshotRestoreFailed');
      frontendEventBus.publish("message_show", { type: 'error', content: message });
    } finally {
      setRestoringId(null);
    }
  };

  const handleDeleteSnapshot = async (id: string) => {
    if (!confirm(t('profile.messages.confirmDelete'))) return;
    
    setDeletingId(id);
    try {
      await backupApi.deleteSnapshot(id);
      frontendEventBus.publish("message_show", { type: 'success', content: t('profile.messages.snapshotDeleteSuccess') });
      setSnapshots(prev => prev.filter(s => s.id !== id));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t('profile.messages.snapshotDeleteFailed');
      frontendEventBus.publish("message_show", { type: 'error', content: message });
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

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('profile.accountInfo.title')}</h2>
          </div>

          {isLoading ? (
            <div className="text-gray-600 dark:text-gray-400">{t('profile.accountInfo.loading')}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700">
                <div className="text-gray-500 dark:text-gray-400">{t('profile.accountInfo.nickname')}</div>
                <div className="mt-1 font-semibold text-gray-900 dark:text-gray-100 break-words">{displayName}</div>
              </div>
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700">
                <div className="text-gray-500 dark:text-gray-400">{t('profile.accountInfo.email')}</div>
                <div className="mt-1 font-semibold text-gray-900 dark:text-gray-100 break-words">{email}</div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 transition-colors">
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

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 transition-colors">
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <MessageSquare className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('profile.promptManagement.title')}</h2>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t('profile.promptManagement.description')}</p>
                </div>
                <button
                    onClick={() => setIsPromptSettingsOpen(true)}
                    className="px-4 py-2 rounded-md bg-primary-50 dark:bg-slate-700 text-primary-700 dark:text-white hover:bg-primary-100 dark:hover:bg-slate-600 flex items-center gap-2 transition-colors"
                >
                    <span>{t('profile.promptManagement.managePrompts')}</span>
                    <ExternalLink className="w-4 h-4" />
                </button>
            </div>
        </div>

        {/* Data Backup Section */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 transition-colors">
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
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-400 hover:border-primary-400 hover:text-primary-600 dark:hover:border-primary-500 dark:hover:text-primary-400 disabled:opacity-50 transition-colors"
              >
                <Upload className="w-5 h-5" />
                <span>{isImporting ? t('profile.backup.importing') : t('profile.backup.importBackup')}</span>
              </button>
            </div>
          </div>

          <div className="mt-4 p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('profile.backup.importMode')}</div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
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
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
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
            </div>
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
                  className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-slate-700 transition-colors"
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
              <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                {t('profile.backup.noSnapshots')}
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {snapshots.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700"
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
                        {new Date(snapshot.created_at).toLocaleString('zh-CN')} · {formatFileSize(snapshot.file_size)}
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
      {/* Prompt Settings Modal */}
      {isPromptSettingsOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in-up">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                  <MessageSquare size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('profile.promptSettings.title')}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('profile.promptSettings.description')}</p>
                </div>
              </div>
              <button onClick={() => setIsPromptSettingsOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex border-b border-gray-100 dark:border-gray-700 px-6 bg-gray-50/50 dark:bg-gray-800/50">
                <button 
                    className={`pb-3 pt-3 px-4 text-sm font-medium transition-colors relative ${activeTab === 'prompts' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                    onClick={() => setActiveTab('prompts')}
                >
                    {t('profile.promptSettings.promptTemplates')}
                    {activeTab === 'prompts' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary-600 dark:bg-primary-400 rounded-t-full" />}
                </button>
                <button 
                    className={`pb-3 pt-3 px-4 text-sm font-medium transition-colors relative ${activeTab === 'actions' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                    onClick={() => setActiveTab('actions')}
                >
                    {t('profile.promptSettings.customActions')}
                    {activeTab === 'actions' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary-600 dark:bg-primary-400 rounded-t-full" />}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {activeTab === 'prompts' ? (
                <PromptSettingsPanel scope="user" />
              ) : (
                <AIActionSettingsPanel scope="user" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

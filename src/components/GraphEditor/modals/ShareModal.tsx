import React, { useState, useEffect, useId, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Globe, Lock, Copy, Check, ExternalLink, Users, UserPlus, Link as LinkIcon } from 'lucide-react';
import { api } from '../../../services/api';
import { message } from "../../../utils/messageHelper";
import type { CollaboratorRole, CollaboratorWithUser } from '@shared/types';
import { useStore } from '../../../store/useStore';
import { asyncConfirm } from '@/utils/asyncConfirm';
import { copyToClipboard } from '@/utils/clipboard';
import { useFocusTrap, useEscapeKey } from '../../../hooks/common';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  graphId: string;
  isPublic: boolean;
  onPublicChange: (isPublic: boolean) => void;
  ownerId?: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  graphId,
  isPublic: initialIsPublic,
  onPublicChange,
  ownerId
}) => {
  const { user } = useStore();
  const { t } = useTranslation();
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'public' | 'collaborate'>('collaborate');
  const [collaborators, setCollaborators] = useState<CollaboratorWithUser[]>([]);
  const [collaboratorsLoading, setCollaboratorsLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<CollaboratorRole>('viewer');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);

  const tablistId = useId();
  const tabIdPrefix = `${tablistId}-tab`;
  const panelIdPrefix = `${tablistId}-panel`;
  const shareLinkInputId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const tabs = [
    { id: 'collaborate', label: t('graphEditor.share.tabCollaborate') },
    { id: 'public', label: t('graphEditor.share.tabPublic') },
  ] as const;

  const handleTabKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    switch (e.key) {
      case 'ArrowRight': {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % tabs.length;
        setActiveTab(tabs[nextIndex].id);
        tabRefs.current[nextIndex]?.focus();
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        setActiveTab(tabs[prevIndex].id);
        tabRefs.current[prevIndex]?.focus();
        break;
      }
      case 'Home': {
        e.preventDefault();
        setActiveTab(tabs[0].id);
        tabRefs.current[0]?.focus();
        break;
      }
      case 'End': {
        e.preventDefault();
        const lastIndex = tabs.length - 1;
        setActiveTab(tabs[lastIndex].id);
        tabRefs.current[lastIndex]?.focus();
        break;
      }
      default:
        break;
    }
  };

  const isOwner = !!(ownerId && user?.id && ownerId === user.id);

  useEffect(() => {
    if (isOpen && graphId && activeTab === 'collaborate') {
      fetchCollaborators();
    }
  }, [isOpen, graphId, activeTab]);

  const fetchCollaborators = async () => {
    setCollaboratorsLoading(true);
    try {
      const response = await fetch(`/api/v1/collaborations/graphs/${encodeURIComponent(graphId)}/collaborators`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setCollaborators(data || []);
      }
    } catch (error) {
      console.error('获取协作者失败:', error);
      message.error(t('graphEditor.share.fetchCollaboratorsFailed'));
    } finally {
      setCollaboratorsLoading(false);
    }
  };

  const handleToggle = async () => {
    setLoading(true);
    try {
      const newStatus = !isPublic;
      await api.graphs.togglePublic(graphId, newStatus);
      setIsPublic(newStatus);
      onPublicChange(newStatus);
      message.success(newStatus ? t('graphEditor.share.madePublic') : t('graphEditor.share.madePrivate'));
    } catch (error: unknown) {
      console.error(error);
      message.error(t('graphEditor.share.toggleFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    const publicUrl = `${window.location.origin}/graph/${graphId}`;
    void copyToClipboard(publicUrl, t('toast.common.copied'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    
    setInviteLoading(true);
    try {
      const response = await fetch(`/api/v1/collaborations/graphs/${encodeURIComponent(graphId)}/collaborators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      
      if (response.ok) {
        message.success(t('graphEditor.share.inviteSent'));
        setInviteEmail('');
        fetchCollaborators();
      } else {
        const data = await response.json();
        message.error(data.error || t('graphEditor.share.inviteFailed'));
      }
    } catch (error) {
      console.error('邀请失败:', error);
      message.error(t('graphEditor.share.inviteFailedRetry'));
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveCollaborator = async (collaboratorUserId: string) => {
    if (!await asyncConfirm({
      title: t('common.confirm.removeCollaboratorTitle'),
      message: t('common.confirm.removeCollaboratorMessage'),
      isDangerous: true,
    })) return;
    
    try {
      const response = await fetch(`/api/v1/collaborations/graphs/${encodeURIComponent(graphId)}/collaborators/${encodeURIComponent(collaboratorUserId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (response.ok) {
        message.success(t('graphEditor.share.collaboratorRemoved'));
        fetchCollaborators();
      } else {
        const data = await response.json();
        message.error(data.error || t('graphEditor.share.removeFailed'));
      }
    } catch (error) {
      console.error('移除失败:', error);
      message.error(t('graphEditor.share.removeFailedRetry'));
    }
  };

  const handleGenerateShareLink = async () => {
    try {
      const response = await fetch(`/api/v1/collaborations/graphs/${encodeURIComponent(graphId)}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: 'viewer' }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setShareToken(data.invitationToken);
        message.success(t('graphEditor.share.linkGenerated'));
      } else {
        const data = await response.json();
        message.error(data.error || t('graphEditor.share.linkGenerateFailed'));
      }
    } catch (error) {
      console.error('生成链接失败:', error);
      message.error(t('graphEditor.share.linkGenerateFailedRetry'));
    }
  };

  const contentRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });
  useEscapeKey(onClose, isOpen);

  if (!isOpen) return null;

  const publicUrl = `${window.location.origin}/graph/${graphId}`;
  const roleLabels: Record<CollaboratorRole, string> = {
    owner: t('graphEditor.share.roleOwner'),
    editor: t('graphEditor.share.roleEditor'),
    viewer: t('graphEditor.share.roleViewer'),
  };
  const roleColors: Record<CollaboratorRole, string> = {
    owner: '#EF4444',
    editor: '#3B82F6',
    viewer: '#6B7280',
  };

  return (
    <div
      className="fixed inset-0 z-fullscreen flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
        >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
          <h2 id="share-modal-title" className="text-lg font-bold text-gray-800 dark:text-white">{t('graphEditor.share.title')}</h2>
          <button onClick={onClose} aria-label={t('common.aria.close')} className="min-w-[44px] min-h-[44px] flex items-center justify-center p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <X size={20} className="text-gray-500 dark:text-gray-400" aria-hidden="true" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-700" role="tablist" aria-label={t('graphEditor.share.title')}>
          <button
            ref={(el) => { tabRefs.current[0] = el; }}
            role="tab"
            id={`${tabIdPrefix}-collaborate`}
            aria-selected={activeTab === 'collaborate'}
            aria-controls={`${panelIdPrefix}-collaborate`}
            tabIndex={activeTab === 'collaborate' ? 0 : -1}
            onKeyDown={(e) => handleTabKeyDown(e, 0)}
            onClick={() => setActiveTab('collaborate')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'collaborate'
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Users size={16} className="inline-block mr-1" aria-hidden="true" />
            {t('graphEditor.share.tabCollaborate')}
          </button>
          <button
            ref={(el) => { tabRefs.current[1] = el; }}
            role="tab"
            id={`${tabIdPrefix}-public`}
            aria-selected={activeTab === 'public'}
            aria-controls={`${panelIdPrefix}-public`}
            tabIndex={activeTab === 'public' ? 0 : -1}
            onKeyDown={(e) => handleTabKeyDown(e, 1)}
            onClick={() => setActiveTab('public')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'public'
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Globe size={16} className="inline-block mr-1" aria-hidden="true" />
            {t('graphEditor.share.tabPublic')}
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {activeTab === 'collaborate' ? (
            <div
              role="tabpanel"
              id={`${panelIdPrefix}-collaborate`}
              aria-labelledby={`${tabIdPrefix}-collaborate`}
              tabIndex={0}
              className="space-y-4"
            >
              {collaboratorsLoading ? (
                <div className="text-center py-4 text-gray-500">{t('graphEditor.share.loading')}</div>
              ) : (
                <div className="space-y-2">
                  {collaborators.map((collaborator) => (
                    <div
                      key={collaborator.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-medium">
                          {collaborator.user?.name?.[0] || collaborator.user?.email?.[0] || '?'}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {collaborator.user?.name || collaborator.user?.email}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {collaborator.user?.email}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className="px-2 py-1 text-sm rounded"
                          style={{ backgroundColor: `${roleColors[collaborator.role]  }20`, color: roleColors[collaborator.role] }}
                        >
                          {roleLabels[collaborator.role]}
                        </span>
                        {collaborator.role !== 'owner' && (
                          <button
                            onClick={() => handleRemoveCollaborator(collaborator.user_id)}
                            aria-label={t('common.aria.removeCollaborator')}
                            className="p-1 text-red-500 hover:text-red-700"
                          >
                            <X size={16} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isOwner && (
                <div className="pt-4 border-t dark:border-gray-600 space-y-3">
                  <form onSubmit={handleInvite} className="flex gap-2">
                    <input
                      type="email"
                      autoComplete="email"
                      aria-label={t('graphEditor.share.emailLabel')}
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder={t('graphEditor.share.inviteEmailPlaceholder')}
                      className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 text-sm"
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as CollaboratorRole)}
                      aria-label={t('graphEditor.share.roleLabel')}
                      className="px-2 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 text-sm"
                    >
                      <option value="editor">{t('graphEditor.share.roleEditor')}</option>
                      <option value="viewer">{t('graphEditor.share.roleViewer')}</option>
                    </select>
                    <button
                      type="submit"
                      disabled={inviteLoading || !inviteEmail}
                      aria-label={t('common.aria.invite')}
                      className="px-3 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 text-sm"
                    >
                      <UserPlus size={16} aria-hidden="true" />
                    </button>
                  </form>

                  <button
                    onClick={handleGenerateShareLink}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm"
                  >
                    <LinkIcon size={16} aria-hidden="true" />
                    {t('graphEditor.share.generateShareLink')}
                  </button>

                  {shareToken && (
                    <div className="space-y-2">
                      <label htmlFor={shareLinkInputId} className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('graphEditor.share.shareLinkLabel')}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          id={shareLinkInputId}
                          value={`${window.location.origin}/collaboration/${shareToken}`}
                          readOnly
                          aria-readonly="true"
                          className="flex-1 px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 text-sm"
                        />
                        <button
                          onClick={() => {
                            void copyToClipboard(`${window.location.origin}/collaboration/${shareToken}`, t('toast.common.copied'));
                          }}
                          aria-label={t('graphEditor.share.copyLink')}
                          className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                        >
                          <Copy size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div
              role="tabpanel"
              id={`${panelIdPrefix}-public`}
              aria-labelledby={`${tabIdPrefix}-public`}
              tabIndex={0}
              className="space-y-6"
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-full ${isPublic ? 'bg-green-100 text-green-600 dark:bg-green-900/30' : 'bg-gray-100 text-gray-500 dark:bg-gray-700'}`}>
                  {isPublic ? <Globe size={24} /> : <Lock size={24} />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">
                      {isPublic ? t('graphEditor.share.publicAccess') : t('graphEditor.share.privateGraph')}
                    </h3>
                    <button
                      onClick={handleToggle}
                      disabled={loading}
                      role="switch"
                      aria-checked={isPublic}
                      aria-label={t('graphEditor.share.publicToggleLabel')}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                        isPublic ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-600'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isPublic ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {isPublic
                      ? t('graphEditor.share.publicDesc')
                      : t('graphEditor.share.privateDesc')}
                  </p>
                </div>
              </div>

              {isPublic && (
                <div className="space-y-2 animate-in slide-in-from-top-2">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('graphEditor.share.shareLinkLabel')}
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-gray-300 truncate font-mono">
                      {publicUrl}
                    </div>
                    <button
                      onClick={handleCopy}
                      className="p-2 bg-primary-50 dark:bg-primary-900/30 text-primary-600 hover:bg-primary-100 dark:hover:bg-primary-900/50 rounded-lg transition-colors border border-primary-200 dark:border-primary-800"
                      aria-label={t('graphEditor.share.copyLink')}
                      title={t('graphEditor.share.copyLink')}
                    >
                      {copied ? <Check size={20} aria-hidden="true" /> : <Copy size={20} aria-hidden="true" />}
                    </button>
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors border border-gray-200 dark:border-gray-600"
                      title={t('graphEditor.share.openInNewTab')}
                      aria-label={t('graphEditor.share.openInNewTab')}
                    >
                      <ExternalLink size={20} aria-hidden="true" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

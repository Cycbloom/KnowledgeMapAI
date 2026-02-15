import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Share2, 
  Link, 
  Copy, 
  Check,
  UserPlus,
  UserMinus,
  Shield,
  Eye,
  Edit3,
  Crown,
  Clock,
  Mail
} from 'lucide-react';
import { api } from '../../services/api';
import { useMessageStore } from '../../store/useMessageStore';
import { useErrorHandler } from '../../hooks/useErrorHandler';

interface Collaborator {
  user_id: string;
  permission: 'view' | 'edit' | 'admin';
  joined_at: string;
  profiles: {
    id: string;
    username: string;
    avatar_url?: string;
  };
}

interface CollaborationPanelProps {
  graphId: string;
  isOwner: boolean;
  myPermission?: 'view' | 'edit' | 'admin';
}

export const CollaborationPanel: React.FC<CollaborationPanelProps> = ({
  graphId,
  isOwner,
  myPermission
}) => {
  const [owner, setOwner] = useState<{ id: string; username: string; avatar_url?: string } | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [shareLink, setShareLink] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPermission, setNewUserPermission] = useState<'view' | 'edit'>('view');
  
  const { addMessage } = useMessageStore();
  const { handleError } = useErrorHandler();

  const fetchCollaborators = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api.collaboration.getCollaborators(graphId);
      setOwner(result.owner);
      setCollaborators(result.collaborators || []);
    } catch (error) {
      handleError(error, { context: 'FetchCollaborators' });
    } finally {
      setIsLoading(false);
    }
  }, [graphId, handleError]);

  useEffect(() => {
    fetchCollaborators();
  }, [fetchCollaborators]);

  const handleCreateShareLink = async () => {
    try {
      const result = await api.collaboration.shareGraph({
        graph_id: graphId,
        permission: 'view'
      });
      setShareLink(result.share_link.share_url);
      addMessage({ type: 'success', content: '分享链接已创建' });
    } catch (error) {
      handleError(error, { context: 'CreateShareLink' });
    }
  };

  const handleCopyLink = async () => {
    if (shareLink) {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAddCollaborator = async () => {
    if (!newUserEmail.trim()) return;
    
    try {
      const result = await api.collaboration.addCollaborator({
        graph_id: graphId,
        user_id: newUserEmail,
        permission: newUserPermission
      });
      
      addMessage({ type: 'success', content: '协作者已添加' });
      setShowAddModal(false);
      setNewUserEmail('');
      fetchCollaborators();
    } catch (error) {
      handleError(error, { context: 'AddCollaborator' });
    }
  };

  const handleRemoveCollaborator = async (userId: string) => {
    try {
      await api.collaboration.removeCollaborator({
        graph_id: graphId,
        user_id: userId
      });
      
      addMessage({ type: 'success', content: '协作者已移除' });
      fetchCollaborators();
    } catch (error) {
      handleError(error, { context: 'RemoveCollaborator' });
    }
  };

  const handleUpdatePermission = async (userId: string, permission: 'view' | 'edit' | 'admin') => {
    try {
      await api.collaboration.updatePermission({
        graph_id: graphId,
        user_id: userId,
        permission
      });
      
      addMessage({ type: 'success', content: '权限已更新' });
      fetchCollaborators();
    } catch (error) {
      handleError(error, { context: 'UpdatePermission' });
    }
  };

  const getPermissionIcon = (permission: string) => {
    switch (permission) {
      case 'admin': return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'edit': return <Edit3 className="w-4 h-4 text-blue-500" />;
      case 'view': return <Eye className="w-4 h-4 text-gray-500" />;
      default: return <Eye className="w-4 h-4 text-gray-500" />;
    }
  };

  const getPermissionLabel = (permission: string) => {
    switch (permission) {
      case 'admin': return '管理员';
      case 'edit': return '可编辑';
      case 'view': return '仅查看';
      default: return '仅查看';
    }
  };

  const canManage = isOwner || myPermission === 'admin';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Users className="w-6 h-6 animate-pulse text-gray-400" />
      </div>
    );
  }

  return (
    <div className="collaboration-panel">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-500" />
          协作者
        </h3>
        {canManage && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowShareModal(true);
                if (!shareLink) handleCreateShareLink();
              }}
              className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-1"
            >
              <Share2 size={14} />
              分享
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-1"
            >
              <UserPlus size={14} />
              添加
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {owner && (
          <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center text-white font-bold">
                {owner.username[0].toUpperCase()}
              </div>
              <div>
                <p className="font-medium">{owner.username}</p>
                <p className="text-xs text-gray-500">所有者</p>
              </div>
            </div>
            <Crown className="w-5 h-5 text-yellow-500" />
          </div>
        )}

        {collaborators.map((collab) => (
          <div
            key={collab.user_id}
            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                {collab.profiles.username[0].toUpperCase()}
              </div>
              <div>
                <p className="font-medium">{collab.profiles.username}</p>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock size={12} />
                  {new Date(collab.joined_at).toLocaleDateString()}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canManage ? (
                <select
                  value={collab.permission}
                  onChange={(e) => handleUpdatePermission(collab.user_id, e.target.value as any)}
                  className="text-sm px-2 py-1 rounded border bg-white dark:bg-slate-600"
                >
                  <option value="view">仅查看</option>
                  <option value="edit">可编辑</option>
                  <option value="admin">管理员</option>
                </select>
              ) : (
                <span className="flex items-center gap-1 text-sm text-gray-500">
                  {getPermissionIcon(collab.permission)}
                  {getPermissionLabel(collab.permission)}
                </span>
              )}
              {canManage && (
                <button
                  onClick={() => handleRemoveCollaborator(collab.user_id)}
                  className="p-1 text-red-500 hover:bg-red-100 rounded"
                >
                  <UserMinus size={16} />
                </button>
              )}
            </div>
          </div>
        ))}

        {collaborators.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>暂无协作者</p>
            <p className="text-sm">分享图谱邀请他人协作</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showShareModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowShareModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Link className="w-5 h-5 text-blue-500" />
                分享图谱
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">分享链接</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={shareLink}
                      readOnly
                      className="flex-1 px-3 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-sm"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                      {copied ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <Shield className="w-5 h-5 text-blue-500" />
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    拥有链接的人可以查看此图谱
                  </p>
                </div>

                <button
                  onClick={handleCreateShareLink}
                  className="w-full py-2 text-sm text-blue-500 hover:bg-blue-50 rounded-lg"
                >
                  生成新的分享链接
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-green-500" />
                添加协作者
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">用户 ID</label>
                  <input
                    type="text"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="输入用户 ID"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">权限</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNewUserPermission('view')}
                      className={`flex-1 py-2 rounded-lg text-sm ${
                        newUserPermission === 'view'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 dark:bg-slate-700'
                      }`}
                    >
                      <Eye className="w-4 h-4 inline mr-1" />
                      仅查看
                    </button>
                    <button
                      onClick={() => setNewUserPermission('edit')}
                      className={`flex-1 py-2 rounded-lg text-sm ${
                        newUserPermission === 'edit'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 dark:bg-slate-700'
                      }`}
                    >
                      <Edit3 className="w-4 h-4 inline mr-1" />
                      可编辑
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleAddCollaborator}
                  disabled={!newUserEmail.trim()}
                  className="w-full py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                >
                  添加协作者
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CollaborationPanel;

import React, { useState } from 'react';
import { X, Globe, Lock, Copy, Check, ExternalLink } from 'lucide-react';
import { api } from '../../services/api';
import { useMessageStore } from '../../store/useMessageStore';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  graphId: string;
  isPublic: boolean;
  onPublicChange: (isPublic: boolean) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ 
  isOpen, 
  onClose, 
  graphId, 
  isPublic: initialIsPublic,
  onPublicChange 
}) => {
  const { addMessage } = useMessageStore();
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const publicUrl = `${window.location.origin}/graph/${graphId}`;

  const handleToggle = async () => {
    setLoading(true);
    try {
      const newStatus = !isPublic;
      await api.graphs.togglePublic(graphId, newStatus);
      setIsPublic(newStatus);
      onPublicChange(newStatus);
      addMessage({ 
        type: 'success', 
        content: newStatus ? '图谱已公开，任何人均可访问' : '图谱已设为私有' 
      });
    } catch (error: any) {
      console.error(error);
      addMessage({ type: 'error', content: '设置失败，请重试' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addMessage({ type: 'success', content: '链接已复制到剪贴板' });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">分享图谱</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Toggle Section */}
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full ${isPublic ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
              {isPublic ? <Globe size={24} /> : <Lock size={24} />}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-medium text-gray-900">
                  {isPublic ? '公开访问' : '私有图谱'}
                </h3>
                <button 
                  onClick={handleToggle}
                  disabled={loading}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    isPublic ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isPublic ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              <p className="text-sm text-gray-500">
                {isPublic 
                  ? '任何拥有链接的人都可以查看此图谱，但无法进行编辑。' 
                  : '只有您可以访问此图谱。'}
              </p>
            </div>
          </div>

          {/* Link Section */}
          {isPublic && (
            <div className="space-y-2 animate-in slide-in-from-top-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                分享链接
              </label>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 truncate font-mono">
                  {publicUrl}
                </div>
                <button
                  onClick={handleCopy}
                  className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
                  title="复制链接"
                >
                  {copied ? <Check size={20} /> : <Copy size={20} />}
                </button>
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                  title="在新标签页打开"
                >
                  <ExternalLink size={20} />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

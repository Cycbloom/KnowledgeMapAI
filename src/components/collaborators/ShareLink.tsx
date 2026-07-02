import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { copyToClipboard } from "@/utils/clipboard";

interface ShareLinkProps {
  invitationToken: string;
  graphId: string;
}

export const ShareLink: React.FC<ShareLinkProps> = ({ invitationToken, graphId: _graphId }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/collaboration/${invitationToken}`;

  const handleCopy = async () => {
    const success = await copyToClipboard(shareUrl, t("common.copied"));
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        分享链接
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={shareUrl}
          readOnly
          className="flex-1 px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 text-sm"
        />
        <button
          onClick={handleCopy}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
        >
          {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        通过此链接邀请用户加入协作
      </p>
    </div>
  );
};

import React, { useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { X, Download, Link2 } from "lucide-react";
import { useTheme, useFocusTrap, useEscapeKey } from "../../hooks";
import {
  isElectronProduction,
  getElectronApiUrl,
} from "../../config/electronConfig";
import { message } from "../../utils/messageHelper";
import { copyToClipboard } from "@/utils/clipboard";

interface CalendarExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CalendarExportModal: React.FC<CalendarExportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const titleId = useId();
  const containerRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });
  useEscapeKey(() => onClose(), isOpen);

  const handleExportICS = async () => {
    try {
      let exportUrl: string;
      if (isElectronProduction()) {
        const electronApiUrl = await getElectronApiUrl();
        exportUrl = `${electronApiUrl}/calendar/export/ics`;
      } else {
        exportUrl = "/api/calendar/export/ics";
      }

      const response = await fetch(exportUrl, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `calendar-${new Date().toISOString().split("T")[0]}.ics`;
      a.click();
      window.URL.revokeObjectURL(url);
      message.success(t("toast.calendar.calendarExported"));
    } catch {
      message.error(t("toast.calendar.exportFailed"));
    }
  };

  const handleCopyWebCalLink = () => {
    const webcalUrl = `webcal://${window.location.host}/api/calendar/subscribe/${localStorage.getItem("userId")}`;
    void copyToClipboard(webcalUrl, t("toast.calendar.webcalCopied"));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-xl p-6 ${
              isDark ? "bg-slate-800" : "bg-white"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3
                id={titleId}
                className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}
              >
                {t("calendar.exportCalendar")}
              </h3>
              <button
                onClick={onClose}
                aria-label={t('common.aria.close')}
                className={`p-1 rounded-lg ${isDark ? "hover:bg-slate-700" : "hover:bg-gray-100"}`}
              >
                <X
                  size={20}
                  className={isDark ? "text-slate-400" : "text-gray-500"}
                />
              </button>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleExportICS}
                className={`w-full flex items-center gap-3 p-4 rounded-lg border transition-colors ${
                  isDark
                    ? "border-slate-700 hover:bg-slate-700"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <Download size={20} className="text-primary-500" />
                <div className="text-left">
                  <p
                    className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}
                  >
                    {t("calendar.downloadICS")}
                  </p>
                  <p
                    className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}
                  >
                    {t("calendar.downloadICSDesc")}
                  </p>
                </div>
              </button>

              <button
                onClick={handleCopyWebCalLink}
                className={`w-full flex items-center gap-3 p-4 rounded-lg border transition-colors ${
                  isDark
                    ? "border-slate-700 hover:bg-slate-700"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <Link2 size={20} className="text-green-500" />
                <div className="text-left">
                  <p
                    className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}
                  >
                    {t("calendar.copyWebCalLink")}
                  </p>
                  <p
                    className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}
                  >
                    {t("calendar.copyWebCalLinkDesc")}
                  </p>
                </div>
              </button>

              <div
                className={`p-4 rounded-lg ${isDark ? "bg-slate-700/50" : "bg-gray-50"}`}
              >
                <p
                  className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}
                >
                  {t("calendar.huaweiTip")}
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

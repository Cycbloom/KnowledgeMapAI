import React, { useState, useEffect } from 'react';
import { X, FileText, Image, List, Check, Download, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { frontendEventBus } from "../../../services/timer/FrontendEventBus";
import { LazyImage } from "../../common";

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  graphId: string;
  graphTitle: string;
  getScreenshot?: () => Promise<string | null> | string | null; // Function to get screenshot from canvas
}

export const ExportDialog: React.FC<ExportDialogProps> = ({ isOpen, onClose, graphId, graphTitle, getScreenshot }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [includeStats, _setIncludeStats] = useState(true);
  const [includeDetails, setIncludeDetails] = useState(true);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);

  // When dialog opens, try to capture screenshot if not already present
  useEffect(() => {
    const capture = async () => {
      if (isOpen && getScreenshot && includeScreenshot) {
        try {
          // Small delay to let UI settle if needed, though canvas is separate
          const result = getScreenshot();
          const dataUrl = result instanceof Promise ? await result : result;
          if (dataUrl) {
            setScreenshotPreview(dataUrl);
          }
        } catch (error) {
          console.error('Failed to capture screenshot:', error);
        }
      }
    };
    
    capture();
  }, [isOpen, getScreenshot, includeScreenshot]);

  if (!isOpen) return null;

  const handleExport = async () => {
    setLoading(true);
    try {
      // We need to use fetch directly to handle blob response correctly with POST
      const token = localStorage.getItem('auth-storage') 
        ? JSON.parse(localStorage.getItem('auth-storage')!).state?.token 
        : null;

      const response = await fetch(`/api/data/export/pdf?graph_id=${graphId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          options: {
            includeScreenshot,
            includeStats,
            includeDetails,
            screenshotBase64: includeScreenshot ? screenshotPreview : undefined
          }
        })
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${graphTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_report.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      frontendEventBus.publish("message_show", { type: 'success', content: t('graphEditor.export.success') });
      onClose();
    } catch (error) {
      console.error('Export error:', error);
      frontendEventBus.publish("message_show", { type: 'error', content: t('graphEditor.export.failed') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <FileText className="text-primary-600" size={20} />
            {t('graphEditor.export.title')}
          </h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Preview Section */}
          <div className="aspect-[210/297] bg-gray-100 rounded-lg border border-gray-200 shadow-inner relative overflow-hidden group">
             <div className="absolute inset-x-8 top-8 bottom-8 bg-white shadow-sm flex flex-col p-6 pointer-events-none">
                {/* Mock PDF Look */}
                <div className="h-4 w-3/4 bg-gray-800 mb-4 mx-auto rounded"></div>
                <div className="h-2 w-1/2 bg-gray-400 mb-8 mx-auto rounded"></div>
                
                {includeScreenshot ? (
                  screenshotPreview ? (
                    <LazyImage src={screenshotPreview} alt="Graph Preview" className="w-full h-32 object-cover rounded mb-6 border border-gray-100" />
                  ) : (
                    <div className="w-full h-32 bg-gray-100 rounded mb-6 flex items-center justify-center text-gray-400 text-xs">
                      {t('graphEditor.export.noPreview')}
                    </div>
                  )
                ) : (
                   <div className="w-full h-32 border-2 border-dashed border-gray-200 rounded mb-6 flex items-center justify-center text-gray-300">
                     {t('graphEditor.export.screenshotHidden')}
                   </div>
                )}
                
                {includeStats && (
                  <div className="space-y-2 mb-4">
                    <div className="h-2 w-1/3 bg-gray-800 rounded"></div>
                    <div className="h-1 w-full bg-gray-200 rounded"></div>
                    <div className="h-1 w-full bg-gray-200 rounded"></div>
                  </div>
                )}

                {includeDetails && (
                  <div className="space-y-2 mt-auto opacity-50">
                     <div className="h-1 w-full bg-gray-200 rounded"></div>
                     <div className="h-1 w-5/6 bg-gray-200 rounded"></div>
                  </div>
                )}
             </div>
             <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
               <span className="bg-black/70 text-white text-xs px-2 py-1 rounded">{t('graphEditor.export.preview')}</span>
             </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
             <h3 className="text-sm font-semibold text-gray-700">{t('graphEditor.export.options')}</h3>
             
             <label className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-primary-300 cursor-pointer transition-colors">
               <div className="flex items-center gap-3">
                 <div className={`p-2 rounded-md ${includeScreenshot ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400'}`}>
                   <Image size={18} />
                 </div>
                 <div className="text-sm">
                   <div className="font-medium text-gray-800">{t('graphEditor.export.includeScreenshot')}</div>
                   <div className="text-gray-500 text-xs">{t('graphEditor.export.screenshotDesc')}</div>
                 </div>
               </div>
               <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${includeScreenshot ? 'bg-primary-600 border-primary-600' : 'border-gray-300'}`}>
                 {includeScreenshot && <Check size={12} className="text-white" />}
               </div>
               <input type="checkbox" className="hidden" checked={includeScreenshot} onChange={() => setIncludeScreenshot(!includeScreenshot)} />
             </label>

             <label className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-primary-300 cursor-pointer transition-colors">
               <div className="flex items-center gap-3">
                 <div className={`p-2 rounded-md ${includeDetails ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400'}`}>
                   <List size={18} />
                 </div>
                 <div className="text-sm">
                   <div className="font-medium text-gray-800">{t('graphEditor.export.includeDetails')}</div>
                   <div className="text-gray-500 text-xs">{t('graphEditor.export.detailsDesc')}</div>
                 </div>
               </div>
               <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${includeDetails ? 'bg-primary-600 border-primary-600' : 'border-gray-300'}`}>
                 {includeDetails && <Check size={12} className="text-white" />}
               </div>
               <input type="checkbox" className="hidden" checked={includeDetails} onChange={() => setIncludeDetails(!includeDetails)} />
             </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-200/50 rounded-lg transition-colors"
          >
            {t('graphEditor.export.cancel')}
          </button>
          <button 
            onClick={handleExport}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium shadow-sm transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {loading ? t('graphEditor.export.generating') : t('graphEditor.export.download')}
          </button>
        </div>
      </div>
    </div>
  );
};


import React from 'react';
import { useMessageStore } from '../../store/useMessageStore';
import { useTheme } from '../../hooks/useTheme';
import { CheckCircle, AlertTriangle, Info, AlertCircle, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export const MessageBar: React.FC = () => {
  const { messages } = useMessageStore();
  const { isDark } = useTheme();
  // Get the most recent message
  const currentMessage = messages.length > 0 ? messages[messages.length - 1] : null;

  const getBackgroundColor = (type?: 'info' | 'success' | 'warning' | 'error' | 'loading') => {
    switch (type) {
      case 'error': return 'bg-red-600';
      case 'warning': return 'bg-amber-600';
      case 'success': return 'bg-emerald-600';
      case 'loading': return 'bg-blue-600';
      default: return isDark ? 'bg-slate-900' : 'bg-blue-600'; // Match theme: Slate-900 for Dark, Blue-600 for Light
    }
  };

  const getIcon = (type?: 'info' | 'success' | 'warning' | 'error' | 'loading') => {
    switch (type) {
      case 'error': return <AlertCircle className="w-3.5 h-3.5" />;
      case 'warning': return <AlertTriangle className="w-3.5 h-3.5" />;
      case 'success': return <CheckCircle className="w-3.5 h-3.5" />;
      case 'loading': return <Loader2 className="w-3.5 h-3.5 animate-spin" />;
      default: return <Info className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-50 pointer-events-none">
      <AnimatePresence>
        {currentMessage && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={`w-full h-8 ${getBackgroundColor(currentMessage.type)} text-white flex items-center px-4 text-xs select-none shadow-lg pointer-events-auto`}
          >
            <div className="flex items-center gap-2 flex-1 overflow-hidden">
              <motion.div
                key={currentMessage.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 truncate"
              >
                {getIcon(currentMessage.type)}
                <span className="font-medium tracking-wide">{currentMessage.content}</span>
                {currentMessage.action && (
                  <button
                    onClick={currentMessage.action.onClick}
                    className="ml-3 underline hover:text-white/80 transition-colors font-semibold"
                  >
                    {currentMessage.action.label}
                  </button>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

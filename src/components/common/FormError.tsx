import React from 'react';
import { AlertCircle } from 'lucide-react';

interface FormErrorProps {
  message?: string;
  className?: string;
}

const FormError: React.FC<FormErrorProps> = ({ message, className = '' }) => {
  if (!message) return null;

  return (
    <div
      className={`
        flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400
        animate-[fadeIn_0.2s_ease-out]
        ${className}
      `.replace(/\s+/g, ' ').trim()}
      role="alert"
    >
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
};

export { FormError };
export type { FormErrorProps };

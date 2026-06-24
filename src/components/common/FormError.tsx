import React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormErrorProps {
  message?: string;
  className?: string;
}

const FormError: React.FC<FormErrorProps> = ({ message, className = '' }) => {
  if (!message) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400',
        'animate-[fadeIn_0.2s_ease-out]',
        className
      )}
      role="alert"
    >
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
};

export { FormError };
export type { FormErrorProps };

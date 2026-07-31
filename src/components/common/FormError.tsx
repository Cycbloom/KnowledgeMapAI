import React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/utils/utils';

interface FormErrorProps {
  message?: string;
  className?: string;
  id?: string;
}

const FormError: React.FC<FormErrorProps> = ({ message, className = '', id }) => {
  if (!message) return null;

  return (
    <div
      id={id}
      className={cn(
        'flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400',
        'animate-[fadeIn_0.2s_ease-out]',
        className
      )}
      role="alert"
    >
      <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
};

export { FormError };
export type { FormErrorProps };

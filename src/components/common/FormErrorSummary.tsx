import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/utils/utils';

interface FormErrorSummaryItem {
  field: string;
  message: string;
}

interface FormErrorSummaryProps {
  errors: FormErrorSummaryItem[];
  onFocusField?: (field: string) => void;
  className?: string;
}

const FormErrorSummary: React.FC<FormErrorSummaryProps> = ({
  errors,
  onFocusField,
  className = '',
}) => {
  const { t } = useTranslation();

  if (errors.length === 0) return null;

  const handleFocusField = (field: string) => {
    onFocusField?.(field);
  };

  return (
    <div
      className={cn(
        'rounded-md border border-red-300 bg-red-50 p-3 dark:border-red-500/30 dark:bg-red-500/10',
        'animate-[fadeIn_0.2s_ease-out]',
        className
      )}
      role="alert"
    >
      <p className="flex items-center gap-1.5 text-sm font-medium text-red-700 dark:text-red-400">
        <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        <span>
          {t('form.validation.errorSummaryCount', {
            count: errors.length,
          })}
        </span>
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {errors.map((err) => (
          <li key={err.field}>
            <button
              type="button"
              onClick={() => handleFocusField(err.field)}
              className="text-left text-sm text-red-600 underline-offset-2 hover:underline dark:text-red-400"
            >
              {err.message}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export { FormErrorSummary };
export type { FormErrorSummaryItem, FormErrorSummaryProps };
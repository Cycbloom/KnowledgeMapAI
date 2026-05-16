import React from 'react';
import { FormError } from './FormError';

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  required = false,
  hint,
  children,
  className = '',
}) => {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`.replace(/\s+/g, ' ').trim()}>
      <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && (
        <span className="text-xs text-gray-500 dark:text-gray-400">{hint}</span>
      )}
      <FormError message={error} />
    </div>
  );
};

export { FormField };
export type { FormFieldProps };

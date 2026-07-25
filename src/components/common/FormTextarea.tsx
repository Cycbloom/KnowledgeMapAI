import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  errorId?: string;
}

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ label, error, hint, className, id, errorId, ...props }, ref) => {
    const baseClass =
      'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100';
    const errorClass = error ? 'border-red-500 dark:border-red-500' : '';
    const userClass = className ?? '';

    const generatedErrorId = useId();
    const describedByErrorId = errorId ?? generatedErrorId;

    return (
      <div>
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={id}
          className={cn(baseClass, errorClass, userClass)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? describedByErrorId : undefined}
          {...props}
        />
        {error && (
          <p
            id={describedByErrorId}
            className="mt-1 text-sm text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{hint}</p>
        )}
      </div>
    );
  }
);

FormTextarea.displayName = 'FormTextarea';

export type { FormTextareaProps };

import React, { useId } from 'react';
import { FormError } from './FormError';
import { cn } from '@/lib/utils';

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
  const generatedId = useId();
  const errorId = useId();
  const hintId = useId();
  const childrenArray = React.Children.toArray(children);
  const singleChild = childrenArray.length === 1 ? childrenArray[0] : null;

  let fieldId = generatedId;
  let renderedChildren: React.ReactNode = children;

  if (React.isValidElement(singleChild)) {
    const typedChild =
      singleChild as React.ReactElement<React.HTMLAttributes<HTMLElement>>;
    const existingId = typedChild.props.id;
    const existingAriaRequired = typedChild.props['aria-required'];
    const existingAriaDescribedby = typedChild.props['aria-describedby'];
    fieldId = existingId ?? generatedId;

    // Determine the aria-describedby value:
    // - If error exists, point to errorId
    // - Else if hint exists, point to hintId
    // - Else preserve any existing aria-describedby
    let ariaDescribedby: string | undefined;
    if (error) {
      ariaDescribedby = existingAriaDescribedby
        ? `${existingAriaDescribedby} ${errorId}`
        : errorId;
    } else if (hint) {
      ariaDescribedby = existingAriaDescribedby
        ? `${existingAriaDescribedby} ${hintId}`
        : hintId;
    } else {
      ariaDescribedby = existingAriaDescribedby;
    }

    renderedChildren = React.cloneElement(typedChild, {
      id: fieldId,
      'aria-invalid': error ? true : undefined,
      'aria-describedby': ariaDescribedby,
      'aria-errormessage': error ? errorId : undefined,
      ...(required && existingAriaRequired === undefined
        ? { 'aria-required': true as const }
        : {}),
    });
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={fieldId}
        className="text-sm font-medium text-gray-700 dark:text-gray-200"
      >
        {label}
        {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
      </label>
      {renderedChildren}
      {hint && !error && (
        <span id={hintId} className="text-xs text-gray-500 dark:text-gray-400">{hint}</span>
      )}
      <FormError id={errorId} message={error} />
    </div>
  );
};

export { FormField };
export type { FormFieldProps };

import React, { useEffect } from 'react';
import { useFocusTrap } from '../../hooks/common';
import { cn } from '@/lib/utils';

interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  titleId?: string;
  children: React.ReactNode;
  className?: string;
  overlayClassName?: string;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

export const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  onClose,
  titleId,
  children,
  className,
  overlayClassName,
  closeOnOverlayClick = true,
  closeOnEscape = true,
}) => {
  const containerRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });

  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className={cn(
        'fixed inset-0 bg-black/50 flex items-center justify-center z-50',
        overlayClassName
      )}
      onClick={handleOverlayClick}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={className}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

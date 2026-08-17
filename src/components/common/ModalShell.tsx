import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useFocusTrap } from '../../hooks/common';
import { useReducedMotionOrPreference } from '@/hooks/common/useReducedMotionOrPreference';
import { cn } from '@/utils/utils';

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
  const { reduceMotion, transitionOverride } = useReducedMotionOrPreference();

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
    <motion.div
      className={cn(
        'fixed inset-0 bg-black/50 flex items-center justify-center z-50',
        overlayClassName
      )}
      onClick={handleOverlayClick}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={transitionOverride ?? { duration: 0.2 }}
    >
      <motion.div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={className}
        initial={{ opacity: 0, ...(reduceMotion ? {} : { scale: 0.95, y: 10 }) }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={transitionOverride ?? { duration: 0.2, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
};

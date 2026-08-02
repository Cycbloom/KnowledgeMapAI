import { motion } from 'framer-motion';
import { useReducedMotionOrPreference } from '@/hooks/common/useReducedMotionOrPreference';

export interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

export function FadeIn({ children, delay = 0, duration = 0.3, className }: FadeInProps) {
  const { transitionOverride } = useReducedMotionOrPreference();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={transitionOverride ?? { delay, duration }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
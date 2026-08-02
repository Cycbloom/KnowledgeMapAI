import { motion } from 'framer-motion';
import { useReducedMotionOrPreference } from '@/hooks/common/useReducedMotionOrPreference';

export type SlideDirection = 'left' | 'right' | 'up' | 'down';

export interface SlideInProps {
  children: React.ReactNode;
  direction?: SlideDirection;
  delay?: number;
  duration?: number;
  className?: string;
}

const directionMap: Record<SlideDirection, { x?: number; y?: number }> = {
  left: { x: 30 },
  right: { x: -30 },
  up: { y: 30 },
  down: { y: -30 },
};

export function SlideIn({
  children,
  direction = 'up',
  delay = 0,
  duration = 0.3,
  className,
}: SlideInProps) {
  const { reduceMotion, transitionOverride } = useReducedMotionOrPreference();
  const offset = directionMap[direction];

  return (
    <motion.div
      initial={{
        opacity: 0,
        ...(reduceMotion ? { x: 0, y: 0 } : { x: offset.x ?? 0, y: offset.y ?? 0 }),
      }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={transitionOverride ?? { delay, duration }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
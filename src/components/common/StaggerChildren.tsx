import React from 'react';
import { motion, type Variants } from 'framer-motion';
import { useReducedMotionOrPreference } from '@/hooks/common/useReducedMotionOrPreference';

export interface StaggerChildrenProps {
  children: React.ReactNode;
  staggerDelay?: number;
  childDuration?: number;
  className?: string;
}

export function StaggerChildren({
  children,
  staggerDelay = 0.05,
  childDuration = 0.2,
  className,
}: StaggerChildrenProps) {
  const { reduceMotion, transitionOverride } = useReducedMotionOrPreference();

  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: reduceMotion ? 0 : staggerDelay,
      },
    },
  };

  const childVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: transitionOverride ?? { duration: childDuration },
    },
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className={className}
    >
      {React.Children.map(children, (child) => (
        <motion.div variants={childVariants}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
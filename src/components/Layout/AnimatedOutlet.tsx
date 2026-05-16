import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "../../hooks/common/useIsMobile";

const pageVariants = {
  initial: {
    opacity: 0,
    x: 20,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      type: "tween",
      duration: 0.2,
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: {
      duration: 0.15,
      ease: "easeIn",
    },
  },
};

const desktopVariants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: {
      duration: 0.15,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.1,
    },
  },
};

export const AnimatedOutlet: React.FC = () => {
  const location = useLocation();
  const { isMobile } = useIsMobile();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={isMobile ? pageVariants : desktopVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="h-full gpu-accelerated"
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
};

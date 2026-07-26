import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useIsMobile } from "../../hooks/common/useIsMobile";
import { useReducedMotionOrPreference } from "../../hooks/common/useReducedMotionOrPreference";

const mobileVariants = {
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
};

export const AnimatedOutlet: React.FC = () => {
  const location = useLocation();
  const { isMobile } = useIsMobile();
  const { reduceMotion, transitionOverride } = useReducedMotionOrPreference();

  return (
    <motion.div
      key={location.pathname}
      variants={isMobile ? mobileVariants : desktopVariants}
      initial={reduceMotion ? false : "initial"}
      animate="animate"
      transition={transitionOverride}
      className="h-full gpu-accelerated"
    >
      <Outlet />
    </motion.div>
  );
};

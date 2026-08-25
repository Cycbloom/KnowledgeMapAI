import React, { useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, BookOpen, LucideIcon } from "lucide-react";
import { iconMap } from "../../utils/iconMap";
import type { NavLabelKey } from "../../config/routeConfig";

interface NavItem {
  path: string;
  label: NavLabelKey;
  icon?: string;
}

interface MobileSidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  navItems: Array<NavItem>;
  isDark: boolean;
  currentPath: string;
  onPrefetch?: (path: string) => () => void;
}

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const drawerVariants = {
  hidden: { x: "-100%" },
  visible: {
    x: 0,
    transition: { type: "spring", stiffness: 300, damping: 30 },
  },
  exit: {
    x: "-100%",
    transition: { type: "spring", stiffness: 300, damping: 30 },
  },
};

export const MobileSidebarDrawer: React.FC<MobileSidebarDrawerProps> = ({
  isOpen,
  onClose,
  navItems,
  isDark,
  currentPath,
  onPrefetch,
}) => {
  const { t } = useTranslation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleNavClick = useCallback(() => {
    onClose();
  }, [onClose]);

  const isActive = (path: string) => {
    if (path === "/") {
      return currentPath === "/";
    }
    return currentPath.startsWith(path);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="mobile-sidebar-overlay"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            key="mobile-sidebar-drawer"
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={`fixed top-0 left-0 z-50 h-full w-64 shadow-xl ${
              isDark ? "bg-slate-900 text-white" : "bg-white text-gray-900"
            }`}
            role="dialog"
            aria-modal="true"
            aria-label={t("layout.mainNavigation")}
          >
            <div className="flex items-center justify-between h-16 px-4 border-b border-slate-700">
              <span className="text-lg font-bold truncate">{t("layout.appName")}</span>
              <button
                onClick={onClose}
                className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-slate-800 rounded transition-colors"
                aria-label={t("common.close")}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar" aria-label={t("layout.mainNavigation")}>
              {navItems.map((item) => {
                const Icon: LucideIcon = (item.icon ? iconMap[item.icon] : undefined) ?? BookOpen;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={handleNavClick}
                    onMouseEnter={onPrefetch?.(item.path)}
                    className={`flex items-center space-x-2 p-2.5 min-w-[44px] min-h-[44px] rounded transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-inset ${
                      active
                        ? "bg-slate-700"
                        : "hover:bg-slate-800"
                    }`}
                    aria-label={t(item.label)}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon size={20} aria-hidden="true" />
                    <span>{t(item.label)}</span>
                  </Link>
                );
              })}
            </nav>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
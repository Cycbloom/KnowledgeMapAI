import React, { useState, useRef, useEffect, useMemo, useId, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  MoreHorizontal,
  LucideIcon,
} from "lucide-react";
import { navItems, type NavLabelKey } from "@/config/routeConfig";
import { iconMap } from "../../utils/iconMap";
import { useMenuNavigation } from "../../hooks/common/useMenuNavigation";

interface NavItem {
  to: string;
  icon: LucideIcon;
  labelKey: NavLabelKey;
}

interface MobileBottomNavProps {
  isDark: boolean;
  currentPath: string;
  onPrefetch?: (path: string) => () => void;
}

const navItemVariants = {
  initial: { scale: 0.95, opacity: 0.8 },
  animate: { scale: 1, opacity: 1 },
  tap: { scale: 0.92 },
};

const moreMenuVariants = {
  hidden: {
    opacity: 0,
    y: 10,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "tween",
      duration: 0.2,
      staggerChildren: 0.03,
    },
  },
  exit: {
    opacity: 0,
    y: 10,
    scale: 0.95,
    transition: {
      duration: 0.15,
    },
  },
};

const moreMenuItemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: "tween", duration: 0.15 },
  },
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

function useKernelNavItems() {
  return useMemo(() => {
    const allItems = navItems;
    const mainItems: NavItem[] = [];
    const moreItems: NavItem[] = [];

    for (const item of allItems) {
      const navEntry: NavItem = {
        to: item.path,
        icon: (item.icon ? iconMap[item.icon] : undefined) ?? BookOpen,
        labelKey: item.label,
      };
      if (item.category === "main") {
        mainItems.push(navEntry);
      } else {
        moreItems.push(navEntry);
      }
    }

    return { mainNavItems: mainItems, moreNavItems: moreItems };
  }, []);
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  isDark,
  currentPath,
  onPrefetch,
}) => {
  const { t } = useTranslation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const menuItemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const menuId = useId();
  const location = useLocation();
  const { mainNavItems, moreNavItems } = useKernelNavItems();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(event.target as Node)
      ) {
        setIsMoreOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setIsMoreOpen(false);
  }, [location.pathname]);

  const isActive = (path: string) => {
    if (path === "/") {
      return currentPath === "/";
    }
    return currentPath.startsWith(path);
  };

  const isMoreActive = moreNavItems.some((item) => isActive(item.to));

  // 计算初始激活索引：优先聚焦当前路由对应的菜单项
  const initialMoreIndex = useMemo(() => {
    const idx = moreNavItems.findIndex((item) => {
      if (item.to === "/") {
        return currentPath === "/";
      }
      return currentPath.startsWith(item.to);
    });
    return idx >= 0 ? idx : 0;
  }, [moreNavItems, currentPath]);

  const handleMenuSelect = useCallback((index: number) => {
    menuItemRefs.current[index]?.click();
  }, []);

  const handleClose = useCallback(() => {
    setIsMoreOpen(false);
    moreButtonRef.current?.focus();
  }, []);

  const { activeIndex: activeMenuIndex } = useMenuNavigation({
    itemCount: moreNavItems.length,
    enabled: isMoreOpen,
    onSelect: handleMenuSelect,
    onClose: handleClose,
    initialIndex: initialMoreIndex,
  });

  // 菜单打开时聚焦菜单容器，使 aria-activedescendant 能被屏幕阅读器播报
  useEffect(() => {
    if (isMoreOpen) {
      menuRef.current?.focus();
    }
  }, [isMoreOpen]);

  const menuItemId = (index: number) => `${menuId}-item-${index}`;
  const activeMenuItemId =
    isMoreOpen && moreNavItems.length > 0 ? menuItemId(activeMenuIndex) : undefined;

  const getNavItemClass = (path: string) => {
    const active = isActive(path);
    return `flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg min-w-[56px] min-h-[44px] ${
      active
        ? isDark
          ? "text-primary-400 bg-primary-950/50"
          : "text-primary-600 bg-primary-50"
        : isDark
          ? "text-slate-400 hover:text-slate-200"
          : "text-gray-500 hover:text-gray-700"
    }`;
  };

  const getMoreButtonClass = () => {
    return `flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg min-w-[56px] min-h-[44px] ${
      isMoreActive
        ? isDark
          ? "text-primary-400 bg-primary-950/50"
          : "text-primary-600 bg-primary-50"
        : isDark
          ? "text-slate-400 hover:text-slate-200"
          : "text-gray-500 hover:text-gray-700"
    } ${isMoreOpen ? (isDark ? "bg-slate-800" : "bg-gray-100") : ""}`;
  };

  return (
    <motion.nav
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ type: "tween", duration: 0.3 }}
      className={`fixed bottom-0 left-0 right-0 z-50 md:hidden ${
        isDark
          ? "bg-slate-950/95 border-slate-800"
          : "bg-white/95 border-gray-200"
      } border-t backdrop-blur-md`}
      aria-label={t('layout.mainNavigation')}
    >
      <div className="flex items-center justify-around h-14 pb-[var(--safe-area-inset-bottom)]">
        {mainNavItems.map((item, index) => (
          <motion.div
            key={item.to}
            variants={navItemVariants}
            initial="initial"
            animate="animate"
            transition={{ delay: index * 0.05 }}
          >
            <Link 
              to={item.to} 
              className={getNavItemClass(item.to)}
              aria-label={t(item.labelKey)}
              aria-current={isActive(item.to) ? "page" : undefined}
              onMouseEnter={onPrefetch?.(item.to)}
            >
              <motion.div
                whileTap="tap"
                variants={{ tap: { scale: 0.92 } }}
                className="flex flex-col items-center"
              >
                <item.icon size={20} strokeWidth={isActive(item.to) ? 2.5 : 2} aria-hidden="true" />
                <span className="text-[10px] font-medium">{t(item.labelKey)}</span>
              </motion.div>
            </Link>
          </motion.div>
        ))}

        <div ref={moreMenuRef} className="relative">
          <motion.button
            ref={moreButtonRef}
            onClick={() => setIsMoreOpen(!isMoreOpen)}
            className={getMoreButtonClass()}
            whileTap={{ scale: 0.92 }}
            aria-label={t('common.more')}
            aria-expanded={isMoreOpen}
            aria-haspopup="menu"
            aria-controls={menuId}
          >
            <motion.div
              animate={{ rotate: isMoreOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <MoreHorizontal
                size={20}
                strokeWidth={isMoreActive || isMoreOpen ? 2.5 : 2}
                aria-hidden="true"
              />
            </motion.div>
            <span className="text-[10px] font-medium">{t('common.more')}</span>
          </motion.button>

          <AnimatePresence>
            {isMoreOpen && (
              <>
                <motion.div
                  variants={backdropVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="fixed inset-0 z-40"
                  onClick={() => setIsMoreOpen(false)}
                />

                <motion.div
                  ref={menuRef}
                  variants={moreMenuVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className={`absolute bottom-full right-0 mb-2 w-44 rounded-xl shadow-xl overflow-hidden z-50 ${
                    isDark
                      ? "bg-slate-900 border border-slate-700"
                      : "bg-white border border-gray-200"
                  }`}
                  role="menu"
                  id={menuId}
                  aria-label={t('layout.moreMenu')}
                  aria-activedescendant={activeMenuItemId}
                  tabIndex={-1}
                >
                  <div className="py-1.5">
                    {moreNavItems.map((item, index) => {
                      const isActiveItem = isActive(item.to);
                      const isFocused = index === activeMenuIndex;
                      return (
                        <motion.div
                          key={item.to}
                          variants={moreMenuItemVariants}
                        >
                          <Link
                            ref={(el) => {
                              menuItemRefs.current[index] = el;
                            }}
                            to={item.to}
                            className={`flex items-center gap-3 px-4 py-2.5 min-h-[44px] ${
                              isActiveItem
                                ? isDark
                                  ? "bg-primary-950/50 text-primary-400"
                                  : "bg-primary-50 text-primary-600"
                                : isFocused
                                  ? isDark
                                    ? "bg-slate-800 text-slate-100"
                                    : "bg-gray-100 text-gray-900"
                                  : isDark
                                    ? "text-slate-300 hover:bg-slate-800"
                                    : "text-gray-700 hover:bg-gray-50"
                            }`}
                            role="menuitem"
                            id={menuItemId(index)}
                            aria-label={t(item.labelKey)}
                            aria-current={isActiveItem ? "page" : undefined}
                            onMouseEnter={onPrefetch?.(item.to)}
                          >
                            <item.icon size={16} strokeWidth={isActiveItem ? 2.5 : 2} aria-hidden="true" />
                            <span className="text-sm">{t(item.labelKey)}</span>
                          </Link>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.nav>
  );
};

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/utils/utils";
import { useReducedMotionOrPreference } from "@/hooks/common/useReducedMotionOrPreference";

export interface CollapsibleSectionProps {
  /** 区块唯一标识，作为 localStorage 持久化键的一部分 */
  id: string;
  /** 区块标题 */
  title: React.ReactNode;
  /** 区块内容 */
  children?: React.ReactNode;
  /** 默认是否展开（无持久化记录时生效），缺省 true */
  defaultOpen?: boolean;
  /** 外层容器附加类 */
  className?: string;
  /** 持久化键前缀，实际 key 为 `${prefix}:${id}`，缺省 "collapsible-section" */
  storagePrefix?: string;
}

function readPersistedOpen(
  id: string,
  prefix: string,
  fallback: boolean,
): boolean {
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(`${prefix}:${id}`);
    if (raw === null) {
      return fallback;
    }
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "boolean" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  id,
  title,
  children,
  defaultOpen = true,
  className,
  storagePrefix = "collapsible-section",
}) => {
  const [open, setOpen] = useState<boolean>(() =>
    readPersistedOpen(id, storagePrefix, defaultOpen),
  );

  useEffect(() => {
    const key = `${storagePrefix}:${id}`;
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(open));
      }
    } catch {
      // 忽略持久化写入失败，不阻塞界面
    }
  }, [open, id, storagePrefix]);

  const { reduceMotion, transitionOverride } = useReducedMotionOrPreference();

  const contentId = `${id}-content`;

  return (
    <div className={cn(className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={contentId}
        className="w-full flex items-center justify-between gap-2 min-h-[44px] py-2 text-left rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <span className="flex-1 min-w-0">{title}</span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={cn(
            "shrink-0 transition-transform duration-200",
            open ? "rotate-180" : "rotate-0",
          )}
        />
      </button>
      <motion.div
        id={contentId}
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={
          transitionOverride ?? {
            height: { duration: 0.25, ease: "easeInOut" },
            opacity: { duration: 0.2, ease: "easeOut" },
          }
        }
        className="overflow-hidden"
        aria-hidden={!open}
        style={
          reduceMotion
            ? { height: open ? "auto" : 0, opacity: open ? 1 : 0 }
            : undefined
        }
      >
        {children}
      </motion.div>
    </div>
  );
};
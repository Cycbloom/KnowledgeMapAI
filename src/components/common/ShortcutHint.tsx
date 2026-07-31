import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShortcutLabel } from "../../hooks/common/useShortcutLabel";
import { usePreferencesStore } from "../../store/usePreferencesStore";

/**
 * ShortcutHint：为子元素附加快捷键提示 tooltip。
 *
 * 使用方式：
 * - `children` **必须是单一 ReactElement**（通过 React.cloneElement 注入 aria-keyshortcuts）。
 *   传 Fragment、数组或文本会触发类型错误。
 * - `actionId` 必须能通过 useShortcutLabel 解析到绑定，即：
 *     1. 在 `DEFAULT_SHORTCUTS`（src/config/shortcuts.ts）中存在，或
 *     2. 用户在 useShortcutStore.bindings 中已自定义该 actionId 的 keys
 *   解析不到时 DEV 模式下会 console.warn，且不渲染 tooltip。
 * - 悬停 500ms 后在 `placement` 方向弹出 tooltip（默认 bottom）。
 *   tooltip 受 `usePreferencesStore.shortcutHintEnabled` 总开关控制。
 *
 * 集成约束：
 * - 组件**自动注入 aria-keyshortcuts** 到子元素根节点（SR 可发现性），
 *   调用方无需也不应手动设置该属性。
 * - hover 行为通过外层 `<span>` wrapper 实现，**保留**子元素原有的 onMouseEnter/onMouseLeave；
 *   wrapper 仅为相对定位容器，不阻断事件。
 */
interface ShortcutHintProps {
  actionId: string;
  children: React.ReactElement;
  placement?: "top" | "bottom" | "left" | "right";
}

const HOVER_DELAY_MS = 500;

const TOOLTIP_POSITION_CLASS: Record<
  NonNullable<ShortcutHintProps["placement"]>,
  string
> = {
  top: "bottom-full mb-2 left-1/2 -translate-x-1/2",
  bottom: "top-full mt-2 left-1/2 -translate-x-1/2",
  left: "right-full mr-2 top-1/2 -translate-y-1/2",
  right: "left-full ml-2 top-1/2 -translate-y-1/2",
};

const ARROW_CLASS: Record<
  NonNullable<ShortcutHintProps["placement"]>,
  string
> = {
  top: "top-full left-1/2 -translate-x-1/2 border-t-slate-900",
  bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-slate-900",
  left: "left-full top-1/2 -translate-y-1/2 border-l-slate-900",
  right: "right-full top-1/2 -translate-y-1/2 border-r-slate-900",
};

export const ShortcutHint: React.FC<ShortcutHintProps> = ({
  actionId,
  children,
  placement = "bottom",
}) => {
  const shortcutLabel = useShortcutLabel(actionId);
  const shortcutHintEnabled = usePreferencesStore(
    (state) => state.shortcutHintEnabled,
  );
  const { t } = useTranslation();
  const [isHovering, setIsHovering] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (import.meta.env.DEV && shortcutLabel === null) {
      console.warn(
        t("common.shortcutHint.noShortcutWarning", { actionId }),
      );
    }
  }, [actionId, shortcutLabel, t]);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
    };
  }, []);

  const handleMouseEnter = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setIsHovering(true);
    }, HOVER_DELAY_MS);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsHovering(false);
  };

  const showTooltip =
    shortcutHintEnabled && shortcutLabel !== null && isHovering;

  // 通过 wrapping 处理 hover 行为（保留子元素原有的 onMouseEnter/onMouseLeave），
  // cloneElement 仅注入 aria-keyshortcuts 保证 SR 可发现性。
  const cloned = React.cloneElement(
    children as React.ReactElement<React.HTMLAttributes<HTMLElement>>,
    {
      "aria-keyshortcuts": shortcutLabel ?? undefined,
    },
  );

  return (
    <span
      className="relative inline-flex"
      data-testid="shortcut-hint-wrapper"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {cloned}
      {showTooltip && (
        <div
          role="tooltip"
          data-testid="shortcut-hint-tooltip"
          className={`absolute z-tooltip pointer-events-none whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow-lg ${TOOLTIP_POSITION_CLASS[placement]}`}
        >
          {shortcutLabel}
          <span
            className={`absolute border-4 border-transparent ${ARROW_CLASS[placement]}`}
          />
        </div>
      )}
    </span>
  );
};

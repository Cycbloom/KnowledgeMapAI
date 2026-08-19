import React from "react";
import { useThemeStore } from "@/store/useThemeStore";
import { UI_FONT_FAMILIES, resolveFontFamily, type UiFontFamilyId } from "@shared/constants/fonts";
import { logger } from "@/utils/logger";

/**
 * Applies the user-chosen UI font family globally by toggling
 * `html[data-ui-font="<id>"]`. The actual CSS variables live in
 * `src/index.css` and translate the id into `--font-ui-current`.
 *
 * After applying, we `await document.fonts.ready` + force a single
 * `offsetHeight` read to trigger a synchronous layout reflow. This
 * guarantees Electron first paint won't show a FOIT/FOUT flash even
 * when the self-hosted woff2 file is big (> 3 MB); `font-display: swap`
 * already handles the fallback text rendering, and this step ensures we
 * repaint as soon as the font has actually finished loading.
 */
export function useUiFont(): void {
  const uiFontFamily = useThemeStore((s) => s.uiFontFamily);

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const html = document.documentElement;
    html.setAttribute("data-ui-font", uiFontFamily);

    const match = (UI_FONT_FAMILIES as ReadonlyArray<{ id: UiFontFamilyId }>)
      .find((f) => f.id === uiFontFamily);
    const stack = match ? resolveFontFamily(match.id as UiFontFamilyId, "ui") : "";
    const sample = stack ? `16px ${stack}` : undefined;

    let cancelled = false;

    async function waitAndRepaint() {
      try {
        if (
          typeof sample === "string" &&
          typeof document.fonts?.load === "function"
        ) {
          await document.fonts.load(sample, "知识图谱 Machine 123");
        } else if (typeof document.fonts?.ready !== "undefined") {
          await document.fonts.ready;
        }
        if (cancelled) return;
        // Force synchronous relayout to swap new glyphs in without a flash.
        // Reading offsetHeight triggers a reflow on the document body; we
        // intentionally discard the value.
        void document.body?.offsetHeight;
      } catch (err) {
        logger.warn("ui-font-load-failed", { uiFontFamily, err });
      }
    }

    void waitAndRepaint();

    return () => {
      cancelled = true;
    };
  }, [uiFontFamily]);
}

/** @type {import('tailwindcss').Config} */

import {
  UI_FONT_FAMILIES,
  READING_FONT_FAMILIES,
  buildFontStack,
} from "./shared/constants/fonts.ts";

const uiFonts = Object.fromEntries(
  UI_FONT_FAMILIES.map((f) => [`ui-${f.id}`, buildFontStack(f)]),
);
const readingFonts = Object.fromEntries(
  READING_FONT_FAMILIES.map((f) => [`reading-${f.id}`, buildFontStack(f)]),
);

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    screens: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      fontFamily: {
        ui: ["var(--font-ui-current, inherit)"],
        sans: uiFonts["ui-system"],
        ...uiFonts,
        ...readingFonts,
      },
      // 不要在这里覆盖小号 spacing 键（如 "44"）——同号会改写 w-44/h-44/gap-44 等
      // 全部工具类。曾把 "44" 设为 44px，使移动端"更多"菜单 w-44（期望默认
      // 11rem=176px）塌缩成 44px 竖条（2026-09-06 修复）。触摸目标请用任意值 min-w-[44px]。
      spacing: {
        "128": "32rem",
        "144": "36rem",
      },
      minWidth: {
        "44": "44px",
      },
      minHeight: {
        "44": "44px",
      },
      colors: {
        primary: {
          50: "var(--primary-50)",
          100: "var(--primary-100)",
          200: "var(--primary-200)",
          300: "var(--primary-300)",
          400: "var(--primary-400)",
          500: "var(--primary-500)",
          600: "var(--primary-600)",
          700: "var(--primary-700)",
          800: "var(--primary-800)",
          900: "var(--primary-900)",
        },
        secondary: {
          50: "var(--secondary-50)",
          100: "var(--secondary-100)",
          200: "var(--secondary-200)",
          300: "var(--secondary-300)",
          400: "var(--secondary-400)",
          500: "var(--secondary-500)",
          600: "var(--secondary-600)",
          700: "var(--secondary-700)",
          800: "var(--secondary-800)",
          900: "var(--secondary-900)",
        },
        tertiary: {
          50: "var(--tertiary-50)",
          100: "var(--tertiary-100)",
          200: "var(--tertiary-200)",
          300: "var(--tertiary-300)",
          400: "var(--tertiary-400)",
          500: "var(--tertiary-500)",
          600: "var(--tertiary-600)",
          700: "var(--tertiary-700)",
          800: "var(--tertiary-800)",
          900: "var(--tertiary-900)",
        },
      },
      zIndex: {
        base: "var(--z-base)",
        dropdown: "var(--z-dropdown)",
        "modal-overlay": "var(--z-modal-overlay)",
        modal: "var(--z-modal)",
        "modal-upper": "var(--z-modal-upper)",
        fullscreen: "var(--z-fullscreen)",
        "fullscreen-content": "var(--z-fullscreen-content)",
        "modal-manager": "var(--z-modal-manager)",
        tooltip: "var(--z-tooltip)",
        "skip-link": "var(--z-skip-link)",
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('tailwindcss-animate'),
  ],
};

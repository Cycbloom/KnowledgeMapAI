import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
  disabled?: boolean;
}

const PRESET_ICONS = [
  "📚",
  "📄",
  "🔬",
  "💡",
  "🎯",
  "🚀",
  "🧪",
  "📊",
  "📈",
  "🏗️",
  "⚙️",
  "🔧",
];

export const IconPicker: React.FC<IconPickerProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectIcon = (icon: string) => {
    onChange(icon);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-label={t("common.aria.selectIcon")}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`flex items-center justify-center w-8 h-8 border rounded-md transition-colors ${
          disabled
            ? "bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-50"
            : "bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600"
        } border-gray-200 dark:border-gray-600`}
      >
        <span className="text-sm">{value}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2"
          >
            <div className="grid grid-cols-6 gap-1.5">
              {PRESET_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => handleSelectIcon(icon)}
                  className={`w-full aspect-square rounded-lg flex items-center justify-center text-xl transition-all hover:scale-110 ${
                    value === icon
                      ? "bg-primary-100 dark:bg-primary-900/30 ring-2 ring-primary-500"
                      : "bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600"
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

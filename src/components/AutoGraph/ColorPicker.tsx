import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}

const PRESET_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#6366F1",
  "#64748B",
];

export const ColorPicker: React.FC<ColorPickerProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const colorListId = React.useId();

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

  const handleSelectColor = (color: string) => {
    onChange(color);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-label={t("common.aria.selectColor")}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={colorListId}
        className={`flex items-center justify-center min-w-[44px] min-h-[44px] w-auto h-auto border rounded-md transition-colors ${
          disabled
            ? "bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-50"
            : "bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600"
        } border-gray-200 dark:border-gray-600`}
      >
        <div
          className="w-4 h-4 rounded-sm border border-gray-200 dark:border-gray-600"
          style={{ backgroundColor: value }}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id={colorListId}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2"
          >
            <div className="grid grid-cols-4 gap-1.5">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleSelectColor(color)}
                  className={`w-full aspect-square rounded-lg flex items-center justify-center transition-all hover:scale-105 ${
                    value === color
                      ? "ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-slate-800"
                      : ""
                  }`}
                  style={{ backgroundColor: color }}
                >
                  {value === color && (
                    <Check size={16} className="text-white drop-shadow-md" />
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

import type { KeyboardEvent } from "react";
import { Search, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/utils/utils";

export interface SearchInputProps {
  /** 受控输入值（配合 useDebouncedSearch.query 使用） */
  value: string;
  /** 输入变化回调（对应 setQuery） */
  onChange: (value: string) => void;
  placeholder?: string;
  /** 无障碍标签，默认取 common.aria.search */
  ariaLabel?: string;
  /** 应用在输入框上的样式（用于覆盖尺寸/主题差异），会与默认样式合并 */
  className?: string;
  /** 应用在容器上的样式 */
  containerClassName?: string;
  /** 搜索图标样式 */
  iconClassName?: string;
  /** 是否显示清除按钮，默认 true；仅在 value 非空时渲染 */
  allowClear?: boolean;
  /** 点击清除按钮时的附加副作用（组件会先调用 onChange("")） */
  onClear?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className,
  containerClassName,
  iconClassName,
  allowClear = true,
  onClear,
  onKeyDown,
}) => {
  const { t } = useTranslation();
  const resolvedAria = ariaLabel ?? t("common.aria.search");
  const clearAria = t("common.aria.clear");

  const handleClear = () => {
    onChange("");
    onClear?.();
  };

  return (
    <div className={cn("relative", containerClassName)}>
      <Search
        className={cn(
          "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500 pointer-events-none",
          iconClassName,
        )}
        aria-hidden="true"
      />
      <input
        type="text"
        role="searchbox"
        aria-label={resolvedAria}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={cn(
          "w-full pl-10 pr-10 py-2.5 rounded-xl border outline-none transition-all",
          "bg-white border-gray-200 text-gray-900 placeholder-gray-400",
          "focus:border-primary-500 focus:ring-1 focus:ring-primary-500",
          "dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:placeholder-slate-500",
          className,
        )}
      />
      {allowClear && value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label={clearAria}
          title={clearAria}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          <XCircle className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};
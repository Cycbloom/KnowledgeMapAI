import { cn } from "@/utils/utils";

export interface FilterTabItem<T extends string = string> {
  value: T;
  label: string;
  /** 可选的数量徽标；缺省则省略 */
  count?: number;
}

export interface FilterTabsProps<T extends string = string> {
  items: ReadonlyArray<FilterTabItem<T>>;
  /** 当前选中值 */
  value: T;
  onChange: (value: T) => void;
  /** 无障碍标签，默认 "tablist" 语义即可，可用 title 补充 */
  ariaLabel?: string;
  /** 应用在标签容器上的样式 */
  className?: string;
  testId?: string;
}

export const FilterTabs = <T extends string = string>({
  items,
  value,
  onChange,
  ariaLabel,
  className,
  testId,
}: FilterTabsProps<T>) => (
  <div role="tablist" aria-label={ariaLabel} data-testid={testId} className={cn("flex items-center gap-2 overflow-x-auto", className)}>
    {items.map((item) => {
      const active = item.value === value;
      return (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onChange(item.value)}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-2",
            active
              ? "bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300"
              : "text-gray-600 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700",
          )}
        >
          <span>{item.label}</span>
          {item.count !== undefined && (
            <span className="text-xs bg-white/50 px-1.5 py-0.5 rounded-full">{item.count}</span>
          )}
        </button>
      );
    })}
  </div>
);
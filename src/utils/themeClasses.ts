export const tc = {
  text: {
    primary: 'text-gray-900 dark:text-slate-100',
    secondary: 'text-gray-500 dark:text-slate-400',
    muted: 'text-gray-400 dark:text-slate-500',
    accent: 'text-blue-600 dark:text-blue-400',
  },
  bg: {
    primary: 'bg-white dark:bg-slate-800',
    secondary: 'bg-gray-50 dark:bg-slate-900',
    tertiary: 'bg-gray-100 dark:bg-slate-700',
    hover: 'hover:bg-gray-100 dark:hover:bg-slate-700',
  },
  border: {
    default: 'border-gray-200 dark:border-slate-500',
    light: 'border-gray-100 dark:border-slate-800',
  },
  card: {
    base: 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-500 rounded-lg shadow-sm',
    hover: 'hover:shadow-md hover:border-gray-300 dark:hover:border-slate-600 transition-shadow',
  },
  input: {
    base: 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-500 rounded-md focus:ring-2 focus:ring-blue-500',
  },
};

/**
 * 运行时主题工具：用于需要根据 isDark 布尔值返回对应 class 的场景（如 useTheme() 消费方）。
 * 与上方基于 CSS `dark:` 前缀的 `tc` 不同，此对象的方法返回单一主题下的 class 字符串。
 */
export const themeClasses = {
  /** 卡片背景 + 边框：用于面板/卡片容器 */
  cardBackground: (isDark: boolean) =>
    isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200',
  /** 次要文本：用于标题下的说明、辅助信息 */
  textSecondary: (isDark: boolean) =>
    isDark ? 'text-slate-400' : 'text-gray-500',
  /** 静音文本：比次要文本更弱，用于时间戳、徽章等 */
  textMuted: (isDark: boolean) =>
    isDark ? 'text-slate-500' : 'text-gray-400',
  /** 输入框背景：用于 input/select 等表单控件的背景色 */
  inputBackground: (isDark: boolean) =>
    isDark ? 'bg-slate-800' : 'bg-white',
};

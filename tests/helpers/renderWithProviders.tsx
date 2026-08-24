import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { ThemeProvider } from '../../src/hooks/common/useTheme';
import { NavigationProvider } from '../../src/hooks/common/useNavigateBack';

import { useStore } from '../../src/store/useStore';
import { useThemeStore } from '../../src/store/useThemeStore';
import { useNotificationsStore } from '../../src/store/useNotificationsStore';
import { useGraphEditorPreferencesStore } from '../../src/store/useGraphEditorPreferencesStore';
import { useConsoleStore } from '../../src/store/useConsoleStore';
import { useFocusStore } from '../../src/store/useFocusStore';
import { useNoiseStore } from '../../src/store/useNoiseStore';
import { useShortcutStore } from '../../src/store/useShortcutStore';
import { useLearningSettingsStore } from '../../src/store/useLearningSettingsStore';
import { useQuizSettingsStore } from '../../src/store/useQuizSettingsStore';
import { usePerformanceStore } from '../../src/store/usePerformanceStore';

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  initialEntries?: string[];
  queryClient?: QueryClient;
  wrapper?: (ui: ReactElement) => ReactElement;
}

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function renderWithProviders(
  ui: ReactElement,
  options?: RenderWithProvidersOptions,
): RenderResult & { queryClient: QueryClient } {
  const {
    initialEntries = ['/'],
    queryClient = createTestQueryClient(),
    wrapper: customWrapper,
    ...renderOptions
  } = options ?? {};

  let content: ReactElement = ui;
  if (customWrapper) {
    content = customWrapper(content);
  }

  // Provider 树必须通过 RTL 的 wrapper 选项注入而非直接拼进 ui：
  // rerender(ui) 时 RTL 复用同一 Wrapper 组件包裹新 ui，Provider 类型保持
  // 稳定 → React 原位更新子树而不是整体卸载重挂载，组件内部状态
  // （如高亮分析结果、hook 状态）在 rerender 后得以保留。
  const ProvidersWrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <NavigationProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </NavigationProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );

  const result = render(content, { ...renderOptions, wrapper: ProvidersWrapper });
  return { ...result, queryClient };
}

export function resetStores(): void {
  localStorage.clear();
  useStore.setState(useStore.getInitialState());
  useThemeStore.setState(useThemeStore.getInitialState());
  useNotificationsStore.setState(useNotificationsStore.getInitialState());
  useGraphEditorPreferencesStore.setState(
    useGraphEditorPreferencesStore.getInitialState(),
  );
  useConsoleStore.setState(useConsoleStore.getInitialState());
  useFocusStore.setState(useFocusStore.getInitialState());
  useNoiseStore.setState(useNoiseStore.getInitialState());
  useShortcutStore.setState(useShortcutStore.getInitialState());
  useLearningSettingsStore.setState(useLearningSettingsStore.getInitialState());
  useQuizSettingsStore.setState(useQuizSettingsStore.getInitialState());
  usePerformanceStore.setState(usePerformanceStore.getInitialState());
}

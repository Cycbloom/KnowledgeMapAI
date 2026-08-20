import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { ThemeProvider } from '../../src/hooks/common/useTheme';

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

  const element = (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <ThemeProvider>{content}</ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );

  const result = render(element, renderOptions);
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

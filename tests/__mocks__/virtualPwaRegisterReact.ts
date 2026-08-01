/**
 * Mock for `virtual:pwa-register/react` in vitest environment.
 *
 * vite-plugin-pwa provides this virtual module at build/dev time, but vitest
 * cannot resolve it. This mock provides a no-op `useRegisterSW` so that
 * modules importing it (e.g. UpdatePrompt) can be loaded in tests without
 * errors.
 *
 * Tests that need to assert on SW registration behavior (e.g.
 * UpdatePrompt.test.tsx) can modify `swMockState` directly before rendering
 * to control the return values of `useRegisterSW`.
 */

type Dispatch<T> = (value: T) => void;

/**
 * Shared mutable state for tests to control `useRegisterSW` return values.
 * Import this from the test file and modify before rendering.
 */
export const swMockState: {
  needRefresh: boolean;
  offlineReady: boolean;
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
} = {
  needRefresh: false,
  offlineReady: false,
  updateServiceWorker: async (_reloadPage?: boolean): Promise<void> => {
    // no-op
  },
};

export function useRegisterSW() {
  return {
    needRefresh: [swMockState.needRefresh, (() => undefined) as Dispatch<boolean>] as [
      boolean,
      Dispatch<boolean>,
    ],
    offlineReady: [swMockState.offlineReady, (() => undefined) as Dispatch<boolean>] as [
      boolean,
      Dispatch<boolean>,
    ],
    updateServiceWorker: swMockState.updateServiceWorker,
  };
}
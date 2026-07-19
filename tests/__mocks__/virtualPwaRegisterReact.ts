/**
 * Mock for `virtual:pwa-register/react` in vitest environment.
 *
 * vite-plugin-pwa provides this virtual module at build/dev time, but vitest
 * cannot resolve it. This mock provides a no-op `useRegisterSW` so that
 * modules importing it (e.g. UpdatePrompt) can be loaded in tests without
 * errors.
 *
 * Tests that need to assert on SW registration behavior (e.g.
 * UpdatePrompt.test.tsx) provide their own `vi.mock("virtual:pwa-register/react", ...)`
 * which overrides this alias.
 */

type Dispatch<T> = (value: T) => void;

export function useRegisterSW() {
  return {
    needRefresh: [false, (() => undefined) as Dispatch<boolean>] as [
      boolean,
      Dispatch<boolean>,
    ],
    offlineReady: [false, (() => undefined) as Dispatch<boolean>] as [
      boolean,
      Dispatch<boolean>,
    ],
    updateServiceWorker: async (_reloadPage?: boolean): Promise<void> => {
      // no-op
    },
  };
}

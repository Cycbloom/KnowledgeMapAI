import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import { server } from '../tests/setup/mswServer';
import i18n from './i18n';

const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// 启动 MSW 服务器,未处理请求仅告警(不阻断不发起请求的测试)
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));

// 全局设置 i18n 默认语言为 zh-CN,避免每个测试文件重复调用
// i18n.changeLanguage。jsdom 的 navigator.language 默认为 en-US,且
// localStorage 被模拟为空,LanguageDetector 会回退到 en-US,导致中文断言失败。
beforeAll(async () => {
  await i18n.changeLanguage('zh-CN');
});

// jsdom 环境专用的全局 polyfill（node 环境跳过）
beforeAll(async () => {
  if (typeof window === 'undefined') return;

  // jest-dom 仅在 jsdom 环境下加载（扩展 expect 的 DOM 匹配器）
  // 在 node 环境下跳过，避免不必要的 DOM 依赖
  await import('@testing-library/jest-dom');

  Object.defineProperty(window, 'localStorage', { value: localStorageMock });

  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

afterAll(() => server.close());

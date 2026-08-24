import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import { server } from '../tests/setup/mswServer';
import { changeLanguage } from './i18n';

const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// 启动 MSW 服务器,未处理请求仅告警(不阻断不发起请求的测试)
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));

// 全局设置 i18n 默认语言为 zh-CN,避免每个测试文件重复调用
// changeLanguage。jsdom 的 navigator.language 默认为 en-US,且
// localStorage 被模拟为空,自动检测会回退到 en-US,导致中文断言失败。
// changeLanguage 会先动态加载对应语言资源再切换。
// 必须用顶层 await 而非 beforeAll:i18n 懒加载后资源经动态 import
// 异步注入,若推迟到 beforeAll,被测模块在「测试文件模块求值期」执行的
// i18next.t()(如 api 服务里的模块级常量)会拿到原始 key;悬浮的动态
// import 还会与测试文件的 vi.mock 安装/副作用导入产生时序竞争。
await changeLanguage('zh-CN');

// jsdom 环境专用的全局 polyfill（node 环境跳过）
beforeAll(async () => {
  if (typeof window === 'undefined') return;

  // jest-dom 仅在 jsdom 环境下加载（扩展 expect 的 DOM 匹配器）
  // 在 node 环境下跳过，避免不必要的 DOM 依赖。
  // 该包默认入口是无导出的副作用脚本（仅扩展 expect），TS 不识别为模块；
  // 使用 // @ts-expect-error 显式声明此处为副作用导入，抑制 TS2306。
  // @ts-expect-error - side-effect import for extending expect with DOM matchers
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

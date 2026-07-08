/**
 * MSW server 单例(适用于 Node/Vitest 环境)。
 *
 * 使用方式:
 * - 在 setupTests.ts 中通过 beforeAll/afterEach/afterAll 接入生命周期
 * - 在具体测试中通过 server.use() 覆盖默认 handler
 *
 * 注意:仅在 Node 环境下使用 setupServer;浏览器环境(E2E)应使用 setupWorker。
 */
import { setupServer } from "msw/node";
import { handlers } from "./mswHandlers";

export const server = setupServer(...handlers);

import { chromium, type FullConfig } from "@playwright/test";
import * as fs from "node:fs";

/**
 * E2E 全局登录：整套测试只 provision 一次专属用户。
 *
 * 无 storageState 复用时，每个测试的独立 context 都会走一遍无感知
 * 会话并创建一个新的专属用户（跑一次套件产生几十个用户，触发大量
 * 无效自动备份）。此处预先登录一次，把 localStorage（专属用户凭证）
 * 与会话持久化为 storageState，所有测试 context 复用同一用户。
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL =
    config.projects[0]?.use?.baseURL ?? "http://localhost:5173";
  const stateFile = "test-results/.e2e-auth-state.json";

  fs.mkdirSync("test-results", { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(baseURL, { waitUntil: "domcontentloaded" });

    // 等待无感知会话完成：离开 /login 进入应用，且专属凭证已落盘
    await page.waitForFunction(
      () =>
        !window.location.pathname.includes("login") &&
        localStorage.getItem("km-owner-credentials") !== null,
      { timeout: 90_000 },
    );

    await context.storageState({ path: stateFile });
  } finally {
    await browser.close();
  }
}

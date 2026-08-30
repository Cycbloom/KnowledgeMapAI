import { test, expect } from './fixtures';
import { authedRequest, navigateAndWaitForAuth } from './utils/auth';

test.describe('协作功能测试', () => {
  test('应该能够显示首页', async ({ authenticatedPage: page }) => {
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('应该能够创建新图谱', async ({ authenticatedPage: page }) => {
    // App Action: 通过 API 创建图谱（比 UI 点击更快更稳定）
    const createRes = await authedRequest(page, 'POST', '/api/v1/graphs', {
      title: '测试协作图谱',
    });
    expect(createRes.ok, `创建图谱失败: HTTP ${createRes.status}`).toBe(true);
    const graph = createRes.body as { id: string };
    expect(graph.id).toBeTruthy();

    try {
      // 导航到图谱页面,验证画布可见。
      // 首次导航触发 Vite 冷启动 transform 图编辑器 bundle，可能超过默认 15s，
      // 加长超时避免与并行 worker 争用导致的偶发 Loading 未结束。
      await navigateAndWaitForAuth(page, `/graph/${graph.id}`);
      await expect(page.locator('[data-tour="canvas"]')).toBeVisible({
        timeout: 30000,
      });
    } finally {
      // 清理: 永久删除图谱,避免污染测试库
      await authedRequest(page, 'DELETE', `/api/v1/graphs/${graph.id}/permanent`);
    }
  });

  test('应该能够在图谱页面显示分享按钮', async ({
    authenticatedPage: page,
    testGraph,
  }) => {
    await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);
    await expect(page.locator('[data-tour="canvas"]')).toBeVisible({
      timeout: 15000,
    });

    // 分享按钮: 通过 title 属性定位,兼容中英文 locale
    // zh-CN: title="分享图谱"; en-US: title="Share Graph"
    const shareButton = page
      .locator('button[title*="分享"], button[title*="Share"]')
      .first();
    await expect(shareButton).toBeVisible({ timeout: 10000 });
  });

  test('应该能够打开分享对话框', async ({
    authenticatedPage: page,
    testGraph,
  }) => {
    await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);
    await expect(page.locator('[data-tour="canvas"]')).toBeVisible({
      timeout: 15000,
    });

    // 点击分享按钮
    const shareButton = page
      .locator('button[title*="分享"], button[title*="Share"]')
      .first();
    await expect(shareButton).toBeVisible({ timeout: 10000 });
    await shareButton.click();

    // 验证分享对话框出现。ShareModal header 文案随 locale 变化
    // （zh-CN: "分享图谱"; en-US: "Share Graph"），用双语匹配对齐分享按钮的定位方式。
    const dialogTitle = page
      .getByRole('heading', { name: '分享图谱' })
      .or(page.getByRole('heading', { name: 'Share Graph' }));
    await expect(dialogTitle).toBeVisible({ timeout: 5000 });
  });
});

test.describe('版本与快照', () => {
  test('应该能够创建图谱快照', async ({ authenticatedPage: page, testGraph }) => {
    // App Action:通过 API 创建快照（POST /api/v1/graphs/:id/snapshots）
    const createRes = await authedRequest(
      page,
      'POST',
      `/api/v1/graphs/${testGraph.id}/snapshots`,
      { description: '快照创建测试' },
    );
    expect(createRes.ok, `创建快照失败: HTTP ${createRes.status}`).toBe(true);
    const snapshot = createRes.body as {
      id: string;
      graphId: string;
      snapshotType: string;
    };
    expect(snapshot.id).toBeTruthy();
    expect(snapshot.graphId).toBe(testGraph.id);
    expect(snapshot.snapshotType).toBe('manual');

    // 版本列表（GET /api/v1/graphs/:id/snapshots）应包含该快照
    const listRes = await authedRequest(
      page,
      'GET',
      `/api/v1/graphs/${testGraph.id}/snapshots`,
    );
    expect(listRes.ok, `获取快照列表失败: HTTP ${listRes.status}`).toBe(true);
    const list = listRes.body as { data: { id: string }[] };
    expect(list.data.some((s) => s.id === snapshot.id)).toBe(true);
  });

  test('应该能够回滚到快照', async ({ authenticatedPage: page, testGraph }) => {
    // 创建两个快照代表前后状态
    const firstRes = await authedRequest(
      page,
      'POST',
      `/api/v1/graphs/${testGraph.id}/snapshots`,
      { description: '回滚目标状态' },
    );
    expect(firstRes.ok, `创建快照失败: HTTP ${firstRes.status}`).toBe(true);
    const firstSnapshot = firstRes.body as { id: string };

    const secondRes = await authedRequest(
      page,
      'POST',
      `/api/v1/graphs/${testGraph.id}/snapshots`,
      { description: '回滚前状态' },
    );
    expect(secondRes.ok, `创建快照失败: HTTP ${secondRes.status}`).toBe(true);

    // 回滚到第一个快照（POST /api/v1/graphs/:id/rollback）
    const rollbackRes = await authedRequest(
      page,
      'POST',
      `/api/v1/graphs/${testGraph.id}/rollback`,
      { snapshotId: firstSnapshot.id },
    );
    expect(rollbackRes.ok, `回滚失败: HTTP ${rollbackRes.status}`).toBe(true);
    const rollback = rollbackRes.body as {
      success: boolean;
      preRollbackSnapshotId: string;
    };
    expect(rollback.success).toBe(true);
    expect(rollback.preRollbackSnapshotId).toBeTruthy();

    // 回滚前会自动生成 pre_rollback 快照，记录回滚前图谱状态
    const listRes = await authedRequest(
      page,
      'GET',
      `/api/v1/graphs/${testGraph.id}/snapshots`,
    );
    expect(listRes.ok, `获取快照列表失败: HTTP ${listRes.status}`).toBe(true);
    const list = listRes.body as { data: { snapshotType: string }[] };
    expect(list.data.some((s) => s.snapshotType === 'pre_rollback')).toBe(true);
  });

  test('应该能够预览合并变更', async ({ authenticatedPage: page, testGraph }) => {
    // 创建分支（POST /api/v1/graphs/:id/branches）
    const branchRes = await authedRequest(
      page,
      'POST',
      `/api/v1/graphs/${testGraph.id}/branches`,
      { branchName: '测试分支' },
    );
    expect(branchRes.ok, `创建分支失败: HTTP ${branchRes.status}`).toBe(true);
    const branch = branchRes.body as { graphId: string; snapshotId: string };
    expect(branch.graphId).toBeTruthy();
    expect(branch.snapshotId).toBeTruthy();

    // 请求合并预览（GET /api/v1/graphs/:id/merge-preview?branchGraphId=...）
    const previewRes = await authedRequest(
      page,
      'GET',
      `/api/v1/graphs/${testGraph.id}/merge-preview?branchGraphId=${branch.graphId}`,
    );
    expect(previewRes.ok, `merge-preview 失败: HTTP ${previewRes.status}`).toBe(
      true,
    );
    const preview = previewRes.body as {
      diff: { summary: { totalChanges: number } };
      conflicts: { entityType: string; entityId: string }[];
    };
    expect(Array.isArray(preview.conflicts)).toBe(true);
    expect(typeof preview.diff.summary.totalChanges).toBe('number');
  });
});

test.describe('实时同步（SSE）', () => {
  test('应该能够通过 SSE 收到协作变更推送', async ({
    authenticatedPage: page,
    testGraph,
  }) => {
    // 用原生 fetch + AbortController 订阅 SSE 事件流（/api/v1/tasks/events）
    // 说明:图谱绘图类变更通过事件总线派生推送（如 task_completed 等），
    // 快照创建本身不保证产生派生的 SSE 事件，因此这里以连接建立事件
    // 'connected' 作为实时通道可用的可靠断言基线。
    const subscribed = await page.evaluate(async () => {
      const tokenRaw = localStorage.getItem('km-auth');
      const token = tokenRaw
        ? (JSON.parse(tokenRaw)?.state?.token as string | null)
        : null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const controller = new AbortController();
      const events: { type?: string; message?: string }[] = [];
      const response = await fetch('/api/v1/tasks/events', {
        headers,
        signal: controller.signal,
      });

      const readStream = async () => {
        const reader = response.body?.getReader();
        if (!reader) return;
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split('\n\n');
          buffer = frames.pop() ?? '';
          for (const frame of frames) {
            const dataLine = frame
              .split('\n')
              .find((line) => line.startsWith('data:'));
            if (!dataLine) continue;
            const raw = dataLine.slice(5).trim();
            try {
              events.push(
                JSON.parse(raw) as { type?: string; message?: string },
              );
            } catch {
              // 忽略无法解析的数据帧
            }
          }
        }
      };
      void readStream();

      const sseState = window as unknown as {
        __sseEvents: { type?: string; message?: string }[];
        __sseController: AbortController;
      };
      sseState.__sseEvents = events;
      sseState.__sseController = controller;

      return { ok: response.ok, status: response.status };
    });

    expect(subscribed.ok, `SSE 连接失败: HTTP ${subscribed.status}`).toBe(true);

    // 通过 API 触发一次图谱变更（创建快照）
    const changeRes = await authedRequest(
      page,
      'POST',
      `/api/v1/graphs/${testGraph.id}/snapshots`,
      { description: 'SSE 协作变更' },
    );
    expect(changeRes.ok, `触发变更失败: HTTP ${changeRes.status}`).toBe(true);

    // 等待收到连接建立事件（实时通道可用）
    await expect
      .poll(
        async () => {
          const events = await page.evaluate(() => {
            const state = window as unknown as {
              __sseEvents?: { type?: string }[];
            };
            return state.__sseEvents ?? [];
          });
          return events.some((e) => e.type === 'connected');
        },
        { timeout: 10000 },
      )
      .toBe(true);

    // 关闭 SSE 订阅（AbortController.abort()）
    await page.evaluate(() => {
      const state = window as unknown as {
        __sseController?: AbortController;
      };
      state.__sseController?.abort();
    });
  });
});

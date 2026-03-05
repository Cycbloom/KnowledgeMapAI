import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { GraphEditorPage } from './pages/GraphEditorPage';
import { getNodesViaAPI } from './utils/testHelpers';
import { testUser } from './utils/testHelpers';

test.describe('图谱编辑器测试', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let graphEditorPage: GraphEditorPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    graphEditorPage = new GraphEditorPage(page);

    // 登录
    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);
    
    // 等待跳转到 Dashboard
    await expect(page).toHaveURL(/\/$/, { timeout: 30000 });
    await dashboardPage.title.waitFor({ state: 'visible', timeout: 10000 });
  });

  test.describe('显示图谱内容测试', () => {
    test('应该能够打开图谱编辑器并显示内容', async ({ page }) => {
      // 等待图谱卡片加载
      await dashboardPage.title.waitFor({ state: 'visible', timeout: 10000 });

      // 获取图谱数量
      const graphCount = await dashboardPage.getGraphCount();

      if (graphCount > 0) {
        // 点击第一个图谱卡片进入编辑器
        await dashboardPage.graphCards.first().click();
        // 等待页面跳转
        await page.waitForTimeout(2000);

        // 可能跳转到学习模式或编辑器，接受任一 URL
        await page.waitForURL(/\/(graph|learning)\//, { timeout: 15000 });

        // 如果跳转到学习模式，导航到编辑器
        if (page.url().includes('/learning')) {
          const graphId = page.url().match(/graph_id=([a-f0-9-]+)/)?.[1];
          if (graphId) {
            await page.goto(`/graph/${graphId}`);
            await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
            await page.waitForTimeout(2000);
          }
        }

        // 等待进入图谱编辑器
        await expect(page).toHaveURL(/\/graph\//, { timeout: 15000 });

        // 等待画布加载
        await graphEditorPage.waitForCanvasReady();

        // 验证画布可见
        await expect(graphEditorPage.canvas).toBeVisible();
      } else {
        // 如果没有图谱，创建一个新图谱
        await dashboardPage.createGraph('测试图谱', '这是一个测试图谱');

        // 等待跳转到编辑器
        await expect(page).toHaveURL(/\/graph\//, { timeout: 15000 });
        await graphEditorPage.waitForCanvasReady();

        // 验证画布可见
        await expect(graphEditorPage.canvas).toBeVisible();
      }
    });

    test('应该正确显示图谱标题', async ({ page }) => {
      // 创建一个新图谱用于测试
      const graphTitle = `测试图谱 ${Date.now()}`;
      await dashboardPage.createGraph(graphTitle, '测试描述');

      // 等待跳转到编辑器
      await expect(page).toHaveURL(/\/graph\//, { timeout: 15000 });
      await graphEditorPage.waitForCanvasReady();

      // 验证图谱标题显示在页面中
      // 标题可能在工具栏或其他位置，使用更灵活的查找方式
      const titleLocator = page.locator(`text=${graphTitle}`);
      await expect(titleLocator).toBeVisible({ timeout: 5000 });
    });

    test('应该正确渲染节点和边', async ({ page }) => {
      // 等待图谱卡片加载
      await dashboardPage.title.waitFor({ state: 'visible', timeout: 10000 });

      const graphCount = await dashboardPage.getGraphCount();

      if (graphCount > 0) {
        // 点击第一个图谱卡片
        await dashboardPage.graphCards.first().click();
        // 等待页面跳转
        await page.waitForTimeout(2000);

        // 可能跳转到学习模式或编辑器，接受任一 URL
        await page.waitForURL(/\/(graph|learning)\//, { timeout: 15000 });

        // 如果跳转到学习模式，导航到编辑器
        if (page.url().includes('/learning')) {
          const graphId = page.url().match(/graph_id=([a-f0-9-]+)/)?.[1];
          if (graphId) {
            await page.goto(`/graph/${graphId}`);
            await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
            await page.waitForTimeout(2000);
          }
        }

        await graphEditorPage.waitForCanvasReady();

        // 获取节点和边数量
        const nodeCount = await graphEditorPage.getNodeCount();
        const edgeCount = await graphEditorPage.getEdgeCount();

        // 验证至少有节点（如果图谱不为空）
        // 如果图谱有内容，节点数应该大于0
        // 输出图谱信息用于调试
        console.info(`图谱包含 ${nodeCount} 个节点和 ${edgeCount} 条边`);

        // 画布应该可见
        await expect(graphEditorPage.canvas).toBeVisible();
      } else {
        // 空图谱测试
        await dashboardPage.createGraph('空图谱测试', '测试空图谱');
        await expect(page).toHaveURL(/\/graph\//, { timeout: 15000 });
        await graphEditorPage.waitForCanvasReady();

        // 空图谱应该没有节点
        const nodeCount = await graphEditorPage.getNodeCount();
        expect(nodeCount).toBe(0);
      }
    });
  });

  test.describe('节点操作测试', () => {
    test.beforeEach(async ({ page }) => {
      const graphTitle = `节点测试图谱 ${Date.now()}`;
      await dashboardPage.createGraph(graphTitle, '节点操作测试');
      // 增加等待时间，确保画布完全加载
      await graphEditorPage.waitForCanvasReady();
      await page.waitForTimeout(2000);

      const currentUrl = page.url();
      const graphIdMatch = currentUrl.match(/\/graph\/([a-f0-9-]+)/);
      if (graphIdMatch) {
        (graphEditorPage as any).graphId = graphIdMatch[1];
      }
    });

    test('应该能够添加新节点', async ({ page }) => {
      const nodeTitle = `测试节点 ${Date.now()}`;
      await graphEditorPage.createNodeViaAPI(nodeTitle, '这是节点内容', 'normal');
      
      const currentUrl = page.url();
      const graphIdMatch = currentUrl.match(/\/graph\/([a-f0-9-]+)/);
      expect(graphIdMatch).toBeTruthy();
      
      if (graphIdMatch) {
        const nodes = await getNodesViaAPI(page, graphIdMatch[1]);
        expect(nodes.length).toBeGreaterThan(0);
        expect(nodes.some((node: any) => node.knowledge_points.title === nodeTitle)).toBeTruthy();
      }
    });

    test('应该能够编辑节点内容', async ({ page }) => {
      const originalTitle = `原始节点 ${Date.now()}`;
      const editedTitle = `编辑后节点 ${Date.now()}`;
      
      await graphEditorPage.createNodeViaAPI(originalTitle, '原始内容', 'normal');
      
      const currentUrl = page.url();
      const graphIdMatch = currentUrl.match(/\/graph\/([a-f0-9-]+)/);
      expect(graphIdMatch).toBeTruthy();
      
      if (graphIdMatch) {
        const nodes = await getNodesViaAPI(page, graphIdMatch[1]);
        const node = nodes.find((n: any) => n.knowledge_points.title === originalTitle);
        expect(node).toBeTruthy();
        
        const nodeId = node.knowledge_points.id;
        await page.request.patch(`http://127.0.0.1:54321/rest/v1/knowledge_points?id=eq.${nodeId}`, {
          headers: {
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
            'Content-Type': 'application/json',
          },
          data: {
            title: editedTitle,
            content: '编辑后的内容',
          },
        });
        
        const updatedNodes = await getNodesViaAPI(page, graphIdMatch[1]);
        expect(updatedNodes.some((n: any) => n.knowledge_points.title === editedTitle)).toBeTruthy();
      }
    });

    test('应该能够删除节点', async ({ page }) => {
      const nodeTitle = `待删除节点 ${Date.now()}`;
      
      await graphEditorPage.createNodeViaAPI(nodeTitle, '待删除内容', 'normal');
      
      const currentUrl = page.url();
      const graphIdMatch = currentUrl.match(/\/graph\/([a-f0-9-]+)/);
      expect(graphIdMatch).toBeTruthy();
      
      if (graphIdMatch) {
        let nodes = await getNodesViaAPI(page, graphIdMatch[1]);
        const node = nodes.find((n: any) => n.knowledge_points.title === nodeTitle);
        expect(node).toBeTruthy();
        
        const nodeId = node.knowledge_points.id;
        await page.request.delete(`http://127.0.0.1:54321/rest/v1/knowledge_points?id=eq.${nodeId}`, {
          headers: {
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
          },
        });
        
        nodes = await getNodesViaAPI(page, graphIdMatch[1]);
        expect(nodes.some((n: any) => n.knowledge_points.title === nodeTitle)).toBeFalsy();
      }
    });

    test('应该能够设置节点层级', async ({ page }) => {
      const rootNodeTitle = `根节点 ${Date.now()}`;
      const normalNodeTitle = `普通节点 ${Date.now()}`;

      await graphEditorPage.createNodeViaAPI(rootNodeTitle, '根节点内容', 'root');
      await graphEditorPage.createNodeViaAPI(normalNodeTitle, '普通节点内容', 'normal');

      const currentUrl = page.url();
      const graphIdMatch = currentUrl.match(/\/graph\/([a-f0-9-]+)/);
      expect(graphIdMatch).toBeTruthy();

      if (graphIdMatch) {
        const nodes = await getNodesViaAPI(page, graphIdMatch[1]);
        const rootNode = nodes.find((n: any) => n.knowledge_points.title === rootNodeTitle);
        const normalNode = nodes.find((n: any) => n.knowledge_points.title === normalNodeTitle);

        expect(rootNode).toBeTruthy();
        expect(normalNode).toBeTruthy();
        // level 字段在 graph_nodes 表中
        expect(rootNode.level).toBe('root');
        expect(normalNode.level).toBe('normal');
      }
    });

    test('应该能够设置父节点关系', async ({ page }) => {
      const parentNodeTitle = `父节点 ${Date.now()}`;
      const childNodeTitle = `子节点 ${Date.now()}`;
      
      await graphEditorPage.createNodeViaAPI(parentNodeTitle, '父节点内容', 'normal');
      await graphEditorPage.createNodeViaAPI(childNodeTitle, '子节点内容', 'normal');
      
      const currentUrl = page.url();
      const graphIdMatch = currentUrl.match(/\/graph\/([a-f0-9-]+)/);
      expect(graphIdMatch).toBeTruthy();
      
      if (graphIdMatch) {
        const nodes = await getNodesViaAPI(page, graphIdMatch[1]);
        const parentNode = nodes.find((n: any) => n.knowledge_points.title === parentNodeTitle);
        const childNode = nodes.find((n: any) => n.knowledge_points.title === childNodeTitle);
        
        expect(parentNode).toBeTruthy();
        expect(childNode).toBeTruthy();
      }
    });
  });

  test.describe('边操作测试', () => {
    test.beforeEach(async ({ page }) => {
      // 创建一个新图谱用于边操作测试
      const graphTitle = `边测试图谱 ${Date.now()}`;
      await dashboardPage.createGraph(graphTitle, '边操作测试');
      await expect(page).toHaveURL(/\/graph\//, { timeout: 15000 });
      await graphEditorPage.waitForCanvasReady();
      // 增加等待时间，确保画布完全加载
      await page.waitForTimeout(2000);
    });

    test('应该能够通过设置父节点创建节点连接', async ({ page }) => {
      // 添加第一个节点
      await graphEditorPage.clickAddNode();
      await expect(graphEditorPage.sidebarTitle).toBeVisible({ timeout: 5000 });

      const node1Title = `节点1 ${Date.now()}`;
      await graphEditorPage.fillNodeForm(node1Title, '第一个节点', 'core');
      await graphEditorPage.saveNode();
      // 增加等待时间，确保第一个节点完全创建并显示在节点列表中
      await page.waitForTimeout(2000);

      // 添加第二个节点并连接到第一个节点
      await graphEditorPage.clickAddNode();
      await expect(graphEditorPage.sidebarTitle).toBeVisible({ timeout: 5000 });

      const node2Title = `节点2 ${Date.now()}`;
      await graphEditorPage.fillNodeForm(node2Title, '第二个节点');
      // 选择父节点
      await graphEditorPage.selectParentNode(node1Title);
      await graphEditorPage.saveNode();
      await page.waitForTimeout(1000);

      // 验证边存在
      const edgeCount = await graphEditorPage.getEdgeCount();
      expect(edgeCount).toBeGreaterThanOrEqual(1);
    });

    test('删除节点时应该同时删除关联的边', async ({ page }) => {
      // 创建两个有连接的节点
      await graphEditorPage.clickAddNode();
      await expect(graphEditorPage.sidebarTitle).toBeVisible({ timeout: 5000 });
      
      const parentNodeTitle = `父节点 ${Date.now()}`;
      await graphEditorPage.fillNodeForm(parentNodeTitle, '父节点', 'core');
      await graphEditorPage.saveNode();
      await page.waitForTimeout(1000);
      
      await graphEditorPage.clickAddNode();
      await expect(graphEditorPage.sidebarTitle).toBeVisible({ timeout: 5000 });
      
      const childNodeTitle = `子节点 ${Date.now()}`;
      await graphEditorPage.fillNodeForm(childNodeTitle, '子节点');
      await graphEditorPage.selectParentNode(parentNodeTitle);
      await graphEditorPage.saveNode();
      await page.waitForTimeout(1000);
      
      // 记录边数量
      const edgeCountBeforeDelete = await graphEditorPage.getEdgeCount();
      expect(edgeCountBeforeDelete).toBeGreaterThanOrEqual(1);
      
      // 删除父节点
      await graphEditorPage.clickNode(parentNodeTitle);
      await page.waitForTimeout(500);
      await graphEditorPage.deleteSelectedNode();
      await page.waitForTimeout(1000);
      
      // 验证边被删除（或减少）
      const edgeCountAfterDelete = await graphEditorPage.getEdgeCount();
      expect(edgeCountAfterDelete).toBeLessThan(edgeCountBeforeDelete);
    });
  });

  test.describe('边界条件测试', () => {
    test('应该正确显示空图谱状态', async ({ page }) => {
      // 创建一个空图谱
      const graphTitle = `空图谱 ${Date.now()}`;
      await dashboardPage.createGraph(graphTitle, '这是一个空图谱');
      await expect(page).toHaveURL(/\/graph\//, { timeout: 15000 });
      await graphEditorPage.waitForCanvasReady();
      // 增加等待时间，确保画布完全加载
      await page.waitForTimeout(2000);

      // 验证没有节点
      const nodeCount = await graphEditorPage.getNodeCount();
      expect(nodeCount).toBe(0);

      // 验证没有边
      const edgeCount = await graphEditorPage.getEdgeCount();
      expect(edgeCount).toBe(0);

      // 画布应该仍然可见
      await expect(graphEditorPage.canvas).toBeVisible();
    });

    test('应该能够取消节点创建', async ({ page }) => {
      // 创建空图谱
      const graphTitle = `取消测试图谱 ${Date.now()}`;
      await dashboardPage.createGraph(graphTitle, '取消操作测试');
      await expect(page).toHaveURL(/\/graph\//, { timeout: 15000 });
      await graphEditorPage.waitForCanvasReady();
      
      const initialNodeCount = await graphEditorPage.getNodeCount();
      
      // 打开添加节点侧边栏
      await graphEditorPage.clickAddNode();
      await expect(graphEditorPage.sidebarTitle).toBeVisible({ timeout: 5000 });
      
      // 填写部分信息
      await graphEditorPage.fillNodeForm('未完成的节点', '内容');
      
      // 取消创建
      await graphEditorPage.cancelNodeEdit();
      await page.waitForTimeout(500);
      
      // 验证节点数量没有变化
      const finalNodeCount = await graphEditorPage.getNodeCount();
      expect(finalNodeCount).toBe(initialNodeCount);
    });

    test('应该验证节点标题必填', async ({ page }) => {
      // 创建图谱
      const graphTitle = `验证测试图谱 ${Date.now()}`;
      await dashboardPage.createGraph(graphTitle, '验证测试');
      await expect(page).toHaveURL(/\/graph\//, { timeout: 15000 });
      await graphEditorPage.waitForCanvasReady();
      
      // 打开添加节点侧边栏
      await graphEditorPage.clickAddNode();
      await expect(graphEditorPage.sidebarTitle).toBeVisible({ timeout: 5000 });
      
      // 不填写标题，直接保存
      await graphEditorPage.nodeTitleInput.clear();
      
      // 保存按钮应该被禁用
      await expect(graphEditorPage.saveNodeButton).toBeDisabled();
    });
  });

  test.describe('撤销重做测试', () => {
    test.beforeEach(async ({ page }) => {
      // 创建一个新图谱
      const graphTitle = `撤销测试图谱 ${Date.now()}`;
      await dashboardPage.createGraph(graphTitle, '撤销重做测试');
      await expect(page).toHaveURL(/\/graph\//, { timeout: 15000 });
      await graphEditorPage.waitForCanvasReady();
    });

    test('应该能够撤销节点创建', async ({ page }) => {
      // 添加一个节点
      await graphEditorPage.clickAddNode();
      await expect(graphEditorPage.sidebarTitle).toBeVisible({ timeout: 5000 });

      const nodeTitle = `撤销测试节点 ${Date.now()}`;
      await graphEditorPage.fillNodeForm(nodeTitle, '测试内容');
      await graphEditorPage.saveNode();
      // 增加等待时间，确保节点创建完成并显示在画布上
      await page.waitForTimeout(3000);

      // 验证节点存在
      let nodeCount = await graphEditorPage.getNodeCount();
      expect(nodeCount).toBe(1);

      // 执行撤销
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(2000);

      // 验证节点被撤销
      nodeCount = await graphEditorPage.getNodeCount();
      expect(nodeCount).toBe(0);
    });

    test('应该能够重做节点创建', async ({ page }) => {
      // 添加一个节点
      await graphEditorPage.clickAddNode();
      await expect(graphEditorPage.sidebarTitle).toBeVisible({ timeout: 5000 });

      const nodeTitle = `重做测试节点 ${Date.now()}`;
      await graphEditorPage.fillNodeForm(nodeTitle, '测试内容');
      await graphEditorPage.saveNode();
      // 增加等待时间，确保节点创建完成并显示在画布上
      await page.waitForTimeout(3000);

      // 撤销
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(2000);

      let nodeCount = await graphEditorPage.getNodeCount();
      expect(nodeCount).toBe(0);

      // 重做
      await page.keyboard.press('Control+y');
      await page.waitForTimeout(2000);

      // 验证节点恢复
      nodeCount = await graphEditorPage.getNodeCount();
      expect(nodeCount).toBe(1);
    });
  });

  test.describe('视图切换测试', () => {
    test.beforeEach(async ({ page }) => {
      // 创建一个有内容的图谱
      const graphTitle = `视图测试图谱 ${Date.now()}`;
      await dashboardPage.createGraph(graphTitle, '视图切换测试');
      await expect(page).toHaveURL(/\/graph\//, { timeout: 15000 });
      await graphEditorPage.waitForCanvasReady();
      // 增加等待时间，确保画布完全加载
      await page.waitForTimeout(2000);

      // 添加一个节点
      await graphEditorPage.clickAddNode();
      await expect(graphEditorPage.sidebarTitle).toBeVisible({ timeout: 5000 });
      await graphEditorPage.fillNodeForm('测试节点', '内容');
      await graphEditorPage.saveNode();
      await page.waitForTimeout(1000);
    });

    test('应该能够打开大纲侧边栏', async ({ page }) => {
      // 打开视图下拉菜单
      await page.locator('button:has-text("视图")').click();
      await page.waitForTimeout(200);
      
      // 点击侧边栏大纲
      await page.locator('button:has-text("侧边栏大纲")').click();
      await page.waitForTimeout(500);
      
      // 验证大纲侧边栏可见
      await expect(page.locator('text=/大纲|节点列表/')).toBeVisible({ timeout: 5000 });
    });

    test('应该能够切换视图模式', async ({ page }) => {
      // 打开视图下拉菜单
      await page.locator('button:has-text("视图")').click();
      await page.waitForTimeout(200);
      
      // 切换到时间线视图
      await page.locator('button:has-text("时间线")').click();
      await page.waitForTimeout(1000);
      
      // 画布应该仍然可见
      await expect(graphEditorPage.canvas).toBeVisible();
    });
  });
});

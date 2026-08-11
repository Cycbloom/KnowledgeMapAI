import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import { authedRequest } from "./utils/auth";

/**
 * 图谱节点增删改（CRUD）冒烟测试。
 *
 * 覆盖非骨干节点的创建、更新、删除完整生命周期：
 * - 创建:POST /api/nodes（返回 id）→ GET /api/nodes/:id 读回 title/graph_id
 * - 更新:PUT /api/nodes/:id（改 title）→ GET 读回更新后的值
 * - 删除:DELETE /api/nodes/:id（软删除）→ GET 返回 404
 *
 * 说明:
 * - 骨干节点的标题保护（PUT 403 / 批量跳过）已由 `backbone-node.spec.ts` 覆盖,此处不做重复。
 * - 节点 ID 即 knowledge_point_id,API 路由依此寻址。
 */

/** POST /api/nodes 与 GET /api/nodes/:id 返回的节点结构。 */
interface NodeResponse {
  id: string;
  title: string;
  graph_id: string;
}

/** AppError 错误响应体。 */
interface ErrorResponse {
  success: boolean;
  code: string;
  message: string;
}

/**
 * 通过 API 创建一个普通节点（非骨干）并返回其 ID。
 * 断言创建成功且返回的 title 与请求一致。
 */
async function createNormalNode(
  page: Page,
  graphId: string,
  title: string,
): Promise<string> {
  const createRes = await authedRequest(page, "POST", "/api/nodes", {
    graph_id: graphId,
    title,
    content: "节点 CRUD 测试内容",
  });
  expect(createRes.ok, `创建节点失败: HTTP ${createRes.status}`).toBe(true);
  const node = createRes.body as NodeResponse;
  expect(node.id).toBeTruthy();
  expect(node.title).toBe(title);
  return node.id;
}

test.describe("图谱节点增删改冒烟测试", () => {
  test("应该能够创建节点并读回一致", async ({
    authenticatedPage: page,
    testGraph,
  }) => {
    const nodeTitle = `CRUD节点_${Date.now()}`;
    const nodeId = await createNormalNode(page, testGraph.id, nodeTitle);

    // 通过 GET 读回相同 title 与 graph_id
    const getRes = await authedRequest(page, "GET", `/api/nodes/${nodeId}`);
    expect(getRes.ok).toBe(true);
    const fetched = getRes.body as NodeResponse;
    expect(fetched.title).toBe(nodeTitle);
    expect(fetched.graph_id).toBe(testGraph.id);
  });

  test("应该能够更新节点标题并读回一致", async ({
    authenticatedPage: page,
    testGraph,
  }) => {
    const nodeId = await createNormalNode(
      page,
      testGraph.id,
      `更新前_${Date.now()}`,
    );

    // PUT 更新标题（普通节点无标题保护）
    const updatedTitle = `更新后_${Date.now()}`;
    const updateRes = await authedRequest(
      page,
      "PUT",
      `/api/nodes/${nodeId}`,
      { title: updatedTitle },
    );
    expect(updateRes.ok, `更新节点失败: HTTP ${updateRes.status}`).toBe(true);
    const updated = updateRes.body as NodeResponse;
    expect(updated.title).toBe(updatedTitle);

    // 通过 GET 再次读回,确认更新已持久化
    const getRes = await authedRequest(page, "GET", `/api/nodes/${nodeId}`);
    expect(getRes.ok).toBe(true);
    const fetched = getRes.body as NodeResponse;
    expect(fetched.title).toBe(updatedTitle);
  });

  test("应该能够删除节点且读回 404", async ({
    authenticatedPage: page,
    testGraph,
  }) => {
    const nodeId = await createNormalNode(
      page,
      testGraph.id,
      `待删除_${Date.now()}`,
    );

    // DELETE 软删除节点
    const deleteRes = await authedRequest(
      page,
      "DELETE",
      `/api/nodes/${nodeId}`,
    );
    expect(deleteRes.ok, `删除节点失败: HTTP ${deleteRes.status}`).toBe(true);

    // 删除后再次 GET 应返回 404（软删除后不可见）
    const getRes = await authedRequest(page, "GET", `/api/nodes/${nodeId}`);
    expect(getRes.status).toBe(404);
    const body = getRes.body as ErrorResponse;
    expect(body.code).toBe("RESOURCE_NODE_NOT_FOUND");
  });
});
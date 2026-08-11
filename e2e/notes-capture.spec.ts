import { test, expect } from "./fixtures";
import { authedRequest } from "./utils/auth";

/**
 * 笔记与知识沉淀功能域 E2E 测试。
 *
 * 目标:覆盖笔记核心闭环——创建 → 检索 → 编辑 → 删除。
 * 补齐 `e2e/key-journeys.spec.ts` 已有的"创建 + 列表检索"之外的编辑/删除覆盖。
 *
 * 策略(App Action 模式):用 API 做准备与数据断言,用显式断言验证。
 * 端点基于 `api/routes/knowledge/notes.ts` 实际实现:
 * - POST   /api/notes          → 201,返回 Note
 * - GET    /api/notes/:id      → 返回 Note(软删除后仍可读,deletedAt 非空)
 * - PUT    /api/notes/:id      → 更新(实际实现为 PUT,非 spec 简写的 PATCH)
 * - DELETE /api/notes/:id      → 软删除,返回 { success, message }
 * - GET    /api/notes?search=  → { items, total, page, pageSize }
 */

/** Note 响应类型(与 shared/types/note.ts 对齐) */
type Note = {
  id: string;
  title: string;
  content: string;
  type: "note" | "daily";
  tags: string[] | null;
  deletedAt: string | null;
};

/** 列表查询响应类型(与 notesService.list 返回对齐) */
type NoteListResult = {
  items: Note[];
  total: number;
  page: number;
  pageSize: number;
};

/** 通过 API 创建一条 type="note" 的笔记,并断言成功。 */
async function createNote(
  page: Parameters<typeof authedRequest>[0],
  title: string,
  content: string,
): Promise<Note> {
  const res = await authedRequest(page, "POST", "/api/notes", {
    title,
    content,
    type: "note",
    tags: ["e2e-notes"],
  });
  expect(res.ok, `创建笔记失败: HTTP ${res.status}`).toBe(true);
  return res.body as Note;
}

/** 通过 API 按关键词检索笔记,返回 items(列表分页结构)。 */
async function searchNotes(
  page: Parameters<typeof authedRequest>[0],
  keyword: string,
): Promise<Note[]> {
  const res = await authedRequest(
    page,
    "GET",
    `/api/notes?search=${encodeURIComponent(keyword)}`,
  );
  expect(res.ok, `检索笔记失败: HTTP ${res.status}`).toBe(true);
  const list = res.body as NoteListResult;
  return list.items;
}

test.describe("笔记与知识沉淀", () => {
  test("应该能够创建笔记并读回一致", async ({ authenticatedPage: page }) => {
    const title = `笔记创建_${Date.now()}`;
    const content = `创建时的正文_${Date.now()}`;

    // 创建笔记,断言返回 id 与 title 一致
    const note = await createNote(page, title, content);
    expect(note.id).toBeTruthy();
    expect(note.title).toBe(title);

    // GET /api/notes/:id 读回 title/content 一致
    const getRes = await authedRequest(page, "GET", `/api/notes/${note.id}`);
    expect(getRes.ok).toBe(true);
    const fetched = getRes.body as Note;
    expect(fetched.title).toBe(title);
    expect(fetched.content).toBe(content);

    // 清理:软删除笔记
    await authedRequest(page, "DELETE", `/api/notes/${note.id}`);
  });

  test("应该能够按关键词检索到笔记", async ({ authenticatedPage: page }) => {
    const keyword = `检索关键词_${Date.now()}`;
    const note = await createNote(page, keyword, "用于检索的正文");

    // 按唯一关键词检索,断言命中目标笔记(按 id 匹配)
    const items = await searchNotes(page, keyword);
    const found = items.some((n) => n.id === note.id);
    expect(found, `检索未命中目标笔记 id=${note.id}`).toBe(true);

    // 清理:软删除笔记
    await authedRequest(page, "DELETE", `/api/notes/${note.id}`);
  });

  test("应该能够编辑笔记并读回更新后的值", async ({
    authenticatedPage: page,
  }) => {
    const title = `编辑前标题_${Date.now()}`;
    const note = await createNote(page, title, "编辑前正文");

    // 更新 title/content(实际实现为 PUT /api/notes/:id)
    const newTitle = `编辑后标题_${Date.now()}`;
    const newContent = `编辑后正文_${Date.now()}`;
    const updateRes = await authedRequest(
      page,
      "PUT",
      `/api/notes/${note.id}`,
      { title: newTitle, content: newContent },
    );
    expect(updateRes.ok, `更新笔记失败: HTTP ${updateRes.status}`).toBe(true);
    const updated = updateRes.body as Note;
    expect(updated.title).toBe(newTitle);
    expect(updated.content).toBe(newContent);

    // GET 读回为更新后的值
    const getRes = await authedRequest(page, "GET", `/api/notes/${note.id}`);
    expect(getRes.ok).toBe(true);
    const fetched = getRes.body as Note;
    expect(fetched.title).toBe(newTitle);
    expect(fetched.content).toBe(newContent);

    // 清理:软删除笔记
    await authedRequest(page, "DELETE", `/api/notes/${note.id}`);
  });

  test("应该能够删除笔记且列表不再包含该笔记", async ({
    authenticatedPage: page,
  }) => {
    const keyword = `待删除笔记_${Date.now()}`;
    const note = await createNote(page, keyword, "即将被删除的正文");

    // 删除前,检索应能命中
    const before = await searchNotes(page, keyword);
    expect(before.some((n) => n.id === note.id)).toBe(true);

    // DELETE 软删除
    const delRes = await authedRequest(
      page,
      "DELETE",
      `/api/notes/${note.id}`,
    );
    expect(delRes.ok, `删除笔记失败: HTTP ${delRes.status}`).toBe(true);

    // 删除后:GET /api/notes/:id 仍返回该笔记(软删除保留),deletedAt 非空
    const getRes = await authedRequest(page, "GET", `/api/notes/${note.id}`);
    expect(getRes.ok).toBe(true);
    const fetched = getRes.body as Note;
    expect(fetched.deletedAt).toBeTruthy();

    // 删除后:默认列表(排除软删除)不再包含该笔记
    const after = await searchNotes(page, keyword);
    expect(
      after.some((n) => n.id === note.id),
      "删除后列表仍包含该笔记",
    ).toBe(false);
  });
});
import { type Page } from "@playwright/test";
import { expect } from "../fixtures";
import { authedRequest } from "./auth";

/**
 * 子任务规格：创建后按需回写状态/学习阶段/掌握度。
 */
export interface SubtaskSpec {
  title: string;
  status?: "pending" | "in_progress" | "completed";
  learning_state?: "learning" | "review" | "practice" | "quiz";
  mastery_level?: number;
}

export interface CalendarEventFixture {
  taskId: string;
  subtaskIds: string[];
  title: string;
}

/**
 * 通过 API 创建"今天"的日历事件（user_tasks 任务）并挂靠多个子任务。
 *
 * App Action 模式：用 API 造数据（快），用 UI 断言（真实）。日历渲染依赖任务
 * 上附带的 `subtasks` 数组（GET /scheduler/tasks 由 listTasksWithStats 附挂），
 * 因此必须先建子任务再刷新日历，才能看到子任务堆叠。
 *
 * 要点：
 * - 每个子任务各建一个知识节点（mastery_level 单一来源为 knowledge_points，
 *   子任务间须隔离，不能共享同一知识点，否则掌握度会互相覆盖）。
 * - 任务设置 scheduled_start/scheduled_end 为今天，确保在月/周/日/日程视图中
 *   都出现在"今天"对应位置。
 * - 子任务创建后按 spec 回写 status / learning_state / mastery_level。
 */
export async function createCalendarEventWithSubtasks(
  page: Page,
  options: { title: string; subtasks: SubtaskSpec[] },
): Promise<CalendarEventFixture> {
  const { title, subtasks } = options;

  // 1. 创建任务（默认 queue_level 0、pending）
  const createRes = await authedRequest(page, "POST", "/api/v1/scheduler/tasks", {
    title,
    description: `${title} 的日历事件`,
    queue_level: 0,
    priority: 2,
    estimated_duration: 60,
  });
  expect(createRes.ok, `创建任务失败: HTTP ${createRes.status}`).toBe(true);
  const createdTask = createRes.body as { data: { id: string } };
  const taskId = createdTask.data.id;

  // 2. 把任务钉到今天，确保各日历视图的"今天"都能看到该事件。
  // 时长取 2.5h：周视图的 getEventPosition.high 为 duration*60px，
  // hasEnoughHeight 要求 >80px（>1.33h），否则子任务堆叠不会在周视图渲染。
  const today = new Date();
  today.setHours(10, 0, 0, 0);
  const end = new Date(today.getTime() + 2.5 * 60 * 60 * 1000);
  const dateRes = await authedRequest(
    page,
    "PUT",
    `/api/v1/scheduler/tasks/${taskId}`,
    {
      scheduled_start: today.toISOString(),
      scheduled_end: end.toISOString(),
    },
  );
  expect(dateRes.ok, `设置任务时间失败: HTTP ${dateRes.status}`).toBe(true);

  // 3. 逐个创建子任务（每个子任务独立知识点，隔离掌握度）
  const subtaskIds: string[] = [];
  for (let i = 0; i < subtasks.length; i++) {
    const spec = subtasks[i];
    // 3a. 每干净独立知识点
    const kpRes = await authedRequest(
      page,
      "POST",
      "/api/v1/knowledge-points",
      { title: `${title}_知识点_${i + 1}` },
    );
    expect(kpRes.ok, `创建知识点失败: HTTP ${kpRes.status}`).toBe(true);
    const kp = kpRes.body as { id: string };

    // 3b. 创建子任务
    const stRes = await authedRequest(
      page,
      "POST",
      `/api/v1/scheduler/tasks/${taskId}/subtasks`,
      {
        title: spec.title,
        knowledge_point_id: kp.id,
        estimated_duration: 30,
      },
    );
    expect(stRes.ok, `创建子任务失败: HTTP ${stRes.status}`).toBe(true);
    const stBody = stRes.body as { data: { id: string } };
    const subtaskId = stBody.data.id;
    subtaskIds.push(subtaskId);

    // 3c. 按需回写状态 / 学习阶段 / 掌握度
    const update: Record<string, unknown> = {};
    if (spec.status) update.status = spec.status;
    if (spec.learning_state) update.learning_state = spec.learning_state;
    if (spec.mastery_level !== undefined) update.mastery_level = spec.mastery_level;
    if (Object.keys(update).length > 0) {
      const updRes = await authedRequest(
        page,
        "PUT",
        `/api/v1/scheduler/tasks/${taskId}/subtasks/${subtaskId}`,
        update,
      );
      expect(updRes.ok, `回写子任务属性失败: HTTP ${updRes.status}`).toBe(true);
    }
  }

  return { taskId, subtaskIds, title };
}
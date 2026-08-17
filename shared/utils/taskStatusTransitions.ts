/**
 * 用户任务状态机（权威转换表）
 *
 * 前后端共用：前端用于操作前置校验与乐观更新守卫，
 * 后端 RPC 之外的服务层校验亦可复用，避免状态回退（如 completed → paused）。
 *
 * 状态流转：
 * - pending → in_progress / cancelled
 * - in_progress ⇄ paused
 * - in_progress / paused → completed / cancelled
 * - completed / cancelled 为终态，不允许再转换
 */
import type { UserTaskStatus } from "../types/scheduler-core";

export const USER_TASK_TRANSITIONS: Readonly<
  Record<UserTaskStatus, readonly UserTaskStatus[]>
> = {
  pending: ["in_progress", "cancelled"],
  in_progress: ["paused", "completed", "cancelled"],
  paused: ["in_progress", "completed", "cancelled"],
  completed: [],
  cancelled: [],
};

/**
 * 判断任务状态转换是否合法
 *
 * @example
 * canTransition("pending", "in_progress"); // true
 * canTransition("completed", "in_progress"); // false（终态）
 */
export function canTransition(
  from: UserTaskStatus,
  to: UserTaskStatus,
): boolean {
  const allowed = USER_TASK_TRANSITIONS[from];
  return allowed !== undefined && allowed.includes(to);
}

/**
 * 获取某状态的全部合法后继状态（终态返回空数组）
 */
export function getValidNextStatuses(
  from: UserTaskStatus,
): readonly UserTaskStatus[] {
  return USER_TASK_TRANSITIONS[from] ?? [];
}

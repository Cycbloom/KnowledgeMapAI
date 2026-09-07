import { logger } from "../../utils/logger";
import { getSupabaseAdmin } from "../../supabase";

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_DURATION_MS = 60 * 60 * 1000;

/**
 * 逾期任务自动重排服务。
 *
 * 扫描已过 deadline 仍未完成的 user_tasks（pending/in_progress/paused），
 * 自动把它们重新安排到「明天」原时刻（保留相对时长与 deadline 关系），
 * 使任务不会永远停留在过去、持续出现在日历上直到被完成或取消。
 *
 * 触发后任务不再逾期，因此不会在同一轮内被重复处理；
 * 若用户持续未处理，任务会每天顺延一天（预期行为）。
 */
class OverdueRescheduler {
  async runForAllUsers(): Promise<void> {
    const admin = getSupabaseAdmin();
    const now = new Date();

    try {
      const { data: tasks, error } = await admin
        .from("user_tasks")
        .select(
          "id, user_id, title, deadline, scheduled_start, scheduled_end",
        )
        .not("deadline", "is", null)
        .is("deleted_at", null)
        .in("status", ["pending", "in_progress", "paused"])
        .lt("deadline", now.toISOString())
        .limit(300);

      if (error) {
        logger.error("[OverdueReschedule] Failed to fetch overdue tasks:", error);
        return;
      }
      if (!tasks || tasks.length === 0) return;

      let rescheduled = 0;
      let failed = 0;

      for (const task of tasks) {
        try {
          const origStartMs = task.scheduled_start
            ? new Date(task.scheduled_start).getTime()
            : null;
          const origDeadlineMs = new Date(task.deadline).getTime();

          // 无排期（仅截止时间的任务）：只顺延 deadline 一天
          if (origStartMs === null) {
            const { error: upErr } = await admin
              .from("user_tasks")
              .update({
                deadline: new Date(origDeadlineMs + DAY_MS).toISOString(),
                updated_at: now.toISOString(),
              })
              .eq("id", task.id)
              .eq("user_id", task.user_id);
            if (upErr) {
              logger.error(
                `[OverdueReschedule] Failed to shift deadline for task ${task.id}:`,
                upErr,
              );
              failed++;
              continue;
            }
            rescheduled++;
            continue;
          }

          // 有排期：排到「明天」原时刻，scheduled_end / deadline 保持相对时长
          const origStart = new Date(origStartMs);
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(
            origStart.getHours(),
            origStart.getMinutes(),
            origStart.getSeconds(),
            0,
          );
          const newStartMs = tomorrow.getTime();

          const relativeDuration = origDeadlineMs - origStartMs;
          const newDeadlineMs =
            newStartMs + Math.max(relativeDuration, MIN_DURATION_MS);

          const newEndMs = task.scheduled_end
            ? newStartMs +
              Math.max(
                0,
                new Date(task.scheduled_end).getTime() - origStartMs,
              )
            : null;

          const { error: upErr } = await admin
            .from("user_tasks")
            .update({
              scheduled_start: new Date(newStartMs).toISOString(),
              scheduled_end: newEndMs
                ? new Date(newEndMs).toISOString()
                : null,
              deadline: new Date(newDeadlineMs).toISOString(),
              updated_at: now.toISOString(),
            })
            .eq("id", task.id)
            .eq("user_id", task.user_id);

          if (upErr) {
            logger.error(
              `[OverdueReschedule] Failed to reschedule task ${task.id}:`,
              upErr,
            );
            failed++;
            continue;
          }
          rescheduled++;
        } catch (err) {
          logger.error(
            `[OverdueReschedule] Unexpected error for task ${task.id}:`,
            err,
          );
          failed++;
        }
      }

      logger.info(
        `[OverdueReschedule] rescheduled=${rescheduled} failed=${failed}`,
      );
    } catch (error) {
      logger.error("[OverdueReschedule] job failed:", error);
    }
  }
}

export const overdueRescheduler = new OverdueRescheduler();

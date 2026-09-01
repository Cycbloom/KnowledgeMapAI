import { useTimerStore } from "../store/useTimerStore";
import { useFocusStore } from "../store/useFocusStore";

/**
 * 学习会话 ⇄ 番茄钟联动工具。
 *
 * 进入学习/答题（有挂靠任务）时应让右下角番茄钟跟着倒计时：
 * - 同一任务已在倒计时 → 不打断；
 * - 同一任务已暂停（上次离开学习时被冻结）→ 恢复倒计时；
 * - 其它任务 / 未启动 → 切换为该任务番茄钟并开始。
 * 离开学习时暂停该任务番茄钟（保留进度），手动番茄钟不受影响。
 */
export function startFocusTimerForTask(
  taskId: string,
  subtaskId?: string,
): void {
  const timer = useTimerStore.getState();
  const focusDuration = useFocusStore.getState().focusDuration;

  // 同一任务已在倒计时 → 不打断
  if (timer.taskId === taskId && timer.isActive && !timer.isPaused) return;
  // 同一任务已暂停（上次离开时冻结）→ 恢复倒计时
  if (timer.taskId === taskId && timer.isPaused) {
    timer.resume();
    return;
  }
  // 其它任务 / 未启动 → 切换为该任务番茄钟并开始
  timer.switchTask(taskId, focusDuration, 0);
  if (subtaskId) timer.setSubtask(subtaskId);
}

/** 离开学习/答题时暂停该任务的番茄钟（仅暂停，不重置进度）。 */
export function pauseFocusTimerForTask(taskId: string): void {
  const timer = useTimerStore.getState();
  if (timer.taskId !== taskId) return;
  if (timer.isActive && !timer.isPaused) timer.pause();
}

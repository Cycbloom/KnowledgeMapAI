import { SupabaseClient } from "@supabase/supabase-js";

/**
 * 解析新生成卡片的初始 next_review：结合排课 / 学习路径系统的时间。
 *
 * 之前 AI 生成卡片时一律把 next_review 设为当前时间，导致预生成的卡片
 * 无论安排在何时学习都会立即「到期」，与调度系统 / 学习路径的实际节奏
 * 脱节。这里改为读取知识点在 learning_path_schedule（全局唯一键
 * user_id + knowledge_point_id + scheduled_date，按日排期）中最近一个
 * 「未过期」的排期日，作为卡片首次可复习的时间点；没有未来排期时回退为
 * 当前时间，保持即时可练的既有行为。
 *
 * 说明：排期粒度是「日」（date），此处把排期当天视为可复习起点。
 */
export async function resolveInitialNextReview(
  supabase: SupabaseClient,
  userId: string,
  knowledgePointId: string,
): Promise<string> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const { data } = await supabase
    .from("learning_path_schedule")
    .select("scheduled_date")
    .eq("user_id", userId)
    .eq("knowledge_point_id", knowledgePointId)
    .eq("status", "scheduled")
    .gte("scheduled_date", todayStr)
    .order("scheduled_date", { ascending: true })
    .limit(1);

  const scheduledDate = data?.[0]?.scheduled_date as string | undefined;
  if (!scheduledDate) return new Date().toISOString();

  // 与日历图层（calendarService）一致：把排期日当天 00:00 UTC 作为首次到期时刻
  return new Date(`${scheduledDate}T00:00:00.000Z`).toISOString();
}
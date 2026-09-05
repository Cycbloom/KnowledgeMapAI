import type { CalendarEvent } from "../types/calendar";

/** 阶段条色块日期范围：`MM/DD` 或 `MM/DD-MM/DD` */
export function formatBandRange(startIso?: string, endIiso?: string): string {
  if (!startIso || !endIiso) return "";
  const [ms, ds] = startIso.slice(5, 10).split("-");
  const [me, de] = endIiso.slice(5, 10).split("-");
  const s = `${Number(ms)}/${Number(ds)}`;
  const e = `${Number(me)}/${Number(de)}`;
  return s === e ? s : `${s}-${e}`;
}

/**
 * 阶段颜色调色板：按阶段序号取色，保证相邻阶段颜色差异明显。
 * 共 8 色循环，覆盖 8 个以上阶段时色相继续旋转。
 */
const STAGE_HUES = [220, 160, 35, 340, 190, 280, 95, 20];

/** 根据阶段序号返回 Tailwind 兼容的 HSL 背景色 */
export function getStageBgColor(stageIndex: number, isDark: boolean): string {
  const hue = STAGE_HUES[stageIndex % STAGE_HUES.length];
  const sat = isDark ? 55 : 60;
  const light = isDark ? 45 : 50;
  return `hsl(${hue} ${sat}% ${light}%)`;
}

/** hover 时加深颜色 */
export function getStageHoverColor(stageIndex: number, isDark: boolean): string {
  const hue = STAGE_HUES[stageIndex % STAGE_HUES.length];
  const sat = 65;
  const light = isDark ? 38 : 42;
  return `hsl(${hue} ${sat}% ${light}%)`;
}

/** 状态对应的视觉样式 */
export function getStageStatusStyle(
  status: string | null | undefined,
): {
  opacity: string;
  textDecor: string;
  badge?: string;
  pulse?: boolean;
} {
  switch (status) {
    case "completed":
      return { opacity: "opacity-60", textDecor: "line-through" };
    case "in_progress":
      return { opacity: "opacity-100", textDecor: "no-underline", pulse: true };
    case "skipped":
      return { opacity: "opacity-40", textDecor: "line-through" };
    default:
      return { opacity: "opacity-100", textDecor: "no-underline" };
  }
}

/** 状态徽标文案 */
export function getStageStatusLabel(
  status: string | null | undefined,
): string | null {
  switch (status) {
    case "completed":
      return "✓";
    case "in_progress":
      return "▶";
    case "skipped":
      return "⊘";
    default:
      return null;
  }
}

/**
 * 计算阶段条序号：优先使用数据库 stage_index（0-based，稳定全局序号，
 * 与 learning_path_nodes.order_index 对齐），缺失时按路径内 start 日期排序兜底。
 * 返回 band.id -> stageIndex 的映射。
 */
export function computeStageIndices(bands: CalendarEvent[]): Map<string, number> {
  const indices = new Map<string, number>();
  const fallback: CalendarEvent[] = [];

  bands.forEach((b) => {
    if (typeof b.stageIndex === "number" && Number.isFinite(b.stageIndex)) {
      indices.set(b.id, b.stageIndex);
    } else {
      fallback.push(b);
    }
  });

  if (fallback.length > 0) {
    const byPath = new Map<string, CalendarEvent[]>();
    fallback.forEach((b) => {
      const key = b.pathId ?? "default";
      const list = byPath.get(key);
      if (list) list.push(b);
      else byPath.set(key, [b]);
    });
    byPath.forEach((list) => {
      list
        .slice()
        .sort((a, b) => a.start.localeCompare(b.start))
        .forEach((b, i) => indices.set(b.id, i));
    });
  }
  return indices;
}

/** 构建阶段条 tooltip 文本 */
export function buildStageTooltip(band: CalendarEvent, stageIndex: number): string {
  const parts: string[] = [`阶段 ${stageIndex + 1}：${band.title}`];
  if (band.start && band.end) {
    parts.push(formatBandRange(band.start, band.end));
  }
  if (band.status) {
    const statusMap: Record<string, string> = {
      planned: "未开始",
      in_progress: "进行中",
      completed: "已完成",
      skipped: "已跳过",
    };
    parts.push(statusMap[band.status] ?? band.status);
  }
  if (band.description) {
    parts.push(band.description);
  }
  return parts.join("\n");
}

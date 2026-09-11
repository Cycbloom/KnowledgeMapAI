// 图内节点查重服务：统一「图内同名判定 + specificity 复用判定」的查询入口，
// recursive / expand / autoGraph 等各生成链路共用，避免各链路策略分叉。

import { SupabaseClient } from "@supabase/supabase-js";
import { notDeleted } from "../common/softDeleteHelper";
import {
  resolveLocalizedText,
  type LocalizedText,
} from "../../../shared/utils/localization";
import { canReuseNode } from "../../../shared/utils/nodeSpecificity";

export { canReuseNode };

export interface GraphNodeTitleInfo {
  /** 知识点 id（复用连边时使用） */
  knowledgePointId: string;
  /** 特异性标注：specific / generic / undefined（存量未标注视为可复用） */
  specificity?: string;
}

/**
 * 查询图内全部节点的 title → { knowledgePointId, specificity } 映射。
 * title 按当前语言解析为字符串，作为图内同名判定的唯一 key。
 */
export async function getGraphNodeTitleMap(
  supabase: SupabaseClient,
  graphId: string,
): Promise<Map<string, GraphNodeTitleInfo>> {
  const { data: graphNodes } = await notDeleted(
    supabase
      .from("graph_nodes")
      .select("knowledge_point_id, knowledge_points(id, title, properties)")
      .eq("graph_id", graphId),
  );

  const map = new Map<string, GraphNodeTitleInfo>();
  for (const gn of graphNodes ?? []) {
    const kp = Array.isArray(gn.knowledge_points)
      ? gn.knowledge_points[0]
      : gn.knowledge_points;
    const title = resolveLocalizedText(kp?.title as LocalizedText);
    if (!title) continue;
    map.set(title, {
      knowledgePointId: kp?.id ?? gn.knowledge_point_id,
      specificity: (kp?.properties as { specificity?: string } | null)
        ?.specificity,
    });
  }
  return map;
}

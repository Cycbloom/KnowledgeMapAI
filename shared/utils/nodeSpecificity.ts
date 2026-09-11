// 节点特异性判定：前后端共用的节点复用判定函数。
// 泛化名称（generic，如「项目现状」「未来展望」）在不同图谱/上下文语义可能不同，
// 复用会造成知识点串味（扩大化风险），因此仅「双方都标注 specific」才允许复用/跳过。

/**
 * 判定一个新节点是否可与图内已有同名节点复用（或跳过）：
 * - 新节点为 generic → 不参与复用（新建独立节点）；
 * - 图内已有节点为 generic → 不参与复用（新建独立节点）；
 * - 无标注（undefined）视为可复用，兼容存量未标注节点。
 */
export function canReuseNode(
  newSpecificity: string | undefined,
  existingSpecificity: string | undefined,
): boolean {
  return newSpecificity !== "generic" && existingSpecificity !== "generic";
}

export interface GraphContextBlockInput {
  graphTitle?: string;
  graphDescription?: string;
  graphDomain?: string;
  parentChain?: string;
  childrenOutline?: string;
}

/**
 * 将消歧上下文格式化为 prompt 追加块（代码级无条件追加，兼容任意模板）。
 * 任一字段存在时返回非空块；全部缺失返回空串（零输出、无回归）。
 * 学习资料 / 卡片生成 / RAG 等链路共用同一格式。
 */
export function formatGraphContextBlock(
  ctx: GraphContextBlockInput,
): string {
  const { graphTitle, graphDescription, graphDomain, parentChain, childrenOutline } = ctx;
  if (
    !graphTitle && !graphDescription && !graphDomain &&
    !parentChain && !childrenOutline
  ) {
    return "";
  }

  const lines: string[] = ["## Knowledge Graph Context"];
  const graphRef = [graphTitle ? `"${graphTitle}"` : undefined, graphDomain ? `domain: ${graphDomain}` : undefined]
    .filter((s): s is string => Boolean(s))
    .join(" ");
  if (graphRef) {
    lines.push(`This knowledge point belongs to the knowledge graph ${graphRef}.`);
  }
  if (graphDescription) {
    lines.push(`Graph description: ${graphDescription}`);
  }
  if (parentChain) {
    lines.push(`Position in this graph's hierarchy: ${parentChain}`);
  }
  if (childrenOutline) {
    lines.push("This node covers the following sub-concepts in this graph:");
    lines.push(childrenOutline);
  }
  lines.push(
    "IMPORTANT: Interpret the topic strictly within this knowledge graph's context. " +
      "If the term has multiple meanings across different fields, use the graph context above " +
      "to determine the intended meaning, and state the assumed meaning in the Introduction.",
  );
  return lines.join("\n");
}

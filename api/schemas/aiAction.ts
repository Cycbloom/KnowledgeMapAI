import { z } from "zod";

const aiActionVariablesSchema = z.object({
  includeParent: z.boolean().optional(),
  includeSiblings: z.boolean().optional(),
  includeChildren: z.boolean().optional(),
});

const targetModeEnum = z.enum(["show_result", "update_node", "spawn_children"]);
const scopeEnum = z.enum(["user", "graph", "system"]);

// 创建 AI Action：客户端提交字段（user_id 由服务端依据 scope 写入，不在 schema 内）
export const createActionSchema = z.object({
  name: z.string().min(1, "名称不能为空"),
  description: z.string().optional(),
  icon: z.string().optional(),
  target_mode: targetModeEnum,
  scope: scopeEnum,
  graph_id: z.string().uuid("无效的图谱ID").optional(),
  prompt_template: z.string().min(1, "提示词模板不能为空"),
  variables: aiActionVariablesSchema.optional(),
});

// 更新 AI Action：仅允许编辑内容字段（scope/user_id/graph_id 不允许通过 PUT 修改）
export const updateActionSchema = z
  .object({
    name: z.string().min(1, "名称不能为空"),
    description: z.string(),
    icon: z.string(),
    target_mode: targetModeEnum,
    prompt_template: z.string().min(1, "提示词模板不能为空"),
    variables: aiActionVariablesSchema,
  })
  .partial();

// 执行 AI Action
export const executeActionSchema = z.object({
  action_id: z.string().uuid("无效的操作ID"),
  node_id: z.string().uuid("无效的节点ID"),
  graph_id: z.string().uuid("无效的图谱ID").optional(),
});

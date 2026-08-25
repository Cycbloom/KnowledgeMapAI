/**
 * 图谱访问权校验（owner 或协作者）。
 *
 * 统一 graphService 与 syncService 各自手写的 "用户能否访问某图谱" 判断，
 * 避免两处语义分叉（一处支持公共图谱/角色层级，另一处只做 owner-or-collaborator）。
 *
 * 通过调用方传入的 supabase 客户端执行查询：
 * - 服务端校验场景传 admin client（getSupabaseAdmin，绕过 RLS）
 * - 受 RLS 约束的业务场景传用户 client
 *
 * 注意：agent 工具的写权限检查（仅 owner 可写）与这里的 "访问权"（owner 或
 * 协作者）语义不同，不纳入本模块。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CollaboratorRole } from "@shared/types/graph-core";

export interface GraphAccessResult {
  hasAccess: boolean;
  role?: CollaboratorRole;
  error?: string;
}

export interface CheckGraphAccessOptions {
  /** 所需最低角色，默认 viewer */
  requiredRole?: "viewer" | "editor" | "owner";
  /** 是否允许公共图谱以 viewer 身份访问，默认 false */
  includePublic?: boolean;
}

const ROLE_HIERARCHY: Record<CollaboratorRole, number> = {
  owner: 3,
  editor: 2,
  viewer: 1,
};

export async function checkGraphAccess(
  supabase: SupabaseClient,
  graphId: string,
  userId: string,
  options: CheckGraphAccessOptions = {},
): Promise<GraphAccessResult> {
  const { requiredRole = "viewer", includePublic = false } = options;

  const { data: graph, error } = await supabase
    .from("knowledge_graphs")
    .select("user_id, is_public")
    .eq("id", graphId)
    .maybeSingle();

  if (error || !graph) {
    return { hasAccess: false, error: "图谱不存在" };
  }

  if (graph.user_id === userId) {
    return { hasAccess: true, role: "owner" };
  }

  if (includePublic && graph.is_public && requiredRole === "viewer") {
    return { hasAccess: true };
  }

  const { data: collaborator } = await supabase
    .from("graph_collaborators")
    .select("role")
    .eq("graph_id", graphId)
    .eq("user_id", userId)
    .not("accepted_at", "is", null)
    .maybeSingle();

  if (!collaborator) {
    return { hasAccess: false, error: "无权访问此图谱" };
  }

  const role = collaborator.role as CollaboratorRole;
  const hasAccess = ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[requiredRole];

  return { hasAccess, role };
}

import { SupabaseClient } from "@supabase/supabase-js";
import type {
  CollaboratorRole,
  GraphCollaborator,
  CollaboratorWithUser,
  InviteCollaboratorRequest,
  UpdateCollaboratorRoleRequest,
} from "@shared/types";
import { logger } from "../../utils/logger";

export interface CollaboratorServiceResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export class CollaboratorService {
  async getCollaborators(
    supabase: SupabaseClient,
    graphId: string,
    _userId: string
  ): Promise<CollaboratorServiceResult<CollaboratorWithUser[]>> {
    const { data: graph, error: graphError } = await supabase
      .from("knowledge_graphs")
      .select("user_id")
      .eq("id", graphId)
      .single();

    if (graphError || !graph) {
      return { success: false, error: "图谱不存在" };
    }

    const { data: collaborators, error } = await supabase
      .from("graph_collaborators")
      .select(
        `
        id,
        graph_id,
        user_id,
        role,
        invited_by,
        invitation_token,
        invited_at,
        accepted_at,
        created_at,
        updated_at,
        user:users!graph_collaborators_user_id_fkey (
          id,
          email,
          name
        )
      `
      )
      .eq("graph_id", graphId);

    if (error) {
      logger.error("Get collaborators error:", error);
      return { success: false, error: error.message };
    }

    const ownerRecord: CollaboratorWithUser = {
      id: `owner-${graphId}`,
      graph_id: graphId,
      user_id: graph.user_id,
      role: "owner" as CollaboratorRole,
      invitation_token: "",
      invited_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user: await this.getUserInfo(supabase, graph.user_id),
    };

    const collaboratorRecords = (collaborators || []).map((c) => {
      const userData = c.user as unknown;
      const user = Array.isArray(userData) ? userData[0] : userData;
      return {
        ...c,
        user: user as { id: string; email: string; name?: string },
      };
    }) as CollaboratorWithUser[];

    return {
      success: true,
      data: [ownerRecord, ...collaboratorRecords],
    };
  }

  private async getUserInfo(
    supabase: SupabaseClient,
    userId: string
  ): Promise<{ id: string; email: string; name?: string }> {
    const { data } = await supabase
      .from("users")
      .select("id, email, name")
      .eq("id", userId)
      .single();
    return data || { id: userId, email: "", name: "Unknown" };
  }

  async inviteCollaborator(
    supabase: SupabaseClient,
    graphId: string,
    userId: string,
    request: InviteCollaboratorRequest
  ): Promise<CollaboratorServiceResult<GraphCollaborator>> {
    const { data: graph, error: graphError } = await supabase
      .from("knowledge_graphs")
      .select("user_id")
      .eq("id", graphId)
      .single();

    if (graphError || !graph) {
      return { success: false, error: "图谱不存在" };
    }

    if (graph.user_id !== userId) {
      return { success: false, error: "只有图谱所有者可以邀请协作者" };
    }

    const { data: targetUser, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("email", request.email)
      .single();

    if (userError || !targetUser) {
      return { success: false, error: "未找到该用户" };
    }

    if (targetUser.id === userId) {
      return { success: false, error: "不能邀请自己" };
    }

    const { data: existing } = await supabase
      .from("graph_collaborators")
      .select("id")
      .eq("graph_id", graphId)
      .eq("user_id", targetUser.id)
      .single();

    if (existing) {
      return { success: false, error: "该用户已是协作者" };
    }

    const { data, error } = await supabase
      .from("graph_collaborators")
      .insert({
        graph_id: graphId,
        user_id: targetUser.id,
        role: request.role,
        invited_by: userId,
      })
      .select()
      .single();

    if (error) {
      logger.error("Invite collaborator error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as GraphCollaborator };
  }

  async updateCollaboratorRole(
    supabase: SupabaseClient,
    graphId: string,
    collaboratorUserId: string,
    userId: string,
    request: UpdateCollaboratorRoleRequest
  ): Promise<CollaboratorServiceResult<GraphCollaborator>> {
    const { data: graph, error: graphError } = await supabase
      .from("knowledge_graphs")
      .select("user_id")
      .eq("id", graphId)
      .single();

    if (graphError || !graph) {
      return { success: false, error: "图谱不存在" };
    }

    if (graph.user_id !== userId) {
      return { success: false, error: "只有图谱所有者可以修改协作者角色" };
    }

    const { data, error } = await supabase
      .from("graph_collaborators")
      .update({ role: request.role, updated_at: new Date().toISOString() })
      .eq("graph_id", graphId)
      .eq("user_id", collaboratorUserId)
      .select()
      .single();

    if (error) {
      logger.error("Update collaborator role error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as GraphCollaborator };
  }

  async removeCollaborator(
    supabase: SupabaseClient,
    graphId: string,
    collaboratorUserId: string,
    userId: string
  ): Promise<CollaboratorServiceResult> {
    const { data: graph, error: graphError } = await supabase
      .from("knowledge_graphs")
      .select("user_id")
      .eq("id", graphId)
      .single();

    if (graphError || !graph) {
      return { success: false, error: "图谱不存在" };
    }

    if (graph.user_id !== userId) {
      return { success: false, error: "只有图谱所有者可以移除协作者" };
    }

    const { error } = await supabase
      .from("graph_collaborators")
      .delete()
      .eq("graph_id", graphId)
      .eq("user_id", collaboratorUserId);

    if (error) {
      logger.error("Remove collaborator error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  async acceptInvitation(
    supabase: SupabaseClient,
    invitationToken: string,
    userId: string
  ): Promise<CollaboratorServiceResult<GraphCollaborator>> {
    const { data: invitation, error: inviteError } = await supabase
      .from("graph_collaborators")
      .select("*")
      .eq("invitation_token", invitationToken)
      .single();

    if (inviteError || !invitation) {
      return { success: false, error: "邀请不存在或已过期" };
    }

    if (invitation.user_id !== userId) {
      return { success: false, error: "此邀请不属于当前用户" };
    }

    if (invitation.invitation_expires_at && new Date(invitation.invitation_expires_at) < new Date()) {
      return { success: false, error: "邀请链接已过期" };
    }

    if (invitation.accepted_at) {
      return { success: false, error: "此邀请已被接受" };
    }

    const { data, error } = await supabase
      .from("graph_collaborators")
      .update({ accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", invitation.id)
      .select()
      .single();

    if (error) {
      logger.error("Accept invitation error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as GraphCollaborator };
  }

  async getPendingInvitations(
    supabase: SupabaseClient,
    userId: string
  ): Promise<CollaboratorServiceResult<(GraphCollaborator & { graph?: { id: string; title: string } })[]>> {
    const { data, error } = await supabase
      .from("graph_collaborators")
      .select(
        `
        *,
        graph:knowledge_graphs (
          id,
          title
        )
      `
      )
      .eq("user_id", userId)
      .is("accepted_at", null);

    if (error) {
      logger.error("Get pending invitations error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as (GraphCollaborator & { graph?: { id: string; title: string } })[] };
  }

  async getUserRole(
    supabase: SupabaseClient,
    graphId: string,
    userId: string
  ): Promise<CollaboratorRole | null> {
    const { data: graph } = await supabase
      .from("knowledge_graphs")
      .select("user_id")
      .eq("id", graphId)
      .single();

    if (graph?.user_id === userId) {
      return "owner";
    }

    const { data: collaborator } = await supabase
      .from("graph_collaborators")
      .select("role")
      .eq("graph_id", graphId)
      .eq("user_id", userId)
      .not("accepted_at", "is", null)
      .single();

    return (collaborator?.role as CollaboratorRole) || null;
  }

  async canEdit(supabase: SupabaseClient, graphId: string, userId: string): Promise<boolean> {
    const role = await this.getUserRole(supabase, graphId, userId);
    return role === "owner" || role === "editor";
  }

  async canManageCollaborators(supabase: SupabaseClient, graphId: string, userId: string): Promise<boolean> {
    const role = await this.getUserRole(supabase, graphId, userId);
    return role === "owner";
  }

  async generateShareLink(
    supabase: SupabaseClient,
    graphId: string,
    userId: string,
    role: CollaboratorRole = "viewer"
  ): Promise<CollaboratorServiceResult<{ invitationToken: string; shareUrl: string }>> {
    const { data: graph, error: graphError } = await supabase
      .from("knowledge_graphs")
      .select("user_id")
      .eq("id", graphId)
      .single();

    if (graphError || !graph) {
      return { success: false, error: "图谱不存在" };
    }

    if (graph.user_id !== userId) {
      const { data: collaborator } = await supabase
        .from("graph_collaborators")
        .select("role")
        .eq("graph_id", graphId)
        .eq("user_id", userId)
        .not("accepted_at", "is", null)
        .single();

      if (!collaborator || collaborator.role !== "owner") {
        return { success: false, error: "只有图谱所有者可以生成分享链接" };
      }
    }

    const invitationToken = crypto.randomUUID();

    const { error } = await supabase
      .from("graph_collaborators")
      .insert({
        graph_id: graphId,
        user_id: null,
        role: role,
        invited_by: userId,
        invitation_token: invitationToken,
        invitation_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: "分享链接已存在，请使用现有链接" };
      }
      logger.error("Generate share link error:", error);
      return { success: false, error: error.message };
    }

    const shareUrl = `/collaboration/${invitationToken}`;

    await this.cleanupExpiredInvitations(supabase);

    return {
      success: true,
      data: {
        invitationToken,
        shareUrl,
      },
    };
  }

  async joinByShareLink(
    supabase: SupabaseClient,
    invitationToken: string,
    userId: string
  ): Promise<CollaboratorServiceResult<GraphCollaborator>> {
    const { data: invitation, error: inviteError } = await supabase
      .from("graph_collaborators")
      .select("*")
      .eq("invitation_token", invitationToken)
      .is("user_id", null)
      .single();

    if (inviteError || !invitation) {
      return { success: false, error: "分享链接无效或已过期" };
    }

    if (invitation.invitation_expires_at && new Date(invitation.invitation_expires_at) < new Date()) {
      return { success: false, error: "分享链接已过期" };
    }

    const { data: existing } = await supabase
      .from("graph_collaborators")
      .select("id")
      .eq("graph_id", invitation.graph_id)
      .eq("user_id", userId)
      .single();

    if (existing) {
      return { success: false, error: "您已是此图谱的协作者" };
    }

    const { data, error } = await supabase
      .from("graph_collaborators")
      .update({
        user_id: userId,
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitation.id)
      .select()
      .single();

    if (error) {
      logger.error("Join by share link error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as GraphCollaborator };
  }

  async cleanupExpiredInvitations(supabase: SupabaseClient): Promise<void> {
    await supabase
      .from("graph_collaborators")
      .delete()
      .is("user_id", null)
      .is("accepted_at", null)
      .not("invitation_expires_at", "is", null)
      .lt("invitation_expires_at", new Date().toISOString());
  }

  async getInvitationInfo(
    supabase: SupabaseClient,
    invitationToken: string
  ): Promise<CollaboratorServiceResult<{ graphId: string; graphTitle: string; role: CollaboratorRole }>> {
    const { data: invitation, error } = await supabase
      .from("graph_collaborators")
      .select(
        `
        graph_id,
        role,
        graph:knowledge_graphs (
          title
        )
      `
      )
      .eq("invitation_token", invitationToken)
      .single();

    if (error || !invitation) {
      return { success: false, error: "邀请不存在或已过期" };
    }

    if (invitation.invitation_expires_at && new Date(invitation.invitation_expires_at) < new Date()) {
      return { success: false, error: "邀请链接已过期" };
    }

    return {
      success: true,
      data: {
        graphId: invitation.graph_id,
        graphTitle: (invitation.graph as unknown as { title?: string })?.title || "未知图谱",
        role: invitation.role as CollaboratorRole,
      },
    };
  }
}

export const collaboratorService = new CollaboratorService();

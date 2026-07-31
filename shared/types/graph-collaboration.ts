// 协作相关类型
// GraphCollaborator, CollaboratorWithUser, GraphWithCollaborators 等

import type { CollaboratorRole } from "./graph-core";
import type { Graph } from "./graph-entity";

export interface GraphCollaborator {
  id: string;
  graph_id: string;
  user_id: string;
  role: CollaboratorRole;
  invited_by?: string;
  invitation_token: string;
  invited_at: string;
  accepted_at?: string;
  invitation_expires_at?: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
}

export interface InviteCollaboratorRequest {
  email: string;
  role: CollaboratorRole;
}

export interface UpdateCollaboratorRoleRequest {
  role: CollaboratorRole;
}

export interface CollaboratorWithUser extends GraphCollaborator {
  user: {
    id: string;
    email: string;
    name?: string;
  };
}

export interface GraphWithCollaborators extends Graph {
  collaborators?: CollaboratorWithUser[];
  user_role?: CollaboratorRole;
}

export type CollaboratorRoleLabelKey =
  | "collaborators.roleLabels.owner"
  | "collaborators.roleLabels.editor"
  | "collaborators.roleLabels.viewer";

export const COLLABORATOR_ROLE_LABELS: Record<
  CollaboratorRole,
  CollaboratorRoleLabelKey
> = {
  owner: "collaborators.roleLabels.owner",
  editor: "collaborators.roleLabels.editor",
  viewer: "collaborators.roleLabels.viewer",
};

export const COLLABORATOR_ROLE_COLORS: Record<CollaboratorRole, string> = {
  owner: "#EF4444",
  editor: "#3B82F6",
  viewer: "#6B7280",
};

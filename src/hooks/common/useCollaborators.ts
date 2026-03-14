import { useState, useCallback } from "react";
import type {
  CollaboratorRole,
  CollaboratorWithUser,
} from "@shared/types";

interface UseCollaboratorsResult {
  collaborators: CollaboratorWithUser[];
  loading: boolean;
  error: string | null;
  fetchCollaborators: (graphId: string) => Promise<void>;
  inviteCollaborator: (graphId: string, email: string, role: CollaboratorRole) => Promise<boolean>;
  updateRole: (graphId: string, userId: string, role: CollaboratorRole) => Promise<boolean>;
  removeCollaborator: (graphId: string, userId: string) => Promise<boolean>;
  generateShareLink: (graphId: string, role?: CollaboratorRole) => Promise<{ invitationToken: string; shareUrl: string } | null>;
}

export function useCollaborators(): UseCollaboratorsResult {
  const [collaborators, setCollaborators] = useState<CollaboratorWithUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCollaborators = useCallback(async (graphId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/collaborations/graphs/${graphId}/collaborators`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("获取协作者列表失败");
      }
      const data = await response.json();
      setCollaborators(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取协作者列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const inviteCollaborator = useCallback(async (graphId: string, email: string, role: CollaboratorRole): Promise<boolean> => {
    setError(null);
    try {
      const response = await fetch(`/api/collaborations/graphs/${graphId}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, role }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "邀请失败");
      }
      await fetchCollaborators(graphId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "邀请失败");
      return false;
    }
  }, [fetchCollaborators]);

  const updateRole = useCallback(async (graphId: string, userId: string, role: CollaboratorRole): Promise<boolean> => {
    setError(null);
    try {
      const response = await fetch(`/api/collaborations/graphs/${graphId}/collaborators/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "更新角色失败");
      }
      await fetchCollaborators(graphId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新角色失败");
      return false;
    }
  }, [fetchCollaborators]);

  const removeCollaborator = useCallback(async (graphId: string, userId: string): Promise<boolean> => {
    setError(null);
    try {
      const response = await fetch(`/api/collaborations/graphs/${graphId}/collaborators/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "移除失败");
      }
      await fetchCollaborators(graphId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "移除失败");
      return false;
    }
  }, [fetchCollaborators]);

  const generateShareLink = useCallback(async (graphId: string, role: CollaboratorRole = "viewer") => {
    setError(null);
    try {
      const response = await fetch(`/api/collaborations/graphs/${graphId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "生成分享链接失败");
      }
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成分享链接失败");
      return null;
    }
  }, []);

  return {
    collaborators,
    loading,
    error,
    fetchCollaborators,
    inviteCollaborator,
    updateRole,
    removeCollaborator,
    generateShareLink,
  };
}

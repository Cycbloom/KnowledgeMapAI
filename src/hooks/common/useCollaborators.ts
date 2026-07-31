import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type {
  CollaboratorRole,
  CollaboratorWithUser,
} from "@shared/types";
import { apiClient } from "../../services/api/createApiClient";

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
  const { t } = useTranslation();
  const [collaborators, setCollaborators] = useState<CollaboratorWithUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCollaborators = useCallback(async (graphId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get(`/collaborations/graphs/${graphId}/collaborators`);
      setCollaborators(data as unknown as CollaboratorWithUser[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("collaborators.errors.fetchFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const inviteCollaborator = useCallback(async (graphId: string, email: string, role: CollaboratorRole): Promise<boolean> => {
    setError(null);
    try {
      await apiClient.post(`/collaborations/graphs/${graphId}/collaborators`, { email, role });
      await fetchCollaborators(graphId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("collaborators.errors.inviteFailed"));
      return false;
    }
  }, [fetchCollaborators, t]);

  const updateRole = useCallback(async (graphId: string, userId: string, role: CollaboratorRole): Promise<boolean> => {
    setError(null);
    try {
      await apiClient.patch(`/collaborations/graphs/${graphId}/collaborators/${userId}`, { role });
      await fetchCollaborators(graphId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("collaborators.errors.updateRoleFailed"));
      return false;
    }
  }, [fetchCollaborators, t]);

  const removeCollaborator = useCallback(async (graphId: string, userId: string): Promise<boolean> => {
    setError(null);
    try {
      await apiClient.delete(`/collaborations/graphs/${graphId}/collaborators/${userId}`);
      await fetchCollaborators(graphId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("collaborators.errors.removeFailed"));
      return false;
    }
  }, [fetchCollaborators, t]);

  const generateShareLink = useCallback(async (graphId: string, role: CollaboratorRole = "viewer") => {
    setError(null);
    try {
      const data = await apiClient.post(`/collaborations/graphs/${graphId}/share`, { role });
      return data as unknown as { invitationToken: string; shareUrl: string };
    } catch (err) {
      setError(err instanceof Error ? err.message : t("collaborators.errors.generateShareLinkFailed"));
      return null;
    }
  }, [t]);

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

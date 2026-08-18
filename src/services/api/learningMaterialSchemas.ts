import { request } from "./client";
import type {
  LearningMaterialSchema,
  LearningMaterialSchemaCreate,
  LearningMaterialSchemaUpdate,
} from "@shared/types";

export interface ILearningMaterialSchemasApi {
  list(graphId?: string): Promise<LearningMaterialSchema[]>;
  get(id: string): Promise<LearningMaterialSchema>;
  create(
    data: Omit<LearningMaterialSchemaCreate, "user_id">,
  ): Promise<LearningMaterialSchema>;
  update(
    id: string,
    data: LearningMaterialSchemaUpdate,
  ): Promise<LearningMaterialSchema>;
  delete(id: string): Promise<{ success: boolean }>;
}

export const learningMaterialSchemasApi: ILearningMaterialSchemasApi = {
  list: (graphId) =>
    request(
      `/learning-material-schemas${graphId ? `?graph_id=${encodeURIComponent(graphId)}` : ""}`,
    ),

  get: (id) => request(`/learning-material-schemas/${encodeURIComponent(id)}`),

  create: (data) =>
    request("/learning-material-schemas", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id, data) =>
    request(`/learning-material-schemas/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id) =>
    request(`/learning-material-schemas/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
};

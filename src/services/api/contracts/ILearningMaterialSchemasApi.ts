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

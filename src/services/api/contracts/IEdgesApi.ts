import type { Edge } from '@shared/types';
import type { CreateEdgeData } from '@shared/types/api';

export interface IEdgesApi {
  create(data: CreateEdgeData): Promise<Edge>;

  delete(id: string): Promise<void>;
}
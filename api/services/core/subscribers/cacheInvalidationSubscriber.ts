import { appEventBus } from "../eventBus";
import { cacheService, CacheKeys } from "../../common/cacheService";
import { logger } from "../../../utils/logger";
import type {
  AppEvent,
  AppEventHandler,
  GraphCreatedPayload,
  GraphUpdatedPayload,
  GraphDeletedPayload,
  NodeCreatedPayload,
  NodeUpdatedPayload,
  NodeDeletedPayload,
  EdgeCreatedPayload,
  EdgeDeletedPayload,
  AITaskCompletedPayload,
  AITaskFailedPayload,
  CacheInvalidationNeededPayload,
} from "@shared/types/events";

class CacheInvalidationSubscriber {
  private handlers: Map<string, AppEventHandler> = new Map();

  private handleGraphCreated = async (event: AppEvent): Promise<void> => {
    const payload = event.payload as GraphCreatedPayload;
    const keys = [CacheKeys.USER_GRAPHS(payload.userId)];
    await cacheService.del(keys);
    logger.debug(`[CacheInvalidation] graph_created: invalidated ${keys.length} keys for user ${payload.userId}`);
  };

  private handleGraphUpdated = async (event: AppEvent): Promise<void> => {
    const payload = event.payload as GraphUpdatedPayload;
    const keys = [
      CacheKeys.USER_GRAPHS(payload.userId),
      CacheKeys.GRAPH(payload.graphId),
      CacheKeys.GRAPH_NODES(payload.userId, payload.graphId),
    ];
    await cacheService.del(keys);
    logger.debug(`[CacheInvalidation] graph_updated: invalidated ${keys.length} keys for graph ${payload.graphId}`);
  };

  private handleGraphDeleted = async (event: AppEvent): Promise<void> => {
    const payload = event.payload as GraphDeletedPayload;
    const keys = [
      CacheKeys.USER_GRAPHS(payload.userId),
      CacheKeys.GRAPH(payload.graphId),
      CacheKeys.GRAPH_NODES(payload.userId, payload.graphId),
      CacheKeys.STUDY_CARDS(payload.graphId),
      CacheKeys.LEARNING_PATH(payload.graphId),
    ];
    await cacheService.del(keys);
    logger.debug(`[CacheInvalidation] graph_deleted: invalidated ${keys.length} keys for graph ${payload.graphId}`);
  };

  private handleNodeCreated = async (event: AppEvent): Promise<void> => {
    const payload = event.payload as NodeCreatedPayload;
    const keys = [CacheKeys.GRAPH_NODES(payload.userId, payload.graphId)];
    await cacheService.del(keys);
    logger.debug(`[CacheInvalidation] node_created: invalidated ${keys.length} keys for graph ${payload.graphId}`);
  };

  private handleNodeUpdated = async (event: AppEvent): Promise<void> => {
    const payload = event.payload as NodeUpdatedPayload;
    const keys = [
      CacheKeys.GRAPH_NODES(payload.userId, payload.graphId),
      CacheKeys.KNOWLEDGE_POINT(payload.nodeId),
    ];
    await cacheService.del(keys);
    logger.debug(`[CacheInvalidation] node_updated: invalidated ${keys.length} keys for node ${payload.nodeId}`);
  };

  private handleNodeDeleted = async (event: AppEvent): Promise<void> => {
    const payload = event.payload as NodeDeletedPayload;
    const keys = [
      CacheKeys.GRAPH_NODES(payload.userId, payload.graphId),
      CacheKeys.KNOWLEDGE_POINT(payload.nodeId),
    ];
    await cacheService.del(keys);
    logger.debug(`[CacheInvalidation] node_deleted: invalidated ${keys.length} keys for node ${payload.nodeId}`);
  };

  private handleEdgeCreated = async (event: AppEvent): Promise<void> => {
    const payload = event.payload as EdgeCreatedPayload;
    const keys = [CacheKeys.GRAPH_NODES(payload.userId, payload.graphId)];
    await cacheService.del(keys);
    logger.debug(`[CacheInvalidation] edge_created: invalidated ${keys.length} keys for graph ${payload.graphId}`);
  };

  private handleEdgeDeleted = async (event: AppEvent): Promise<void> => {
    const payload = event.payload as EdgeDeletedPayload;
    const keys = [CacheKeys.GRAPH_NODES(payload.userId, payload.graphId)];
    await cacheService.del(keys);
    logger.debug(`[CacheInvalidation] edge_deleted: invalidated ${keys.length} keys for graph ${payload.graphId}`);
  };

  private handleAITaskCompleted = async (event: AppEvent): Promise<void> => {
    const payload = event.payload as AITaskCompletedPayload;
    if (!payload.graphId) return;

    const keys = [
      CacheKeys.GRAPH_NODES(payload.userId, payload.graphId),
      CacheKeys.GRAPH(payload.graphId),
    ];

    if (payload.taskType === "generate_questions") {
      keys.push(CacheKeys.STUDY_CARDS(payload.graphId));
    }

    if (payload.taskType === "expand_graph") {
      keys.push(CacheKeys.LEARNING_PATH(payload.graphId));
    }

    await cacheService.del(keys);
    logger.debug(`[CacheInvalidation] ai_task_completed: invalidated ${keys.length} keys for task ${payload.taskId}`);
  };

  private handleAITaskFailed = async (event: AppEvent): Promise<void> => {
    const payload = event.payload as AITaskFailedPayload;
    if (!payload.graphId) return;

    const keys = [CacheKeys.GRAPH_NODES(payload.userId, payload.graphId)];
    await cacheService.del(keys);
    logger.debug(`[CacheInvalidation] ai_task_failed: invalidated ${keys.length} keys for task ${payload.taskId}`);
  };

  private handleCacheInvalidationNeeded = async (event: AppEvent): Promise<void> => {
    const payload = event.payload as CacheInvalidationNeededPayload;

    if (payload.keys.length > 0) {
      await cacheService.del(payload.keys);
    }

    if (payload.tags && payload.tags.length > 0) {
      await cacheService.delByTags(payload.tags);
    }

    logger.debug(
      `[CacheInvalidation] cache_invalidation_needed: invalidated ${payload.keys.length} keys, ${payload.tags?.length ?? 0} tags`,
    );
  };

  initialize(): void {
    const subscriptions: Array<[string, AppEventHandler]> = [
      ["graph_created", this.handleGraphCreated],
      ["graph_updated", this.handleGraphUpdated],
      ["graph_deleted", this.handleGraphDeleted],
      ["node_created", this.handleNodeCreated],
      ["node_updated", this.handleNodeUpdated],
      ["node_deleted", this.handleNodeDeleted],
      ["edge_created", this.handleEdgeCreated],
      ["edge_deleted", this.handleEdgeDeleted],
      ["ai_task_completed", this.handleAITaskCompleted],
      ["ai_task_failed", this.handleAITaskFailed],
      ["cache_invalidation_needed", this.handleCacheInvalidationNeeded],
    ];

    for (const [eventType, handler] of subscriptions) {
      appEventBus.subscribe(eventType as never, handler);
      this.handlers.set(eventType, handler);
    }

    logger.info(`[CacheInvalidationSubscriber] Initialized with ${subscriptions.length} subscriptions`);
  }

  destroy(): void {
    for (const [eventType, handler] of this.handlers) {
      appEventBus.unsubscribe(eventType as never, handler);
    }
    this.handlers.clear();
    logger.info("[CacheInvalidationSubscriber] Destroyed all subscriptions");
  }
}

export const cacheInvalidationSubscriber = new CacheInvalidationSubscriber();

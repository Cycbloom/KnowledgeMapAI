import { type RequestHandler, type Response, type NextFunction } from "express";
import { AuthRequest } from "./auth";
import { AppError } from "./errorHandler";
import { ErrorCodes } from "../../shared/types/errorCodes";

/**
 * 所有权校验列名。
 *
 * 大多数资源表使用 `user_id` 作为所有者外键；`knowledge_points` 历史性地
 * 使用 `owner_id`，因此通过参数显式指定。
 */
type OwnerColumn = "user_id" | "owner_id";

/**
 * 构建所有权校验中间件的高阶函数。
 *
 * 必须在 `requireAuth` 之后挂载，依赖 `req.user` 与 `req.supabase`（用户级 client，
 * 受 RLS 保护）。查询指定表中 `ownerColumn`（默认 `user_id`）字段并比对当前认证用户：
 *
 * - 参数 `:id` 缺失 → 400 VALIDATION_ERROR
 * - 资源不存在或查询失败 → 404 RESOURCE_NOT_FOUND（统一返回，避免泄露资源存在性）
 * - 资源存在但所有者不匹配 → 403 AUTH_FORBIDDEN
 */
export function buildOwnershipMiddleware(
  table: string,
  ownerColumn: OwnerColumn = "user_id",
): RequestHandler {
  return async (
    req: AuthRequest,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const id = req.params.id;

    if (!id) {
      throw new AppError("缺少资源ID", 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { data, error } = await req.supabase
      .from(table)
      .select(ownerColumn)
      .eq("id", id)
      .single();

    if (error || !data) {
      // 资源不存在或查询失败统一返回 404，避免泄露资源存在性
      throw new AppError("资源不存在", 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const ownerId = (data as Record<string, unknown>)[ownerColumn] as
      | string
      | null
      | undefined;

    if (!ownerId || ownerId !== req.user.id) {
      throw new AppError("没有权限执行此操作", 403, ErrorCodes.AUTH_FORBIDDEN);
    }

    next();
  };
}

/**
 * 校验当前用户拥有指定的知识点。
 *
 * 注意：`knowledge_points` 表使用 `owner_id` 列（而非 `user_id`）。
 */
export const requireKnowledgePointOwnership = buildOwnershipMiddleware(
  "knowledge_points",
  "owner_id",
);

/** 校验当前用户拥有指定的图谱（knowledge_graphs.user_id）。 */
export const requireGraphOwnership = buildOwnershipMiddleware("knowledge_graphs");

/**
 * 校验当前用户拥有指定的异步任务。
 *
 * 注意：`api/routes/tasks.ts` 通过 `asyncTaskService` 操作 `system_tasks` 表
 * （而非 `user_tasks`），故此处查询 `system_tasks.user_id`。
 */
export const requireTaskOwnership = buildOwnershipMiddleware("system_tasks");

/** 校验当前用户拥有指定的测验集合（quiz_sets.user_id）。 */
export const requireQuizSetOwnership = buildOwnershipMiddleware("quiz_sets");

/**
 * 校验当前用户拥有指定的图谱模板。
 *
 * 注意：`api/routes/templates.ts` 通过 `graphTemplateService` 操作 `templates` 表
 * （而非 `task_templates`），故此处查询 `templates.user_id`。
 */
export const requireTemplateOwnership = buildOwnershipMiddleware("templates");

import { type Response, type NextFunction } from "express";
import { AuthRequest } from "./auth";
import { AppError } from "./errorHandler";
import { ErrorCodes } from "../../shared/types/errorCodes";
import { knowledgePointService } from "../services/graph/index";

export async function requireKnowledgePointOwnership(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const id = req.params.id;

  if (!id) {
    throw new AppError("缺少资源ID", 400, ErrorCodes.VALIDATION_ERROR);
  }

  const isOwner = await knowledgePointService.checkOwnership(
    req.supabase!,
    id,
    req.user.id,
  );

  if (!isOwner) {
    throw new AppError("没有权限执行此操作", 403, ErrorCodes.AUTH_FORBIDDEN);
  }

  next();
}

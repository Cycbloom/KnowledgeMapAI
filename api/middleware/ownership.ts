import { type Response, type NextFunction } from "express";
import { AuthRequest } from "./auth";
import { AppError } from "./errorHandler";
import { ErrorCodes } from "../../shared/types/errorCodes";
import { knowledgePointService } from "../services/graph/index";
import { authService } from "../services/core";

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
    throw new AppError("没有权限执行此操作", 403, ErrorCodes.FORBIDDEN);
  }

  next();
}

export async function requireAdmin(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const userProfile = await authService.getProfile(req.user.id);

  if (!userProfile || userProfile.role !== "admin") {
    throw new AppError("需要管理员权限", 403, ErrorCodes.FORBIDDEN);
  }

  next();
}

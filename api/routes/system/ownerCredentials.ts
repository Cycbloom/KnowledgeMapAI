import { Router } from "express";
import { promises as fs } from "node:fs";
import path from "node:path";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

/**
 * 开发期专属：把当前 owner 凭证同步到仓库根目录的 `.dev-owner-credentials.json`。
 *
 * 应用为单用户自动登录，数据库每次重置后会自动生成一个新的 `owner-<uuid>@local.app`
 * 账号并把凭证存进浏览器 localStorage。此端点让前端在「自动创建新 owner」时把这份
 * 凭证落到磁盘，供 AI/Playwright 调试脚本读取，用同一个账号登录看到真实数据。
 *
 * 安全约束：仅非生产环境可用（生产直接 403），且仅当 owner 已登录携带凭证时才会调用。
 */
const router = Router();

router.post("/", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    throw new AppError(
      "owner-credentials sync is disabled in production",
      403,
      ErrorCodes.AUTH_FORBIDDEN,
    );
  }

  const { email, password } = (req.body ?? {}) as {
    email?: string;
    password?: string;
  };

  if (
    typeof email !== "string" ||
    email.length === 0 ||
    typeof password !== "string" ||
    password.length === 0
  ) {
    throw new AppError(
      "email and password are required",
      400,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  const file = path.join(process.cwd(), ".dev-owner-credentials.json");
  await fs.writeFile(
    file,
    JSON.stringify({ email, password }, null, 2),
    "utf8",
  );

  res.json({ success: true });
});

export default router;
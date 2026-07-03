import { Router, type Response } from "express";
import { z } from "zod";
import path from "node:path";
import fs from "node:fs";
import multer from "multer";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  uuidParamsSchema,
  createNoteSchema,
  updateNoteSchema,
  noteListQuerySchema,
  createNoteTemplateSchema,
  updateNoteTemplateSchema,
  createNodesFromConceptsSchema,
} from "../schemas/index";
import { notesService } from "../services/notes";
import { rateLimiters } from "../middleware/rateLimiter";
import { AppError } from "../middleware/errorHandler";
import { ErrorCodes } from "../../shared/types/errorCodes";
import { logger } from "../utils/logger";

const nodeIdParamsSchema = z.object({
  nodeId: z.string().uuid("无效的节点ID"),
});

const router = Router();

// ============================================================
// 图片上传:multer diskStorage,保存到 public/uploads/notes/
// 静态 URL 路径:/uploads/notes/{filename}(由 app.ts 中的 express.static 提供)
// ============================================================

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "notes");
const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

const imageFileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
    return cb(
      new Error(
        `不支持的图片类型: ${file.mimetype}. 仅支持 jpeg/png/gif/webp`,
      ),
    );
  }
  cb(null, true);
};

const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    // 确保目录存在(递归创建),失败时把错误传给 multer
    try {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      cb(null, UPLOAD_DIR);
    } catch (err) {
      cb(err instanceof Error ? err : new Error(String(err)), "");
    }
  },
  filename: (req, file, cb) => {
    // 文件名:{noteId}-{timestamp}{扩展名}
    const noteId = req.params?.id ?? "note";
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    const filename = `${noteId}-${Date.now()}${ext}`;
    cb(null, filename);
  },
});

const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter: imageFileFilter,
});

/**
 * GET /notes
 * 列表查询,支持 type/date/tag/isArchived/isPinned/nodeId/search/includeDeleted/page/pageSize 过滤。
 *
 * 注意:必须定义在 /:id 之前,否则 "templates"/"by-node" 等会被当作 id 路径参数。
 */
router.get(
  "/",
  requireAuth,
  validate({ query: noteListQuerySchema }),
  async (req: AuthedRequest, res: Response) => {
    const q = req.query as unknown as {
      type?: "note" | "daily";
      date?: string;
      tag?: string;
      isArchived?: boolean;
      isPinned?: boolean;
      nodeId?: string;
      search?: string;
      includeDeleted?: boolean;
      page?: number;
      pageSize?: number;
    };

    const data = await notesService.list(req.supabase, req.user.id, {
      filters: {
        type: q.type,
        date: q.date,
        tag: q.tag,
        isArchived: q.isArchived,
        isPinned: q.isPinned,
        nodeId: q.nodeId,
        search: q.search,
        includeDeleted: q.includeDeleted,
      },
      page: q.page,
      pageSize: q.pageSize,
    });
    res.json(data);
  },
);

// ============================================================
// 模板 CRUD (P1)
// 路由顺序:templates 及其子路径均为静态路径,定义在 /:id 之前。
// 限流:继承 /api/notes 整体的 general 限流(P0 已在 NotesPlugin 中应用)。
// ============================================================

/**
 * GET /notes/templates
 * 查询用户可见模板(own OR is_system)。
 */
router.get(
  "/templates",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const data = await notesService.listTemplates(req.supabase, req.user.id);
    res.json(data);
  },
);

/**
 * POST /notes/templates
 * 创建自定义模板。user_id=当前用户,is_system=false。
 */
router.post(
  "/templates",
  requireAuth,
  validate({ body: createNoteTemplateSchema }),
  async (req: AuthedRequest, res: Response) => {
    const data = await notesService.createTemplate(
      req.supabase,
      req.user.id,
      req.body,
    );
    res.status(201).json(data);
  },
);

/**
 * PUT /notes/templates/:id
 * 更新自定义模板。校验 ownership + is_system=false 才能改(否则返回 403)。
 */
router.put(
  "/templates/:id",
  requireAuth,
  validate({ params: uuidParamsSchema, body: updateNoteTemplateSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const data = await notesService.updateTemplate(
      req.supabase,
      req.user.id,
      id,
      req.body,
    );
    res.json(data);
  },
);

/**
 * DELETE /notes/templates/:id
 * 删除自定义模板。校验 ownership + is_system=false 才能删(否则返回 403)。
 */
router.delete(
  "/templates/:id",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    await notesService.deleteTemplate(req.supabase, req.user.id, id);
    res.json({ success: true, message: "模板已删除" });
  },
);

/**
 * POST /notes/templates/:id/set-default
 * 设为默认模板。事务:取消同用户其他默认 + 设置当前为默认。
 */
router.post(
  "/templates/:id/set-default",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const data = await notesService.setDefaultTemplate(
      req.supabase,
      req.user.id,
      id,
    );
    res.json(data);
  },
);

/**
 * GET /notes/by-node/:nodeId
 * 按节点查关联笔记(用于节点详情侧边栏"关联笔记"区块)。
 */
router.get(
  "/by-node/:nodeId",
  requireAuth,
  validate({ params: nodeIdParamsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { nodeId } = req.params;
    const data = await notesService.getNotesByNodeId(
      req.supabase,
      req.user.id,
      nodeId,
    );
    res.json({ items: data, total: data.length });
  },
);

/**
 * GET /notes/today-daily
 * 获取或创建今日 Daily Note(若不存在则按模板自动创建)。
 */
router.get(
  "/today-daily",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const data = await notesService.getOrCreateTodayDaily(
      req.supabase,
      req.user.id,
    );
    res.status(data.created ? 201 : 200).json(data.note);
  },
);

/**
 * GET /notes/:id
 * 查询单个笔记。跨用户(由 RLS 拦截)返回 NOT_FOUND。
 */
router.get(
  "/:id",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const data = await notesService.get(req.supabase, req.user.id, id);
    res.json(data);
  },
);

/**
 * POST /notes
 * 创建笔记。daily 类型重复创建返回 409(由 service 转换)。
 */
router.post(
  "/",
  requireAuth,
  validate({ body: createNoteSchema }),
  async (req: AuthedRequest, res: Response) => {
    const data = await notesService.create(req.supabase, req.user.id, req.body);
    res.status(201).json(data);
  },
);

/**
 * PUT /notes/:id
 * 更新笔记。保存时同步 note_node_links(content 变更时)。
 */
router.put(
  "/:id",
  requireAuth,
  validate({ params: uuidParamsSchema, body: updateNoteSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const data = await notesService.update(
      req.supabase,
      req.user.id,
      id,
      req.body,
    );
    res.json(data);
  },
);

/**
 * DELETE /notes/:id
 * 软删除笔记 + 显式清理 note_node_links。
 */
router.delete(
  "/:id",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    await notesService.delete(req.supabase, req.user.id, id);
    res.json({ success: true, message: "笔记已删除" });
  },
);

/**
 * POST /notes/:id/restore
 * 恢复软删除的笔记(挂载关系不自动恢复,需在前端提示)。
 */
router.post(
  "/:id/restore",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const data = await notesService.restore(req.supabase, req.user.id, id);
    res.json({
      ...data,
      linksRestored: false,
      message: "笔记已恢复,但挂载关系不自动恢复,请重新编辑笔记以重建链接",
    });
  },
);

// ============================================================
// P1 AI 端点 (限流:aiHeavy)
// ============================================================

/**
 * POST /notes/:id/summary
 * 生成今日学习总结。调用 notesService.generateDailySummary,
 * 返回 GenerateDailySummaryResponse { summary, tokensUsed? }。
 *
 * 限流:aiHeavy(1 小时 1000 次,见 rateLimiter.ts)。
 */
router.post(
  "/:id/summary",
  requireAuth,
  rateLimiters.aiHeavy,
  validate({ params: uuidParamsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const data = await notesService.generateDailySummary(
      req.supabase,
      req.user.id,
      id,
    );
    res.json(data);
  },
);

/**
 * POST /notes/:id/extract-concepts
 * 从笔记正文提取候选知识点。调用 notesService.extractConcepts,
 * 返回 ExtractConceptsResponse { concepts: NoteExtractedConcept[] }。
 *
 * 限流:aiHeavy。
 */
router.post(
  "/:id/extract-concepts",
  requireAuth,
  rateLimiters.aiHeavy,
  validate({ params: uuidParamsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const data = await notesService.extractConcepts(
      req.supabase,
      req.user.id,
      id,
    );
    res.json(data);
  },
);

/**
 * POST /notes/:id/create-nodes
 * 反向建图:根据用户确认的知识点列表,在目标图谱创建节点并挂载到本笔记。
 * Body: CreateNodesFromConceptsRequest { graphId, selectedConcepts[] }
 *
 * 限流:aiHeavy(虽然本端点不再调用 AI,但属于 AI 流程的最终落盘步骤,
 * 与 extract-concepts 配对使用,沿用同一限流桶)。
 */
router.post(
  "/:id/create-nodes",
  requireAuth,
  rateLimiters.aiHeavy,
  validate({ params: uuidParamsSchema, body: createNodesFromConceptsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const data = await notesService.createNodesFromConcepts(
      req.supabase,
      req.user.id,
      id,
      req.body,
    );
    res.json(data);
  },
);

// ============================================================
// P1 图片上传 (限流:write)
// ============================================================

/**
 * POST /notes/:id/upload-image
 * multipart 文件上传。返回 UploadImageResponse { url, filename?, size? }。
 *
 * - 仅图片类型(jpeg/png/gif/webp),大小限制 5MB
 * - 存储位置:本地 public/uploads/notes/{noteId}-{timestamp}{ext}
 * - 静态 URL:/uploads/notes/{filename}(由 app.ts 中的 express.static 提供)
 *
 * 限流:write(1 分钟 30 次)。
 *
 * multer 错误处理:文件过大或类型不匹配时 multer 抛出 MulterError,
 * 由 errorHandler 中间件统一处理。这里捕获文件不存在场景(NO_FILE_UPLOADED)。
 */
router.post(
  "/:id/upload-image",
  requireAuth,
  rateLimiters.write,
  validate({ params: uuidParamsSchema }),
  imageUpload.single("file"),
  async (req: AuthedRequest, res: Response) => {
    const file = req.file;
    if (!file) {
      throw new AppError(ErrorCodes.NO_FILE_UPLOADED);
    }

    // 二次校验大小(multer limits 已拦截,这里防御性兜底)
    if (file.size > MAX_IMAGE_SIZE) {
      // 删除已落盘的文件(避免脏数据残留)
      try {
        fs.unlinkSync(file.path);
      } catch (err) {
        logger.warn("upload-image: cleanup oversized file failed", {
          path: file.path,
          error: err,
        });
      }
      throw new AppError(ErrorCodes.FILE_TOO_LARGE);
    }

    // 二次校验 MIME 类型(防御性)
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
      try {
        fs.unlinkSync(file.path);
      } catch (err) {
        logger.warn("upload-image: cleanup invalid type file failed", {
          path: file.path,
          error: err,
        });
      }
      throw new AppError(ErrorCodes.FILE_INVALID_TYPE);
    }

    const url = `/uploads/notes/${file.filename}`;
    res.status(201).json({
      url,
      filename: file.filename,
      size: file.size,
    });
  },
);

export default router;

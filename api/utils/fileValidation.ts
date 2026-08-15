import multer from "multer";
import path from "node:path";

/**
 * 允许的 MIME 类型列表
 * - 图片：jpeg、png、gif、webp、svg+xml
 * - 文档：PDF、Markdown、纯文本、CSV
 * - JSON
 */
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "text/markdown",
  "text/plain",
  "text/csv",
  "application/json",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/**
 * 允许的文件扩展名列表（与 ALLOWED_MIME_TYPES 对应）
 */
export const ALLOWED_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".svg",
  ".pdf",
  ".md",
  ".txt",
  ".csv",
  ".json",
] as const;

export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

// 预构建模块级 Set，替代 validateFile 内 ALLOWED_* 数组 includes 的 O(n) 线性扫描
const ALLOWED_MIME_TYPE_SET = new Set<string>(ALLOWED_MIME_TYPES);
const ALLOWED_EXTENSION_SET = new Set<string>(ALLOWED_EXTENSIONS);

/**
 * 最大文件大小：10MB
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * 验证文件类型和大小
 *
 * 同时检查 MIME 类型和文件扩展名，返回中文错误信息。
 * 可在 multer fileFilter 中使用，也可在路由处理函数中做二次校验。
 *
 * @param mimetype - 文件的 MIME 类型
 * @param size - 文件大小（字节）
 * @param filename - 文件名（可选，用于扩展名校验），传空则跳过扩展名检查
 * @returns 验证结果
 */
export function validateFile(
  mimetype: string,
  size: number,
  filename?: string,
): { valid: boolean; error?: string } {
  if (size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `文件大小超过限制（最大 ${MAX_FILE_SIZE / 1024 / 1024}MB）`,
    };
  }

  if (size <= 0) {
    return {
      valid: false,
      error: "文件内容为空",
    };
  }

  if (!ALLOWED_MIME_TYPE_SET.has(mimetype)) {
    return {
      valid: false,
      error: `不支持的文件类型: ${mimetype}。仅支持图片（jpeg/png/gif/webp/svg）、文档（pdf/md/txt/csv）和 JSON 文件`,
    };
  }

  if (filename) {
    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_EXTENSION_SET.has(ext)) {
      return {
        valid: false,
        error: `不支持的文件扩展名: ${ext}`,
      };
    }
  }

  return { valid: true };
}

/**
 * multer 文件过滤器（基于 validateFile）
 */
const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const validation = validateFile(file.mimetype, file.size, file.originalname);
  if (!validation.valid) {
    return cb(new Error(validation.error));
  }
  cb(null, true);
};

/**
 * 通用文件上传配置（multer 选项）
 * 使用内存存储，10MB 限制，自动校验文件类型和扩展名
 */
export const FILE_UPLOAD_CONFIG: multer.Options = {
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter,
};

/**
 * 预配置的 multer 上传中间件（单文件，字段名 "file"）
 * 适用于大多数通用文件上传场景
 */
export const upload = multer(FILE_UPLOAD_CONFIG);
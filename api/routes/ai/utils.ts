import type { Response } from 'express';
import { upload as sharedUpload } from '../../utils/fileValidation';

/**
 * 复用共享文件验证工具中的 multer 上传中间件
 * 限制：10MB、通用文件类型（图片/文档/JSON）
 */
export const upload = sharedUpload;

export const sendStreamChunk = (res: Response, content: string) => {
  res.write(`data: ${JSON.stringify({ content })}\n\n`);
};

export const sendStreamError = (res: Response, message: string, code: string) => {
  res.write(`data: ${JSON.stringify({ error: message, code })}\n\n`);
};

export const sendStreamDone = (res: Response) => {
  res.write('data: [DONE]\n\n');
  res.end();
};

export const setSSEHeaders = (res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
};

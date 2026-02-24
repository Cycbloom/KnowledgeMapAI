import multer from 'multer';

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
];

export const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.md', '.csv', '.png', '.jpg', '.jpeg', '.webp', '.gif'];

const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
  
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype) && !ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`Invalid file type: ${file.mimetype}. Allowed types: PDF, TXT, MD, CSV, PNG, JPG, WEBP, GIF`));
  }
  
  cb(null, true);
};

export const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter
});

export const sendStreamChunk = (res: any, content: string) => {
  res.write(`data: ${JSON.stringify({ content })}\n\n`);
};

export const sendStreamError = (res: any, message: string, code: string) => {
  res.write(`data: ${JSON.stringify({ error: message, code })}\n\n`);
};

export const sendStreamDone = (res: any) => {
  res.write('data: [DONE]\n\n');
  res.end();
};

export const setSSEHeaders = (res: any) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
};

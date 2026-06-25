import { Router, type Response } from 'express';
import multer from 'multer';
import { requireAuth, type AuthRequest } from '../../middleware/auth';
import { ErrorCodes } from '../../../shared/types/errorCodes';
import { AppError } from '../../middleware/errorHandler';
import { getAIProviderForTask, performanceMonitor } from '../../services/ai';
import { logger } from '../../utils/logger';
import type { AIProvider } from '@shared/types';

const router = Router();

const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/webm',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/ogg',
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

router.post('/stt', requireAuth, upload.single('audio'), async (req: AuthRequest, res: Response) => {
  const audioFile = req.file;

  if (!audioFile) {
    throw new AppError('未提供音频文件', 400, ErrorCodes.NO_FILE_UPLOADED);
  }

  if (audioFile.size > MAX_FILE_SIZE) {
    throw new AppError('音频文件过大，最大支持 25MB', 400, ErrorCodes.FILE_TOO_LARGE);
  }

  if (!ALLOWED_AUDIO_TYPES.includes(audioFile.mimetype)) {
    throw new AppError(`不支持的音频格式: ${audioFile.mimetype}`, 400, ErrorCodes.FILE_INVALID_TYPE);
  }

  const language = req.body?.language as string | undefined;
  const format = audioFile.mimetype.split('/')[1] || 'wav';

  const startTime = Date.now();
  let provider: AIProvider | undefined;

  try {
    provider = await getAIProviderForTask('stt');
    if (!provider.hasKey || !provider.transcribeSpeech) {
      throw new AppError(ErrorCodes.STT_PROVIDER_NOT_CONFIGURED);
    }

    const audioBuffer = audioFile.buffer;
    const result = await provider.transcribeSpeech(audioBuffer, { language, format });

    performanceMonitor.recordLog({
      operation: 'stt_transcribe',
      provider: provider.providerType,
      model: 'qwen3-asr-flash',
      inputTokens: audioBuffer.length,
      outputTokens: result.text.length,
      totalTokens: audioBuffer.length + result.text.length,
      estimatedCost: 0,
      duration: Date.now() - startTime,
      success: true,
    });

    res.json(result);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('STT Transcription Error:', error);

    performanceMonitor.recordLog({
      operation: 'stt_transcribe',
      provider: provider?.providerType ?? 'aliyun',
      model: 'qwen3-asr-flash',
      inputTokens: audioFile.buffer.length,
      outputTokens: 0,
      totalTokens: audioFile.buffer.length,
      estimatedCost: 0,
      duration: Date.now() - startTime,
      success: false,
    });

    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(err.message || '语音转文字失败', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.get('/stt/health', requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const provider = await getAIProviderForTask('stt');
    if (provider.hasKey && provider.transcribeSpeech) {
      res.json({
        status: 'healthy',
        model_loaded: true,
        model_name: 'qwen3-asr-flash',
      });
    } else {
      res.json({
        status: 'unhealthy',
        model_loaded: false,
        model_name: 'unknown',
      });
    }
  } catch {
    res.json({
      status: 'unhealthy',
      model_loaded: false,
      model_name: 'unknown',
    });
  }
});

export default router;

import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { ttsSchema, ttsVoicesSchema } from '../../schemas/index';
import { ErrorCodes } from '../../../shared/types/errorCodes';
import { AppError } from '../../middleware/errorHandler';
import { getAIProviderForTask, performanceMonitor } from '../../services/ai';
import { logger } from '../../utils/logger';

const router = Router();

router.get('/tts/voices', requireAuth, validate(ttsVoicesSchema), async (_req: AuthRequest, res: Response) => {
  try {
    const voices = [
      { id: 'Cherry', name: 'Cherry (Female, Chinese)', lang: 'zh' },
      { id: 'Harry', name: 'Harry (Male, Chinese)', lang: 'zh' },
      { id: 'Winnie', name: 'Winnie (Child, Chinese)', lang: 'zh' },
      { id: 'Farrah', name: 'Farrah (Female, English)', lang: 'en' },
      { id: 'David', name: 'David (Male, English)', lang: 'en' }
    ];
    res.json(voices);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('TTS Voices Error:', error);
    throw new AppError(err.message || '获取语音列表失败', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.post('/tts', requireAuth, validate(ttsSchema), async (req: AuthRequest, res: Response) => {
  const { text, voice, speed, output_format } = req.body;
  const startTime = Date.now();
  const provider = await getAIProviderForTask('tts');

  try {
    if (!provider.hasKey || !provider.synthesizeSpeech) {
      throw new AppError(ErrorCodes.TTS_PROVIDER_NOT_CONFIGURED);
    }

    const buffer = await provider.synthesizeSpeech(text, voice, speed, output_format);

    performanceMonitor.recordLog({
      operation: 'tts_synthesize',
      provider: provider.providerType,
      model: 'qwen3-tts-flash',
      inputTokens: text.length,
      outputTokens: buffer.length,
      totalTokens: text.length + buffer.length,
      duration: Date.now() - startTime,
      success: true,
      estimatedCost: 0,
    });

    let contentType = output_format === 'wav' ? 'audio/wav' : 'audio/mpeg';
    let filename = output_format === 'wav' ? 'speech.wav' : 'speech.mp3';

    if (buffer.length > 4 && buffer.subarray(0, 4).toString() === 'RIFF') {
      contentType = 'audio/wav';
      filename = 'speech.wav';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Length', buffer.length);

    return res.send(buffer);
  } catch (error: unknown) {
    performanceMonitor.recordLog({
      operation: 'tts_synthesize',
      provider: provider.providerType,
      model: 'qwen3-tts-flash',
      inputTokens: text.length,
      outputTokens: 0,
      totalTokens: text.length,
      duration: Date.now() - startTime,
      success: false,
      estimatedCost: 0,
    });
    const err = error as Error;
    logger.error('TTS Synthesis Error:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(err.message || '语音合成失败', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.get('/tts/health', requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const provider = await getAIProviderForTask('tts');
    if (provider.hasKey) {
      res.json({ 
        status: 'healthy',
        model_loaded: true,
        model_name: 'aliyun-qwen3-tts'
      });
    } else {
      res.json({ 
        status: 'unhealthy',
        model_loaded: false,
        model_name: 'unknown'
      });
    }
  } catch {
    res.json({ 
      status: 'unhealthy',
      model_loaded: false,
      model_name: 'unknown'
    });
  }
});

export default router;

import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { ttsSchema, ttsVoicesSchema } from '../../schemas/index';
import { ErrorCodes } from '../../../shared/types/errorCodes';
import { AppError } from '../../middleware/errorHandler';
import { getAIProviderForTask } from '../../services/ai/factory';
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
    res.status(500).json({ error: err.message || '获取语音列表失败' });
  }
});

router.post('/tts', requireAuth, validate(ttsSchema), async (req: AuthRequest, res: Response) => {
  const { text, voice, speed, output_format } = req.body;
  
  try {
    const provider = await getAIProviderForTask('tts');
    if (!provider.hasKey || !provider.synthesizeSpeech) {
      throw new AppError('TTS Provider not configured', 503, ErrorCodes.INTERNAL_ERROR);
    }

    const buffer = await provider.synthesizeSpeech(text, voice, speed, output_format);
    
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
    const err = error as Error;
    logger.error('TTS Synthesis Error:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(err.message || '语音合成失败', 500, ErrorCodes.INTERNAL_ERROR);
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

import { Router } from 'express';

import contentRouter from './content';
import chatRouter from './chat';
import documentRouter from './document';
import cardsRouter from './cards';
import ttsRouter from './tts';
import performanceRouter from './performance';
import configRouter from './config';

const router = Router();

router.use(contentRouter);
router.use(chatRouter);
router.use(documentRouter);
router.use(cardsRouter);
router.use(ttsRouter);
router.use('/performance', performanceRouter);
router.use('/config', configRouter);

export default router;

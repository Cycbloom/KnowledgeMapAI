import { Router } from 'express';

import contentRouter from './content.js';
import chatRouter from './chat.js';
import documentRouter from './document.js';
import cardsRouter from './cards.js';
import ttsRouter from './tts.js';

const router = Router();

router.use(contentRouter);
router.use(chatRouter);
router.use(documentRouter);
router.use(cardsRouter);
router.use(ttsRouter);

export default router;

import express from 'express';
import healthRoutes from './health.routes.js';
import lessonRoutes from './lessons.routes.js';
import chatRoutes from './chat.routes.js';
import workspaceRoutes from './workspace.routes.js';
import { chatRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/lessons', lessonRoutes);
router.use('/chat', chatRateLimiter, chatRoutes);
router.use('/workspaces', workspaceRoutes);

export default router;

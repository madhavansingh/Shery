import rateLimit from 'express-rate-limit';
import ApiResponse from '../utils/ApiResponse.js';

export const workspaceApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 300, // max 300 api calls
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json(ApiResponse.error('Too many requests to Knowledge Workspace. Please slow down.', 429));
  },
});

export const workspaceChatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 20, // max 20 chat requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json(ApiResponse.error('Chat generation limit reached. Please wait a minute.', 429));
  },
});

export const workspaceUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 25, // max 25 uploads per hour
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json(ApiResponse.error('Upload rate limit reached. Please wait and try uploading again later.', 429));
  },
});

export const workspaceGenerateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 mins
  max: 10, // max 10 studio asset generations
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json(ApiResponse.error('Studio asset generation limit reached. Please wait a few minutes.', 429));
  },
});

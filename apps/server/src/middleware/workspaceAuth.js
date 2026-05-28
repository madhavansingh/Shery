import logger from '../loggers/logger.js';
import ApiResponse from '../utils/ApiResponse.js';
import workspaceContainer from '../container/workspaceContainer.js';
import AppError from '../utils/AppError.js';
import config from '../config/env.js';

export function getWorkspaceUser(req, res, next) {
  const userId = req.headers['x-workspace-user-id'];
  if (!userId) {
    return res.status(401).json(ApiResponse.error('Workspace User ID is missing in request headers.', 401));
  }
  req.userId = userId;
  next();
}

export async function requireWorkspaceOwnership(req, res, next) {
  const workspaceId = req.params.wid || req.body.workspaceId;
  const userId = req.userId;

  if (!workspaceId) {
    return res.status(400).json(ApiResponse.error('Workspace ID is required for verification.', 400));
  }

  try {
    const workspace = await workspaceContainer.workspaceRepository.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json(ApiResponse.error('Workspace not found.', 404));
    }

    if (workspace.userId !== userId) {
      logger.warn('Unauthorized workspace access attempt', { workspaceId, userId, ownerId: workspace.userId });
      return res.status(403).json(ApiResponse.error('Forbidden: You do not own this workspace.', 403));
    }

    req.workspace = workspace;
    next();
  } catch (error) {
    logger.error('Failed to verify workspace ownership', { error: error.message });
    return res.status(500).json(ApiResponse.error('Internal server error during authorization.', 500));
  }
}

export async function checkWorkspaceLimits(req, res, next) {
  const userId = req.userId;
  try {
    const activeCount = await workspaceContainer.workspaceRepository.countByUser(userId);
    const limit = config.workspaceFreeLimit; // Centralized workspace limit from environment

    if (activeCount >= limit) {
      return res.status(403).json(ApiResponse.error(`Workspace count limit reached (${limit}). Clear or delete old spaces to create new ones.`, 403));
    }
    next();
  } catch (error) {
    next(error);
  }
}

export async function checkSourceLimits(req, res, next) {
  const workspaceId = req.params.wid;
  try {
    const sourceCount = await workspaceContainer.workspaceSourceRepository.countByWorkspace(workspaceId);
    const limit = config.workspaceSourceLimit; // Centralized source limit from environment

    if (sourceCount >= limit) {
      return res.status(403).json(ApiResponse.error(`Source limit reached (${limit} files per workspace). Please delete older files to upload new ones.`, 403));
    }
    next();
  } catch (error) {
    next(error);
  }
}

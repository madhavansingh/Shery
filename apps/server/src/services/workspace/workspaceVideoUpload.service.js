import path from 'path';
import logger from '../../loggers/logger.js';
import AppError from '../../utils/AppError.js';

class WorkspaceVideoUploadService {
  constructor({ workspaceStorageService }) {
    this.workspaceStorageService = workspaceStorageService;
    this.allowedMimeTypes = ['video/mp4', 'video/quicktime', 'video/x-matroska', 'video/webm'];
    this.allowedExtensions = ['.mp4', '.mov', '.mkv', '.webm'];
    this.maxFileSizeBytes = 200 * 1024 * 1024; // 200MB default limit for local videos
  }

  /**
   * Validates if a file type and size is acceptable for video ingestion
   * @param {Object} file Multer file object or metadata
   */
  validateVideo(file) {
    if (!file) {
      throw new AppError('No file provided for video ingestion.', 400);
    }

    const extension = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype;

    const isAllowedExt = this.allowedExtensions.includes(extension);
    const isAllowedMime = this.allowedMimeTypes.includes(mimeType);

    if (!isAllowedExt || !isAllowedMime) {
      logger.warn('Rejected local video upload: Invalid file type', { originalname: file.originalname, mimetype: mimeType });
      throw new AppError(`Unsupported video format. Allowed formats: ${this.allowedExtensions.join(', ')}`, 400);
    }

    if (file.size > this.maxFileSizeBytes) {
      logger.warn('Rejected local video upload: File size limit exceeded', { originalname: file.originalname, size: file.size });
      throw new AppError(`Video file size is too large. Max limit is ${this.maxFileSizeBytes / (1024 * 1024)}MB.`, 400);
    }

    return true;
  }
}

export default WorkspaceVideoUploadService;

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/env.js';
import AppError from '../utils/AppError.js';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import logger from '../loggers/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class VideoStorageService {
  constructor() {
    this.uploadsDir = path.join(__dirname, '../../uploads/videos');
    this.bucket = config.supabaseStorageBucket || 'workspace-assets';
    this.ttl = config.supabaseSignedUrlTtlSeconds || 3600;
  }

  ensureUploadDir() {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  extensionFromMime(fileMime) {
    const extensions = {
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/quicktime': 'mov',
      'video/x-msvideo': 'avi',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/mp4': 'm4a',
    };

    return extensions[fileMime] || 'mp4';
  }

  extensionFromFileName(fileName, fileMime = '') {
    const ext = path.extname(fileName || '').slice(1).toLowerCase().replace(/[^a-z0-9]/g, '');
    return ext || this.extensionFromMime(fileMime);
  }

  contentTypeFromExtension(fileName) {
    const ext = path.extname(fileName).slice(1).toLowerCase();
    const contentTypes = {
      mp4: 'video/mp4',
      m4v: 'video/mp4',
      webm: 'video/webm',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      m4a: 'audio/mp4',
    };

    return contentTypes[ext] || 'application/octet-stream';
  }

  resolveLocalVideoPath(storagePath) {
    const fileName = path.basename(storagePath.replace(/^local:/, ''));
    return path.join(this.uploadsDir, fileName);
  }

  isSupabaseEnabled() {
    return config.storageProvider === 'supabase';
  }

  signedUrlTtlSeconds() {
    return this.ttl;
  }

  parseStoragePath(storagePath) {
    if (!storagePath) return null;
    const match = storagePath.match(/^supabase:([^/]+)\/(.+)$/);
    if (match) {
      return { bucketName: match[1], storageKey: match[2] };
    }
    return null;
  }

  async generateUploadUrl(lessonId, fileName, contentType) {
    const ext = this.extensionFromFileName(fileName, contentType);
    const storageKey = `lessons/${lessonId}.${ext}`;

    if (this.isSupabaseEnabled()) {
      const supabase = getSupabaseAdmin();
      if (!supabase) {
        throw new AppError('Supabase config is missing but storageProvider=supabase', 500);
      }

      const { data, error } = await supabase.storage
        .from(this.bucket)
        .createSignedUploadUrl(storageKey);

      if (error) {
        throw new AppError(`Supabase upload URL generation failed: ${error.message}`, 500);
      }

      return {
        uploadUrl: data.signedUrl,
        storageProvider: 'supabase',
        storagePath: `supabase:${this.bucket}/${storageKey}`,
        storageKey,
      };
    }

    // Local dev mode: return an Express PUT URL that writes local files
    this.ensureUploadDir();
    const localUrl = `${config.frontendUrl.replace(/:\d+$/, '')}:${config.port}/api/lessons/local-upload-emulator/${lessonId}.${ext}`;
    return {
      uploadUrl: localUrl,
      storageProvider: 'local',
      storagePath: `local:${lessonId}.${ext}`,
      storageKey: `${lessonId}.${ext}`,
    };
  }

  async getSignedVideoUrl(storagePath) {
    const parsed = this.parseStoragePath(storagePath);
    if (!parsed) return null;

    const { bucketName, storageKey } = parsed;
    const supabase = getSupabaseAdmin();
    if (!supabase) return null;

    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(storageKey, this.ttl);

    if (error || !data?.signedUrl) {
      logger.warn('Supabase signed URL generation failed for video', { storageKey, error: error?.message });
      return null;
    }

    return data.signedUrl;
  }

  async getSupabaseVideoInfo(storagePath) {
    const parsed = this.parseStoragePath(storagePath);
    if (!parsed) return null;

    const { bucketName, storageKey } = parsed;
    const supabase = getSupabaseAdmin();
    if (!supabase) return null;

    const lastSlash = storageKey.lastIndexOf('/');
    const folder = lastSlash !== -1 ? storageKey.substring(0, lastSlash) : '';
    const fileName = lastSlash !== -1 ? storageKey.substring(lastSlash + 1) : storageKey;

    const { data, error } = await supabase.storage.from(bucketName).list(folder);
    if (error || !data) return null;

    const fileMeta = data.find((f) => f.name === fileName);
    if (!fileMeta) return null;

    return {
      fileSize: Number(fileMeta.metadata?.size || fileMeta.size || 0),
      contentType: fileMeta.metadata?.mimetype || this.contentTypeFromExtension(storageKey),
      fileName: fileName,
    };
  }

  getLocalVideoInfo(storagePath) {
    this.ensureUploadDir();
    const fileName = path.basename(storagePath.replace(/^local:/, ''));
    const filePath = this.resolveLocalVideoPath(storagePath);

    if (!fs.existsSync(filePath)) return null;

    return {
      filePath,
      fileSize: fs.statSync(filePath).size,
      contentType: this.contentTypeFromExtension(fileName),
    };
  }

  async deleteVideo(storagePath) {
    if (!storagePath) return false;

    if (storagePath.startsWith('local:')) {
      const filePath = this.resolveLocalVideoPath(storagePath);
      if (!fs.existsSync(filePath)) return false;
      await fs.promises.unlink(filePath);
      return true;
    }

    const parsed = this.parseStoragePath(storagePath);
    if (!parsed) return false;

    const { bucketName, storageKey } = parsed;
    const supabase = getSupabaseAdmin();
    if (!supabase) return false;

    const { error } = await supabase.storage.from(bucketName).remove([storageKey]);
    if (error) {
      logger.warn('Supabase video delete failed', { storageKey, error: error.message });
      return false;
    }

    return true;
  }
}

export default VideoStorageService;

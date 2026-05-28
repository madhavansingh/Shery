import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../../loggers/logger.js';
import AppError from '../../utils/AppError.js';
import config from '../../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * WorkspaceStorageService
 *
 * Provider-agnostic storage abstraction for the Knowledge Workspace.
 * Routes all file I/O to either:
 *   - 'local'    — local filesystem (development / Railway ephemeral scratch)
 *   - 'supabase' — Supabase Storage (production free-tier)
 *
 * Buckets used on Supabase:
 *   workspace-assets  — PDFs, video originals, transcripts
 *
 * This service is GCS-free.
 */
class WorkspaceStorageService {
  constructor() {
    this.baseUploadsDir = path.join(__dirname, '../../../../uploads/workspace-uploads');
    this._provider = config.storageProvider || 'local'; // 'local' | 'supabase'
    this._bucket = config.supabaseStorageBucket || 'workspace-assets';
    this._ttl = config.supabaseSignedUrlTtlSeconds || 3600;
  }

  // ─── Provider Detection ────────────────────────────────────────────────────

  isSupabase() {
    return this._provider === 'supabase';
  }

  async _resolveSupabase() {
    const { getSupabaseAdmin } = await import('../../lib/supabaseAdmin.js');
    const client = getSupabaseAdmin();
    if (!client) throw new AppError('Supabase client is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.', 500);
    return client;
  }

  // ─── Path Utilities ────────────────────────────────────────────────────────

  /**
   * Returns the storage key (path) for a file in object storage or local fs.
   * Format: workspaceId/sourceId/fileName
   */
  buildStorageKey(workspaceId, sourceId, fileName) {
    if (!workspaceId || !sourceId || !fileName) {
      throw new AppError('workspaceId, sourceId, and fileName are required to build a storage key.', 400);
    }
    return `${workspaceId}/${sourceId}/${fileName}`;
  }

  // ─── Local Storage Helpers ─────────────────────────────────────────────────

  resolveSourceDir(workspaceId, sourceId) {
    if (!workspaceId || !sourceId) {
      throw new AppError('Workspace ID and Source ID are required to resolve storage paths.', 400);
    }
    return path.join(this.baseUploadsDir, workspaceId, sourceId);
  }

  resolveFilePath(workspaceId, sourceId, fileName) {
    const dir = this.resolveSourceDir(workspaceId, sourceId);
    return path.join(dir, fileName);
  }

  ensureSourceDir(workspaceId, sourceId) {
    const dir = this.resolveSourceDir(workspaceId, sourceId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info('Created workspace source storage directory', { workspaceId, sourceId, dir });
    }
    return dir;
  }

  // ─── Core API ─────────────────────────────────────────────────────────────

  /**
   * Upload a file buffer or string to the active storage provider.
   * Returns an opaque storage reference string:
   *   local:    "local:{absoluteFilePath}"
   *   supabase: "supabase:{bucket}/{key}"
   */
  async saveFile(workspaceId, sourceId, fileName, buffer, options = {}) {
    if (this.isSupabase()) {
      return this._supabaseUpload(workspaceId, sourceId, fileName, buffer, options);
    }
    return this._localSave(workspaceId, sourceId, fileName, buffer);
  }

  /**
   * Reads a file as a Buffer. Works for both local and Supabase.
   * For Supabase, downloads the file into memory.
   */
  async getFileBuffer(workspaceId, sourceId, fileName) {
    if (this.isSupabase()) {
      return this._supabaseDownloadBuffer(workspaceId, sourceId, fileName);
    }
    return this._localReadBuffer(workspaceId, sourceId, fileName);
  }

  /**
   * Downloads a file from Supabase (or reads from local) into a temporary file on disk.
   * Returns the absolute path of the temp file.
   * Caller is responsible for deleting the temp file after use.
   */
  async downloadToTempFile(workspaceId, sourceId, fileName, tempDir) {
    if (this.isSupabase()) {
      return this._supabaseDownloadToTemp(workspaceId, sourceId, fileName, tempDir);
    }
    // Local: just return the actual file path
    const filePath = this.resolveFilePath(workspaceId, sourceId, fileName);
    if (!fs.existsSync(filePath)) {
      throw new AppError(`Local file not found: ${filePath}`, 404);
    }
    return filePath;
  }

  /**
   * Generates a time-limited signed URL for reading a file.
   * Local: returns null (callers should use the local serve endpoint instead).
   */
  async getSignedUrl(workspaceId, sourceId, fileName) {
    if (this.isSupabase()) {
      return this._supabaseSignedUrl(workspaceId, sourceId, fileName);
    }
    return null;
  }

  /**
   * Returns the public URL for a file (Supabase public buckets only).
   * Local: returns null.
   */
  async getPublicUrl(workspaceId, sourceId, fileName) {
    if (this.isSupabase()) {
      const supabase = await this._resolveSupabase();
      const key = this.buildStorageKey(workspaceId, sourceId, fileName);
      const { data } = supabase.storage.from(this._bucket).getPublicUrl(key);
      return data?.publicUrl || null;
    }
    return null;
  }

  /**
   * Checks if a file exists.
   */
  async exists(workspaceId, sourceId, fileName) {
    if (this.isSupabase()) {
      return this._supabaseExists(workspaceId, sourceId, fileName);
    }
    const filePath = this.resolveFilePath(workspaceId, sourceId, fileName);
    return fs.existsSync(filePath);
  }

  /**
   * Deletes all files associated with a specific source (cascade).
   */
  async deleteSourceDir(workspaceId, sourceId) {
    if (this.isSupabase()) {
      return this._supabaseDeleteSourcePrefix(workspaceId, sourceId);
    }
    return this._localDeleteSourceDir(workspaceId, sourceId);
  }

  /**
   * Deletes all files for an entire workspace (cascade).
   */
  async deleteWorkspaceDir(workspaceId) {
    if (this.isSupabase()) {
      return this._supabaseDeleteWorkspacePrefix(workspaceId);
    }
    return this._localDeleteWorkspaceDir(workspaceId);
  }

  // ─── Supabase Implementations ──────────────────────────────────────────────

  async _supabaseUpload(workspaceId, sourceId, fileName, buffer, options = {}) {
    try {
      const supabase = await this._resolveSupabase();
      const key = this.buildStorageKey(workspaceId, sourceId, fileName);
      const contentType = options.contentType || 'application/octet-stream';

      const { error } = await supabase.storage
        .from(this._bucket)
        .upload(key, buffer, {
          contentType,
          upsert: options.upsert !== false, // default: overwrite
        });

      if (error) {
        throw new AppError(`Supabase upload failed for ${key}: ${error.message}`, 500);
      }

      const storagePath = `supabase:${this._bucket}/${key}`;
      logger.info('Supabase upload successful', { workspaceId, sourceId, fileName, key });
      return storagePath;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(`Supabase storage upload error: ${err.message}`, 500);
    }
  }

  async _supabaseDownloadBuffer(workspaceId, sourceId, fileName) {
    try {
      const supabase = await this._resolveSupabase();
      const key = this.buildStorageKey(workspaceId, sourceId, fileName);

      const { data, error } = await supabase.storage.from(this._bucket).download(key);
      if (error) throw new AppError(`Supabase download failed for ${key}: ${error.message}`, 404);

      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(`Supabase download error: ${err.message}`, 500);
    }
  }

  async _supabaseDownloadToTemp(workspaceId, sourceId, fileName, tempDir) {
    try {
      const supabase = await this._resolveSupabase();
      const key = this.buildStorageKey(workspaceId, sourceId, fileName);

      const { data, error } = await supabase.storage.from(this._bucket).download(key);
      if (error) throw new AppError(`Supabase download failed for ${key}: ${error.message}`, 404);

      const ext = path.extname(fileName) || '';
      const tempPath = path.join(tempDir, `dl_${sourceId}${ext}`);
      const arrayBuffer = await data.arrayBuffer();
      await fs.promises.writeFile(tempPath, Buffer.from(arrayBuffer));
      logger.info('Downloaded Supabase file to temp', { key, tempPath });
      return tempPath;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(`Supabase temp download error: ${err.message}`, 500);
    }
  }

  async _supabaseSignedUrl(workspaceId, sourceId, fileName) {
    try {
      const supabase = await this._resolveSupabase();
      const key = this.buildStorageKey(workspaceId, sourceId, fileName);

      const { data, error } = await supabase.storage
        .from(this._bucket)
        .createSignedUrl(key, this._ttl);

      if (error || !data?.signedUrl) {
        logger.warn('Supabase signed URL generation failed', { key, error: error?.message });
        return null;
      }
      return data.signedUrl;
    } catch (err) {
      logger.warn('Supabase signed URL error', { error: err.message });
      return null;
    }
  }

  async _supabaseExists(workspaceId, sourceId, fileName) {
    try {
      const supabase = await this._resolveSupabase();
      const prefix = this.buildStorageKey(workspaceId, sourceId, '');
      const { data, error } = await supabase.storage.from(this._bucket).list(prefix);
      if (error || !data) return false;
      return data.some((f) => f.name === fileName);
    } catch {
      return false;
    }
  }

  async _supabaseDeleteSourcePrefix(workspaceId, sourceId) {
    try {
      const supabase = await this._resolveSupabase();
      const prefix = `${workspaceId}/${sourceId}/`;
      const { data, error } = await supabase.storage.from(this._bucket).list(prefix);
      if (error || !data?.length) return false;

      const keys = data.map((f) => `${prefix}${f.name}`);
      const { error: deleteError } = await supabase.storage.from(this._bucket).remove(keys);
      if (deleteError) {
        logger.warn('Supabase source prefix delete failed', { prefix, error: deleteError.message });
        return false;
      }
      logger.info('Deleted Supabase source prefix', { workspaceId, sourceId, count: keys.length });
      return true;
    } catch (err) {
      logger.error('Supabase delete source prefix error', { error: err.message });
      return false;
    }
  }

  async _supabaseDeleteWorkspacePrefix(workspaceId) {
    try {
      const supabase = await this._resolveSupabase();
      const prefix = `${workspaceId}/`;
      // Supabase requires listing all nested files, then removing them
      const { data, error } = await supabase.storage.from(this._bucket).list(prefix, { limit: 1000 });
      if (error || !data?.length) return false;

      // Expand subdirectory items
      const allKeys = [];
      for (const item of data) {
        if (item.name.endsWith('/')) {
          // sub-folder — list recursively
          const sub = await supabase.storage.from(this._bucket).list(`${prefix}${item.name}`, { limit: 1000 });
          if (sub.data) allKeys.push(...sub.data.map((f) => `${prefix}${item.name}${f.name}`));
        } else {
          allKeys.push(`${prefix}${item.name}`);
        }
      }

      if (!allKeys.length) return false;
      const { error: delErr } = await supabase.storage.from(this._bucket).remove(allKeys);
      if (delErr) {
        logger.warn('Supabase workspace prefix delete failed', { workspaceId, error: delErr.message });
        return false;
      }
      logger.info('Deleted Supabase workspace prefix', { workspaceId, count: allKeys.length });
      return true;
    } catch (err) {
      logger.error('Supabase delete workspace prefix error', { error: err.message });
      return false;
    }
  }

  // ─── Local Filesystem Implementations ─────────────────────────────────────

  async _localSave(workspaceId, sourceId, fileName, buffer) {
    try {
      this.ensureSourceDir(workspaceId, sourceId);
      const filePath = this.resolveFilePath(workspaceId, sourceId, fileName);
      await fs.promises.writeFile(filePath, buffer);
      logger.info('Saved file to local storage', { workspaceId, sourceId, fileName, size: buffer.length });
      return `local:${filePath}`;
    } catch (err) {
      throw new AppError(`Local storage save failed: ${err.message}`, 500);
    }
  }

  async _localReadBuffer(workspaceId, sourceId, fileName) {
    const filePath = this.resolveFilePath(workspaceId, sourceId, fileName);
    if (!fs.existsSync(filePath)) {
      throw new AppError(`File not found in local storage: ${fileName}`, 404);
    }
    return fs.promises.readFile(filePath);
  }

  async _localDeleteSourceDir(workspaceId, sourceId) {
    try {
      const dir = this.resolveSourceDir(workspaceId, sourceId);
      if (fs.existsSync(dir)) {
        await fs.promises.rm(dir, { recursive: true, force: true });
        logger.info('Deleted local source storage directory', { workspaceId, sourceId });
        return true;
      }
      return false;
    } catch (err) {
      throw new AppError(`Local storage purge failed: ${err.message}`, 500);
    }
  }

  async _localDeleteWorkspaceDir(workspaceId) {
    try {
      const dir = path.join(this.baseUploadsDir, workspaceId);
      if (fs.existsSync(dir)) {
        await fs.promises.rm(dir, { recursive: true, force: true });
        logger.info('Deleted local workspace storage directory', { workspaceId });
        return true;
      }
      return false;
    } catch (err) {
      throw new AppError(`Local workspace purge failed: ${err.message}`, 500);
    }
  }
}

export default WorkspaceStorageService;

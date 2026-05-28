import fs from 'fs';
import logger from '../../loggers/logger.js';
import TranscriptionProviderFactory from '../transcription/providerFactory.js';
import AppError from '../../utils/AppError.js';

class WorkspaceTranscriptionService {
  constructor() {
    this.provider = null;
  }

  /**
   * Lazy load the transcription provider factory singleton
   */
  getProvider() {
    if (!this.provider) {
      this.provider = TranscriptionProviderFactory.getProvider();
    }
    return this.provider;
  }

  /**
   * Transcribe a local audio file and stream progress percentage updates
   * @param {string} audioFilePath 
   * @param {Function} [onProgress] 
   * @returns {Promise<Array>} Normalized transcript segments
   */
  async transcribeAudioFile(audioFilePath, onProgress) {
    const startMs = Date.now();
    
    if (!fs.existsSync(audioFilePath)) {
      throw new AppError(`Audio file not found for transcription: ${audioFilePath}`, 404);
    }

    try {
      logger.info('Reading audio file into buffer for AssemblyAI upload...', { audioFilePath });
      const buffer = await fs.promises.readFile(audioFilePath);

      const provider = this.getProvider();
      
      // Stage 1: Uploading buffer to provider's cloud workspace
      if (onProgress) await onProgress(10);
      const uploadUrl = await provider.uploadBuffer(buffer);

      // Stage 2: Submitting job to transcription provider
      if (onProgress) await onProgress(25);
      const transcriptId = await provider.submitTranscript(uploadUrl);

      // Stage 3: Polling status until completed
      logger.info('Submitted transcription job. Polling AssemblyAI...', { transcriptId });
      const rawResult = await provider.pollTranscript(transcriptId, async (pct) => {
        // Map 0-100 polling progress onto 25-90% scale for visual timeline fidelity
        if (onProgress) {
          const mappedPct = Math.round(25 + (pct / 100) * 65);
          await onProgress(mappedPct);
        }
      });

      // Stage 4: Processing raw segments
      if (onProgress) await onProgress(95);
      const normalizedSegments = provider.normalizeResult(rawResult);

      logger.info('Audio transcription complete successfully', {
        audioFilePath,
        transcriptId,
        segmentsCount: normalizedSegments.length,
        durationMs: Date.now() - startMs
      });

      return normalizedSegments;
    } catch (err) {
      logger.error('Transcription service execution failed', { audioFilePath, error: err.message });
      throw new AppError(`Transcription pipeline failed: ${err.message}`, err.statusCode || 500);
    }
  }
}

export default WorkspaceTranscriptionService;

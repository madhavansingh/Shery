import AppError from '../../utils/AppError.js';

class BaseTranscriptionProvider {
  /**
   * Uploads file content buffer to transcription provider's storage if needed.
   * @param {Buffer} fileBuffer 
   * @returns {Promise<string>} The uploaded file URL accessible by the transcriber.
   */
  async uploadBuffer(fileBuffer) {
    throw new AppError('uploadBuffer is not implemented for this provider.', 500);
  }

  /**
   * Submits transcription request to the provider.
   * @param {string} audioUrl 
   * @param {string} language 
   * @returns {Promise<string>} Unique job/transcript ID.
   */
  async submitTranscript(audioUrl, language) {
    throw new AppError('submitTranscript is not implemented for this provider.', 500);
  }

  /**
   * Polls transcription status until completion.
   * @param {string} transcriptId 
   * @param {Function} [onProgress] Call with percentage complete (0-100)
   * @returns {Promise<any>} Raw transcription result.
   */
  async pollTranscript(transcriptId, onProgress) {
    throw new AppError('pollTranscript is not implemented for this provider.', 500);
  }

  /**
   * Normalizes the provider's result to standard format: [{ text, start, end }]
   * @param {any} rawTranscript 
   * @returns {Array<{text: string, start: number, end: number}>}
   */
  normalizeResult(rawTranscript) {
    throw new AppError('normalizeResult is not implemented for this provider.', 500);
  }
}

export default BaseTranscriptionProvider;

import logger from '../../loggers/logger.js';

class SafePipelineExecutorService {
  constructor() {
    // Default stage timeouts in milliseconds (5 minutes default)
    this.defaultTimeoutMs = 5 * 60 * 1000;
  }

  /**
   * Run a pipeline stage wrapped in guards (timeout + error propagation)
   * @param {string} stageName 
   * @param {function} stageFn 
   * @param {number} timeoutMs 
   * @returns {Promise<any>}
   */
  async executeStage(stageName, stageFn, timeoutMs = this.defaultTimeoutMs) {
    logger.info(`Guarded execution started for stage: "${stageName}" (Timeout: ${timeoutMs}ms)`);

    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        const timeoutError = new Error(`Stage "${stageName}" exceeded processing timeout limit of ${timeoutMs / 1000}s.`);
        timeoutError.name = 'TimeoutError';
        reject(timeoutError);
      }, timeoutMs);
    });

    try {
      // Race execution against the timeout promise
      const result = await Promise.race([
        stageFn(),
        timeoutPromise,
      ]);
      return result;
    } catch (error) {
      const formattedError = this.formatIngestionError(stageName, error);
      logger.error(`Guarded pipeline execution failed at stage: "${stageName}"`, {
        error: error.message,
        formatted: formattedError.message,
        stack: error.stack,
      });
      throw formattedError;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Translate low-level or network errors into clean, descriptive user warnings.
   */
  formatIngestionError(stage, error) {
    if (error.isOperational && error.message) {
      return error; // Keep already formatted AppErrors
    }

    let userMessage = error.message || 'An unexpected error occurred during processing.';
    let errorCode = 'INGESTION_ERROR';
    let suggestedAction = 'Please try again in a few moments.';

    const messageLower = userMessage.toLowerCase();

    if (error.name === 'TimeoutError' || messageLower.includes('timeout') || messageLower.includes('exceeded processing timeout')) {
      errorCode = 'STAGE_TIMEOUT';
      userMessage = `The "${stage}" stage took too long to complete because the file is extremely large or complex.`;
      suggestedAction = 'Try splitting large files into smaller parts, or retry during lower load periods.';
    } else if (messageLower.includes('pdf-parse') || messageLower.includes('pdfParse') || messageLower.includes('scanned') || messageLower.includes('image-only')) {
      errorCode = 'PDF_PARSING_FAILED';
      userMessage = 'This PDF appears to be a scanned image-only document, is encrypted, or is malformed.';
      suggestedAction = 'Please ensure the PDF has selectable text and is not password-protected.';
    } else if (messageLower.includes('ffmpeg') || messageLower.includes('audio extraction') || messageLower.includes('codec') || messageLower.includes('corrupt')) {
      errorCode = 'VIDEO_CORRUPTION';
      userMessage = 'The uploaded local video may be corrupted, has an unsupported audio stream, or lacks a readable video header.';
      suggestedAction = 'Try re-encoding your video file to standard H.264 MP4 with AAC audio, and try again.';
    } else if (messageLower.includes('caption') || messageLower.includes('transcript') || messageLower.includes('youtube')) {
      errorCode = 'YOUTUBE_CAPTIONS_UNAVAILABLE';
      userMessage = 'Could not retrieve YouTube captions. This video may not have public captions available, or they are restricted.';
      suggestedAction = 'Verify captions are enabled on this video, or paste the text transcript manually.';
    } else if (messageLower.includes('nvidia') || messageLower.includes('qdrant') || messageLower.includes('vector') || messageLower.includes('embedding') || messageLower.includes('fetch failed')) {
      errorCode = 'VECTOR_DATABASE_BUSY';
      userMessage = 'The semantic AI indexing engine or vector database is temporarily unresponsive.';
      suggestedAction = 'We are retrying this step shortly. If it continues, check if the vector db container is active.';
    }

    const enhancedError = new Error(userMessage);
    enhancedError.code = errorCode;
    enhancedError.originalError = error;
    enhancedError.suggestedAction = suggestedAction;
    enhancedError.stage = stage;
    enhancedError.isOperational = true;

    return enhancedError;
  }
}

export default SafePipelineExecutorService;

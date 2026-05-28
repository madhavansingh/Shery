import { exec } from 'child_process';
import fs from 'fs';
import logger from '../../loggers/logger.js';
import AppError from '../../utils/AppError.js';

class WorkspaceVideoProcessorService {
  constructor() {
    this.ffmpegAvailable = null;
  }

  /**
   * Check if FFmpeg is installed
   */
  async checkFfmpeg() {
    if (this.ffmpegAvailable !== null) return this.ffmpegAvailable;
    
    return new Promise((resolve) => {
      exec('ffmpeg -version', (err) => {
        if (err) {
          logger.warn('FFmpeg is not installed. Video processing will be disabled.');
          this.ffmpegAvailable = false;
        } else {
          this.ffmpegAvailable = true;
        }
        resolve(this.ffmpegAvailable);
      });
    });
  }

  /**
   * Extract audio track from local video file
   * @param {string} videoPath 
   * @param {string} audioOutputPath 
   * @returns {Promise<string>} Path to generated audio file
   */
  async extractAudio(videoPath, audioOutputPath) {
    const hasFfmpeg = await this.checkFfmpeg();
    if (!hasFfmpeg) {
      throw new AppError('FFmpeg is required to process local video files, but it was not found.', 500);
    }

    if (!fs.existsSync(videoPath)) {
      throw new AppError('Video source file not found for audio extraction.', 404);
    }

    return new Promise((resolve, reject) => {
      // Ultrafast mono 16k: threads 0 = all CPUs, q:a 9 = lowest quality sufficient for speech
      // silenceremove trims dead air to reduce file size and transcription time
      const cmd = [
        'ffmpeg -y -threads 0',
        `-i "${videoPath}"`,
        '-vn -ac 1 -ar 16000',
        '-af "silenceremove=stop_periods=-1:stop_duration=1.0:stop_threshold=-50dB"',
        `-c:a libmp3lame -q:a 9 "${audioOutputPath}"`,
      ].join(' ');

      logger.info('Extracting audio (ultrafast mono 16k)...', { videoPath, audioOutputPath });

      exec(cmd, { timeout: 5 * 60_000 }, (err) => {
        if (err) {
          logger.error('Audio extraction failed', { error: err.message });
          return reject(new AppError(`FFmpeg audio extraction failed: ${err.message}`, 500));
        }
        logger.info('Audio extracted successfully', { audioOutputPath });
        resolve(audioOutputPath);
      });
    });
  }

  /**
   * Parse video duration in seconds robustly
   * @param {string} videoPath 
   * @returns {Promise<number>} Duration in seconds
   */
  async getVideoDuration(videoPath) {
    const hasFfmpeg = await this.checkFfmpeg();
    if (!hasFfmpeg) return 0;

    return new Promise((resolve) => {
      // Attempt using ffprobe which is fast and return duration directly
      exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`, (err, stdout) => {
        if (!err && stdout) {
          const duration = parseFloat(stdout.trim());
          if (!isNaN(duration) && duration > 0) {
            return resolve(Math.round(duration));
          }
        }

        // Fallback: parse standard ffmpeg status output for duration string
        exec(`ffmpeg -i "${videoPath}" 2>&1`, (err2, stdout2) => {
          const match = stdout2?.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2})/);
          if (match) {
            const hrs = parseInt(match[1], 10);
            const mins = parseInt(match[2], 10);
            const secs = parseInt(match[3], 10);
            const total = (hrs * 3600) + (mins * 60) + secs;
            return resolve(total);
          }
          // Default fallback
          resolve(600); // 10 minutes default
        });
      });
    });
  }
}

export default WorkspaceVideoProcessorService;

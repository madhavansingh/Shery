import path from 'path';
import fs from 'fs';
import os from 'os';
import { exec } from 'child_process';
import logger from '../../loggers/logger.js';
import AppError from '../../utils/AppError.js';

/**
 * Optimized YouTube Ingestion Pipeline — Transcript-First Architecture
 *
 * Strategy waterfall:
 *   1. Transcript cache hit          → instant (<1s)
 *   2. Multi-strategy caption fetch  → fast (<15s)  ← runs in parallel with title resolution
 *   3. Audio download + AssemblyAI  → fallback only
 *
 * Fast-path target: < 15 seconds for any YouTube video with captions.
 */
class WorkspaceYoutubePipeline {
  constructor({
    workspaceTranscriptionService,
    transcriptPostProcessorService,
    workspaceChunkingService,
    topicExtractionService,
    embeddingService,
    workspaceIngestionStateMachine,
    safePipelineExecutorService,
    workspaceCleanupManager,
    workspaceSourceRepository,
    transcriptCacheRepository,
    ingestionService,
    workspaceYoutubeTranscriptFetcherService,
  }) {
    this.transcription = workspaceTranscriptionService;
    this.postProcessor = transcriptPostProcessorService;
    this.chunking = workspaceChunkingService;
    this.topicExtractor = topicExtractionService;
    this.embedding = embeddingService;
    this.stateMachine = workspaceIngestionStateMachine;
    this.executor = safePipelineExecutorService;
    this.cleanupManager = workspaceCleanupManager;
    this.sourceRepo = workspaceSourceRepository;
    this.cacheRepo = transcriptCacheRepository;
    this.ingestionService = ingestionService;
    this.transcriptFetcher = workspaceYoutubeTranscriptFetcherService;
  }

  async run(workspaceId, sourceId, youtubeUrl) {
    // 0. Load checkpoint
    let lastCompletedStage = '';
    let checkpointData = {};
    try {
      const sourceDoc = await this.sourceRepo.findById(workspaceId, sourceId);
      if (sourceDoc?.ingestionState) {
        lastCompletedStage = sourceDoc.ingestionState.lastSuccessfulStage || '';
        checkpointData = sourceDoc.ingestionState.checkpointData || {};
        logger.info(`Resuming YouTube ingestion from checkpoint`, { sourceId, lastCompletedStage });
      }
    } catch (err) {
      logger.warn('Failed to load ingestion checkpoint, starting fresh', { error: err.message });
    }

    const saveCheckpoint = async (stageName, data = {}) => {
      try {
        checkpointData = { ...checkpointData, ...data };
        await this.sourceRepo.update(workspaceId, sourceId, {
          ingestionState: {
            lastSuccessfulStage: stageName,
            checkpointData,
            updatedAt: new Date().toISOString(),
          },
        });
        lastCompletedStage = stageName;
      } catch (err) {
        logger.warn('Failed to save ingestion checkpoint', { error: err.message });
      }
    };

    const stagesOrder = ['resolve_metadata', 'transcribe_audio', 'post_process'];
    const isCompleted = (stageName) =>
      stagesOrder.indexOf(stageName) <= stagesOrder.indexOf(lastCompletedStage);

    try {
      // ─── Stage 1: Resolve metadata + extract video ID ──────────────────────
      let videoId = checkpointData.videoId || '';
      let sourceTitle = checkpointData.sourceTitle || '';

      if (isCompleted('resolve_metadata') && videoId && sourceTitle) {
        logger.info('Skipping metadata resolution — checkpoint', { videoId, sourceTitle });
      } else {
        await this.stateMachine.transitionTo(
          workspaceId, sourceId, 'parsing', 5,
          'Connecting to YouTube and parsing video metadata...'
        );

        videoId = this.extractYoutubeId(youtubeUrl);
        if (!videoId) {
          throw new AppError('Invalid YouTube URL format. Please paste a valid youtube.com or youtu.be link.', 400);
        }

        // Title resolution does NOT block transcript fetch — run in parallel later
        sourceTitle = `YouTube Video (${videoId})`; // placeholder until resolved
        await saveCheckpoint('resolve_metadata', { videoId, sourceTitle });
      }

      // ─── Stage 2: Fetch transcript ──────────────────────────────────────────
      let segments = checkpointData.segments || [];
      let transcriptText = checkpointData.transcriptText || '';
      let transcriptMethod = checkpointData.transcriptMethod || '';

      if (isCompleted('transcribe_audio') && segments.length > 0) {
        logger.info('Skipping transcription — checkpoint', { count: segments.length });
      } else {
        // Check transcript cache first (instant if hit)
        const cached = await this.cacheRepo.findByYoutubeId(videoId);
        if (cached) {
          logger.info('YouTube transcript cache hit — instant load', { videoId });
          segments = cached.segments || [];
          transcriptText = cached.transcript || '';
          transcriptMethod = 'cache';

          await this.stateMachine.transitionTo(
            workspaceId, sourceId, 'generating_transcript', 40,
            '⚡ Previously indexed content detected — loading from cache instantly...'
          );
          await saveCheckpoint('transcribe_audio', { segments, transcriptText, transcriptMethod, fromCache: true });
        } else {
          // Start title resolution in background (parallel with caption fetch)
          const titlePromise = this.getYouTubeTitle(videoId).then(async (title) => {
            if (title && title !== sourceTitle) {
              sourceTitle = title;
              await this.sourceRepo.update(workspaceId, sourceId, { title });
              checkpointData.sourceTitle = title;
            }
          }).catch(() => {/* non-fatal */});

          await this.stateMachine.transitionTo(
            workspaceId, sourceId, 'generating_transcript', 12,
            '🔍 Scanning YouTube for available caption tracks...'
          );

          // === Multi-strategy caption fetch (A + B in parallel, then C) ===
          let fetchResult = null;

          try {
            fetchResult = await Promise.race([
              this.transcriptFetcher.fetch(videoId, youtubeUrl),
              // 25-second timeout so we don't wait forever before falling back to audio
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Caption fetch timeout')), 25_000)
              ),
            ]);
          } catch (captionErr) {
            logger.warn('Caption fetch strategies all failed or timed out', {
              sourceId, videoId, error: captionErr.message,
            });
          }

          if (fetchResult && fetchResult.segments?.length > 0) {
            // ✅ Caption path — no audio download needed
            segments = this.transcriptFetcher.normalizeSegments(fetchResult.segments);
            transcriptMethod = fetchResult.method;
            const methodMsg = this.transcriptFetcher.getMethodMessage(fetchResult.method);

            logger.info(`YouTube caption strategy succeeded [${transcriptMethod}]`, {
              videoId, count: segments.length,
            });

            await this.stateMachine.transitionTo(
              workspaceId, sourceId, 'generating_transcript', 55,
              methodMsg
            );
          } else {
            // === Fallback: Download audio + AssemblyAI ===
            logger.warn('All caption strategies failed. Falling back to audio download.', {
              sourceId, videoId,
            });

            await this.stateMachine.transitionTo(
              workspaceId, sourceId, 'extracting_audio', 20,
              '⚠️ No captions found — downloading audio stream for speech recognition...'
            );

            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `ws-yt-${sourceId}-`));
            const audioPath = path.join(tempDir, 'audio.mp3');
            transcriptMethod = 'assemblyai_audio';

            try {
              await this.executor.executeStage('download_audio', async () => {
                await this._downloadYoutubeAudio(youtubeUrl, audioPath);
              }, 10 * 60_000);

              await this.stateMachine.transitionTo(
                workspaceId, sourceId, 'generating_transcript', 35,
                '🎙️ Transcribing audio with AI speech recognition...'
              );

              await this.executor.executeStage('transcribe_audio', async () => {
                segments = await this.transcription.transcribeAudioFile(audioPath, async (pct) => {
                  const mapped = Math.round(35 + (pct / 100) * 20);
                  await this.stateMachine.transitionTo(
                    workspaceId, sourceId, 'generating_transcript', mapped,
                    `🎙️ Transcribing audio (${pct}%)...`
                  );
                });
                if (!segments || segments.length === 0) {
                  throw new AppError('Speech recognition returned no transcript.', 422);
                }
              }, 15 * 60_000);
            } finally {
              try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
            }
          }

          // Await title in background (non-blocking — already started above)
          await titlePromise;

          await saveCheckpoint('transcribe_audio', {
            segments,
            transcriptText,
            transcriptMethod,
            fromCache: false,
            sourceTitle,
          });
        }
      }

      // ─── Stage 3: Fast local post-processing ────────────────────────────────
      let punctuatedSegments = checkpointData.punctuatedSegments || [];

      if (isCompleted('post_process') && punctuatedSegments.length > 0) {
        logger.info('Skipping post-processing — checkpoint');
      } else {
        await this.stateMachine.transitionTo(
          workspaceId, sourceId, 'enhancing_transcript', 70,
          '✨ Polishing transcript...'
        );

        await this.executor.executeStage('post_process', async () => {
          // Skip AI punctuation in fast-path — captions already have punctuation
          const useAI = transcriptMethod === 'assemblyai_audio';
          punctuatedSegments = await this.postProcessor.process(segments, { useAI: false });
          transcriptText = punctuatedSegments.map((s) => s.text).join(' ');
        }, 3 * 60_000);

        await saveCheckpoint('post_process', { punctuatedSegments, transcriptText });
      }

      const durationSec =
        punctuatedSegments.length > 0
          ? punctuatedSegments[punctuatedSegments.length - 1].end || 0
          : 0;

      // ─── PHASE A — FAST PREVIEW: chat available immediately ─────────────────
      await this.stateMachine.transitionTo(
        workspaceId, sourceId, 'transcript_ready', 72,
        '✅ Grounded chat is ready. Deep indexing continues in background...',
        {
          transcript: transcriptText,
          partialReadyAt: new Date().toISOString(),
          meta: { duration: durationSec, videoId, transcriptMethod },
        }
      );

      // Queue background deep-enrich
      const { workspaceIngestionQueue } = await import('../../infrastructure/workspaceQueue.js');
      await workspaceIngestionQueue.add(
        `deep-enrich-${sourceId}`,
        { workspaceId, sourceId, type: 'deep-enrich' },
        { priority: 5 }
      );

      await this.ingestionService.postIngestionUpdate(workspaceId);
      logger.info('Fast-path YouTube ingestion complete. Deep enrichment queued.', {
        workspaceId, sourceId, method: transcriptMethod, segments: segments.length,
      });

    } catch (error) {
      logger.error('YouTube pipeline failed', { workspaceId, sourceId, error: error.message });
      await this.cleanupManager.rollbackSource(workspaceId, sourceId, error, false);
      throw error;
    }
  }

  /**
   * Download YouTube audio using ytdl-core → ffmpeg ultrafast mono 16k.
   */
  async _downloadYoutubeAudio(youtubeUrl, outputPath) {
    return new Promise(async (resolve, reject) => {
      try {
        const { default: ytdl } = await import('@distube/ytdl-core');

        const info = await ytdl.getInfo(youtubeUrl);
        const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
        if (!audioFormats || audioFormats.length === 0) {
          return reject(new AppError('No audio stream available for this YouTube video.', 422));
        }

        logger.info('Downloading YouTube audio stream (ultrafast mono 16k)...', { outputPath });

        const audioStream = ytdl(youtubeUrl, { quality: 'lowestaudio', filter: 'audioonly' });

        // Ultrafast mono 16k — minimum quality sufficient for speech recognition
        const cmd = [
          'ffmpeg -y -threads 0',
          '-i pipe:0',
          '-vn -ac 1 -ar 16000',
          '-af "silenceremove=stop_periods=-1:stop_duration=0.5:stop_threshold=-50dB"',
          `-q:a 9 "${outputPath}"`,
        ].join(' ');

        const ffmpegProc = exec(cmd, (err) => {
          if (err) {
            return reject(new AppError(`Audio conversion failed: ${err.message}`, 500));
          }
          logger.info('YouTube audio download complete', { outputPath });
          resolve(outputPath);
        });

        audioStream.pipe(ffmpegProc.stdin);
        audioStream.on('error', (streamErr) => {
          ffmpegProc.kill();
          reject(new AppError(`YouTube audio stream error: ${streamErr.message}`, 500));
        });
      } catch (err) {
        reject(new AppError(`YouTube audio download failed: ${err.message}`, 500));
      }
    });
  }

  extractYoutubeId(url) {
    const patterns = [
      /(?:v=|\/v\/|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/,
      /^([A-Za-z0-9_-]{11})$/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  async getYouTubeTitle(videoId) {
    try {
      const res = await fetch(
        `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`,
        { signal: AbortSignal.timeout(5_000) }
      );
      const data = await res.json();
      return data?.title || `YouTube Video (${videoId})`;
    } catch {
      return `YouTube Video (${videoId})`;
    }
  }
}

export default WorkspaceYoutubePipeline;

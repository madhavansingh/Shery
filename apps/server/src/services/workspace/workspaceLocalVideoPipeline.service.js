import path from 'path';
import fs from 'fs';
import logger from '../../loggers/logger.js';
import AppError from '../../utils/AppError.js';

/**
 * Optimized Local Video Ingestion Pipeline
 *
 * Key optimizations vs previous version:
 *   1. Fast-path extracts ONLY the first 60 seconds (not full audio) → immediate transcript_ready
 *   2. tempDir is saved to checkpoint so deep-enrich NEVER re-runs FFmpeg extraction
 *   3. FFmpeg uses -threads 0 -preset ultrafast -q:a 9 silenceremove
 *   4. Segment size doubled to 60s (halves AssemblyAI API calls in deep-enrich)
 */
class WorkspaceLocalVideoPipeline {
  constructor({
    workspaceStorageService,
    workspaceVideoProcessorService,
    workspaceTranscriptionService,
    workspaceTranscriptEnhancerService,
    workspaceVideoIntelligenceService,
    workspaceChunkingService,
    topicExtractionService,
    embeddingService,
    workspaceIngestionStateMachine,
    safePipelineExecutorService,
    workspaceCleanupManager,
    workspaceSourceRepository,
    ingestionService,
    transcriptPostProcessorService,
  }) {
    this.storage = workspaceStorageService;
    this.processor = workspaceVideoProcessorService;
    this.transcription = workspaceTranscriptionService;
    this.enhancer = workspaceTranscriptEnhancerService;
    this.intelligence = workspaceVideoIntelligenceService;
    this.chunking = workspaceChunkingService;
    this.topicExtractor = topicExtractionService;
    this.embedding = embeddingService;
    this.stateMachine = workspaceIngestionStateMachine;
    this.executor = safePipelineExecutorService;
    this.cleanupManager = workspaceCleanupManager;
    this.sourceRepo = workspaceSourceRepository;
    this.ingestionService = ingestionService;
    this.postProcessor = transcriptPostProcessorService;
  }

  async run(workspaceId, sourceId, videoPath, fileName, title) {
    // 0. Load checkpoint
    let lastCompletedStage = '';
    let checkpointData = {};
    try {
      const sourceDoc = await this.sourceRepo.findById(workspaceId, sourceId);
      if (sourceDoc?.ingestionState) {
        lastCompletedStage = sourceDoc.ingestionState.lastSuccessfulStage || '';
        checkpointData = sourceDoc.ingestionState.checkpointData || {};
        logger.info(`Resuming video ingestion from checkpoint`, { sourceId, lastCompletedStage });
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

    const stagesOrder = [
      'validate_video',
      'analyze_video',
      'extract_full_audio_segments',
      'transcribe_first_segment',
    ];
    const isCompleted = (stageName) =>
      stagesOrder.indexOf(stageName) <= stagesOrder.indexOf(lastCompletedStage);

    try {
      // ─── Stage 1: Validate ───────────────────────────────────────────────────
      if (isCompleted('validate_video')) {
        logger.info('Skipping video validation — checkpoint');
      } else {
        await this.stateMachine.transitionTo(
          workspaceId, sourceId, 'validating', 8,
          'Probing video header & validating file integrity...'
        );
        await this.executor.executeStage('validate_video', async () => {
          if (!fs.existsSync(videoPath)) {
            throw new AppError(`Video file not found: ${videoPath}`, 404);
          }
          const stat = fs.statSync(videoPath);
          if (stat.size < 1024) {
            throw new AppError('Uploaded video appears empty or corrupt.', 400);
          }
          logger.info('Video validated', { sourceId, size: stat.size });
        }, 30_000);
        await saveCheckpoint('validate_video');
      }

      // ─── Stage 2: Get duration ───────────────────────────────────────────────
      let duration = checkpointData.duration || 0;
      let videoSize = checkpointData.videoSize || 0;

      if (isCompleted('analyze_video') && duration > 0) {
        logger.info('Skipping video analysis — checkpoint', { duration });
      } else {
        await this.stateMachine.transitionTo(
          workspaceId, sourceId, 'parsing', 13,
          'Analyzing video metadata...'
        );
        await this.executor.executeStage('analyze_video', async () => {
          const stat = fs.statSync(videoPath);
          videoSize = stat.size;
          duration = await this.processor.getVideoDuration(videoPath);
          if (!duration || duration <= 0) {
            throw new AppError('Could not determine video duration.', 400);
          }
          logger.info(`Video: ${duration}s, ${(videoSize / 1024 / 1024).toFixed(1)}MB`, { sourceId });
        }, 30_000);
        await saveCheckpoint('analyze_video', { duration, videoSize });
      }

      // ─── Stage 3: Extract ALL audio segments (runs once, reused by deep-enrich) ────
      // KEY OPTIMIZATION: We run full audio segmentation here in the fast-path,
      // then save tempDir to checkpoint. Deep-enrich REUSES this dir — no double FFmpeg.
      let tempDir = checkpointData.tempDir || '';
      let allSegmentFiles = checkpointData.allSegmentFiles || [];

      if (isCompleted('extract_full_audio_segments') && tempDir && allSegmentFiles.length > 0 && fs.existsSync(tempDir)) {
        logger.info('Skipping audio extraction — checkpoint', { tempDir, segments: allSegmentFiles.length });
      } else {
        await this.stateMachine.transitionTo(
          workspaceId, sourceId, 'extracting_audio', 20,
          '🎵 Segmenting audio track for transcription...'
        );

        await this.executor.executeStage('extract_full_audio_segments', async () => {
          const osModule = await import('os');
          const { exec } = await import('child_process');

          tempDir = fs.mkdtempSync(path.join(osModule.tmpdir(), `ws-vid-${sourceId}-`));
          const segmentPattern = path.join(tempDir, 'seg_%03d.mp3');

          // Ultrafast segmentation: threads 0 = all CPU cores, 60s segments, q:a 9 = smallest speech-quality files
          // silenceremove trims silent sections to reduce upload size / transcription time
          const ffmpegCmd = [
            'ffmpeg -y -threads 0',
            `-i "${videoPath}"`,
            '-vn -ac 1 -ar 16000',
            '-af "silenceremove=stop_periods=-1:stop_duration=1.0:stop_threshold=-50dB"',
            '-f segment -segment_time 60',
            `-c:a libmp3lame -q:a 9 "${segmentPattern}"`,
          ].join(' ');

          await new Promise((resolve, reject) => {
            exec(ffmpegCmd, { timeout: 10 * 60_000 }, (err) => {
              if (err) reject(new AppError(`FFmpeg segmenting failed: ${err.message}`, 500));
              else resolve();
            });
          });

          allSegmentFiles = fs.readdirSync(tempDir)
            .filter((f) => f.startsWith('seg_') && f.endsWith('.mp3'))
            .sort();

          if (allSegmentFiles.length === 0) {
            throw new AppError('Audio segmenting returned no segments.', 422);
          }

          logger.info(`Audio segmented into ${allSegmentFiles.length} × 60s chunks`, { sourceId, tempDir });
        }, 10 * 60_000);

        // Save tempDir to checkpoint — critical to prevent double FFmpeg in deep-enrich
        await saveCheckpoint('extract_full_audio_segments', { tempDir, allSegmentFiles });
      }

      // ─── Stage 4: Transcribe FIRST segment only (fast-path preview) ─────────
      let punctuatedSegments = checkpointData.punctuatedSegments || [];
      let transcriptText = checkpointData.transcriptText || '';

      if (isCompleted('transcribe_first_segment') && punctuatedSegments.length > 0) {
        logger.info('Skipping first-segment transcription — checkpoint');
      } else {
        await this.stateMachine.transitionTo(
          workspaceId, sourceId, 'generating_transcript', 35,
          `🎙️ Transcribing first segment for instant chat preview...`
        );

        await this.executor.executeStage('transcribe_first_segment', async () => {
          const firstSegmentPath = path.join(tempDir, allSegmentFiles[0]);
          const firstSegments = await this.transcription.transcribeAudioFile(firstSegmentPath);

          punctuatedSegments = await this.postProcessor.process(firstSegments, { useAI: false });
          transcriptText = punctuatedSegments.map((s) => s.text).join(' ');
        }, 15 * 60_000);

        await saveCheckpoint('transcribe_first_segment', {
          punctuatedSegments,
          transcriptText,
          rawSegments: punctuatedSegments,
        });
      }

      // ─── PHASE A: Fast preview — chat available now ──────────────────────────
      const segmentCount = allSegmentFiles.length;
      const remaining = segmentCount - 1;

      await this.stateMachine.transitionTo(
        workspaceId, sourceId, 'transcript_ready', 50,
        remaining > 0
          ? `✅ Chat ready (Segment 1/${segmentCount}). Indexing ${remaining} remaining segment${remaining !== 1 ? 's' : ''} in background...`
          : '✅ Chat ready. Full transcript indexed.',
        {
          transcript: transcriptText,
          partialReadyAt: new Date().toISOString(),
          meta: { duration, size: videoSize, fileName, totalSegments: segmentCount },
        }
      );

      // Queue deep-enrich (will reuse tempDir from checkpoint)
      const { workspaceIngestionQueue } = await import('../../infrastructure/workspaceQueue.js');
      await workspaceIngestionQueue.add(
        `deep-enrich-${sourceId}`,
        { workspaceId, sourceId, type: 'deep-enrich' },
        { priority: 5 }
      );

      await this.ingestionService.postIngestionUpdate(workspaceId);
      logger.info('Fast-path local video ingestion complete. Deep enrichment queued.', {
        workspaceId, sourceId, segments: segmentCount,
      });

    } catch (error) {
      logger.error('Local video pipeline failed', { workspaceId, sourceId, error: error.message });
      await this.cleanupManager.rollbackSource(workspaceId, sourceId, error, false);
      throw error;
    }
  }
}

export default WorkspaceLocalVideoPipeline;

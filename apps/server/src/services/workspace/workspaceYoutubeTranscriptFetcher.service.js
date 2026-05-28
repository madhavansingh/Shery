import * as youtubeTranscriptPkg from 'youtube-transcript';
import logger from '../../loggers/logger.js';

const { YoutubeTranscript } = youtubeTranscriptPkg;

/**
 * Multi-strategy YouTube transcript fetcher.
 *
 * Strategy order (run A+B in parallel race, then C, then D):
 *   A. youtube-transcript npm (manual/auto captions via InnerTube)
 *   B. Direct InnerTube timedtext API (raw fetch, language auto-detect)
 *   C. yt-dlp subtitle extraction (no video download)
 *   D. [Caller handles] Full audio download + AssemblyAI
 *
 * Returns: { segments, method } | null
 *   segments: [{ text, start, end }]
 *   method: 'npm_captions' | 'innertube' | 'ytdlp_subs'
 */
class WorkspaceYoutubeTranscriptFetcherService {
  /**
   * Attempt all caption strategies. Returns transcript on first success.
   * @param {string} videoId
   * @param {string} youtubeUrl
   * @returns {Promise<{segments: Array, method: string} | null>}
   */
  async fetch(videoId, youtubeUrl) {
    // --- Race Strategy A and B in parallel ---
    const raceResult = await this._raceStrategies(videoId, youtubeUrl);
    if (raceResult) return raceResult;

    // --- Strategy C: yt-dlp subtitle-only extraction ---
    const ytdlpResult = await this._tryYtDlpSubtitles(videoId);
    if (ytdlpResult) return ytdlpResult;

    // All caption strategies exhausted
    return null;
  }

  /**
   * Run strategies A and B concurrently — whichever returns first wins.
   */
  async _raceStrategies(videoId, youtubeUrl) {
    const makeRaceable = (promise) =>
      promise.then((result) => result).catch(() => null);

    try {
      const [npmResult, innertubeResult] = await Promise.all([
        makeRaceable(this._tryNpmCaptions(youtubeUrl)),
        makeRaceable(this._tryInnertube(videoId)),
      ]);

      // Return whichever succeeded (prefer npm result as it's more reliable)
      if (npmResult) return npmResult;
      if (innertubeResult) return innertubeResult;
    } catch {
      // Both failed
    }
    return null;
  }

  /**
   * Strategy A: youtube-transcript npm package
   */
  async _tryNpmCaptions(youtubeUrl) {
    const raw = await YoutubeTranscript.fetchTranscript(youtubeUrl);
    if (!raw || raw.length === 0) throw new Error('Empty npm captions');

    const segments = raw.map((seg) => ({
      text: seg.text,
      start: Number(seg.offset || 0) / 1000,
      end: (Number(seg.offset || 0) + Number(seg.duration || 0)) / 1000,
    }));

    logger.info('YouTube transcript: npm captions succeeded', { count: segments.length });
    return { segments, method: 'npm_captions' };
  }

  /**
   * Strategy B: Direct InnerTube timedtext API (works even when npm package fails)
   * Uses the same endpoint YouTube's own web client uses.
   */
  async _tryInnertube(videoId) {
    // Step 1: Fetch the player page to get the timedtext URL
    const playerResponse = await this._fetchInnertubePlayer(videoId);
    if (!playerResponse) throw new Error('InnerTube player fetch failed');

    const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!captionTracks || captionTracks.length === 0) {
      throw new Error('No InnerTube caption tracks found');
    }

    // Pick the first English track or first available
    const track =
      captionTracks.find((t) => t.languageCode?.startsWith('en')) ||
      captionTracks[0];

    const baseUrl = track.baseUrl;
    if (!baseUrl) throw new Error('No baseUrl in caption track');

    // Step 2: Fetch the XML transcript
    const xmlUrl = `${baseUrl}&fmt=json3`;
    const xmlRes = await fetch(xmlUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SheryAI/1.0)' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!xmlRes.ok) throw new Error(`InnerTube timedtext fetch failed: ${xmlRes.status}`);

    const data = await xmlRes.json();
    const events = data?.events || [];

    const segments = events
      .filter((e) => e.segs)
      .map((e) => ({
        text: e.segs.map((s) => s.utf8 || '').join('').replace(/\n/g, ' ').trim(),
        start: (e.tStartMs || 0) / 1000,
        end: ((e.tStartMs || 0) + (e.dDurationMs || 0)) / 1000,
      }))
      .filter((s) => s.text.length > 0);

    if (segments.length === 0) throw new Error('InnerTube returned empty segments');

    logger.info('YouTube transcript: InnerTube API succeeded', { count: segments.length });
    return { segments, method: 'innertube' };
  }

  /**
   * Fetch InnerTube player data to get caption track list.
   */
  async _fetchInnertubePlayer(videoId) {
    try {
      const body = JSON.stringify({
        videoId,
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20231121.01.00',
          },
        },
      });

      const res = await fetch('https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'X-YouTube-Client-Name': '1',
          'X-YouTube-Client-Version': '2.20231121.01.00',
        },
        body,
        signal: AbortSignal.timeout(8_000),
      });

      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Strategy C: yt-dlp subtitle-only extraction (no video/audio download).
   * Only runs if yt-dlp is installed on the system.
   */
  async _tryYtDlpSubtitles(videoId) {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const fs = await import('fs');
      const os = await import('os');
      const path = await import('path');

      const execAsync = promisify(exec);

      // Check yt-dlp is available
      try {
        await execAsync('yt-dlp --version', { timeout: 3000 });
      } catch {
        logger.debug('yt-dlp not available for subtitle extraction strategy');
        return null;
      }

      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `yt-subs-${videoId}-`));

      try {
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        // Download auto-subtitles only (no video, no audio)
        const cmd = `yt-dlp --write-auto-sub --sub-lang en --skip-download --sub-format json3 -o "${path.join(tempDir, 'sub')}" "${url}"`;

        await execAsync(cmd, { timeout: 20_000 });

        // Find downloaded subtitle file
        const files = fs.readdirSync(tempDir).filter((f) => f.endsWith('.json3'));
        if (files.length === 0) return null;

        const subData = JSON.parse(fs.readFileSync(path.join(tempDir, files[0]), 'utf8'));
        const events = subData?.events || [];

        const segments = events
          .filter((e) => e.segs)
          .map((e) => ({
            text: e.segs.map((s) => s.utf8 || '').join('').replace(/\n/g, ' ').trim(),
            start: (e.tStartMs || 0) / 1000,
            end: ((e.tStartMs || 0) + (e.dDurationMs || 0)) / 1000,
          }))
          .filter((s) => s.text.length > 0);

        if (segments.length === 0) return null;

        logger.info('YouTube transcript: yt-dlp subtitle extraction succeeded', { count: segments.length });
        return { segments, method: 'ytdlp_subs' };
      } finally {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
      }
    } catch (err) {
      logger.debug('yt-dlp subtitle strategy failed', { error: err.message });
      return null;
    }
  }

  /**
   * Normalize a transcript result's segments to ensure consistent shape.
   */
  normalizeSegments(segments) {
    return segments.map((seg) => ({
      text: (seg.text || '').trim(),
      start: Number(seg.start || 0),
      end: Number(seg.end || seg.start || 0),
    })).filter((s) => s.text.length > 0);
  }

  /**
   * User-facing message for the detected transcript method.
   */
  getMethodMessage(method) {
    switch (method) {
      case 'npm_captions':
        return '⚡ YouTube captions detected — skipping media processing entirely.';
      case 'innertube':
        return '⚡ YouTube auto-captions retrieved via InnerTube — skipping media download.';
      case 'ytdlp_subs':
        return '⚡ YouTube subtitles extracted — skipping heavy audio processing.';
      default:
        return 'Fetching YouTube transcript...';
    }
  }
}

export default WorkspaceYoutubeTranscriptFetcherService;

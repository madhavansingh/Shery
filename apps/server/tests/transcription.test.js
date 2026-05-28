import { vi, describe, it, expect } from 'vitest';
import TranscriptionProviderFactory from '../src/services/transcription/providerFactory.js';
import AssemblyAiProvider from '../src/services/transcription/assemblyaiProvider.js';
import config from '../src/config/env.js';

// Mock assemblyai package
vi.mock('assemblyai', () => {
  return {
    AssemblyAI: class AssemblyAIMock {
      constructor() {
        this.transcripts = {
          submit: vi.fn().mockResolvedValue({ id: 'mock-transcript-id-123' }),
          get: vi.fn().mockResolvedValue({ status: 'completed', speech_model_used: 'universal-3-pro' }),
        };
        this.files = {
          upload: vi.fn().mockResolvedValue('https://assemblyai-storage.com/file-123'),
        };
      }
    },
  };
});

describe('Transcription Provider Architecture', () => {
  it('should instantiate the correct provider using the factory', () => {
    // Save current config
    const origProvider = config.transcriptionProvider;
    
    config.transcriptionProvider = 'assemblyai';
    const provider = TranscriptionProviderFactory.getProvider();
    expect(provider).toBeInstanceOf(AssemblyAiProvider);

    // Clean up
    config.transcriptionProvider = origProvider;
  });

  it('should fallback to default if provider is empty', () => {
    const origProvider = config.transcriptionProvider;
    
    config.transcriptionProvider = '';
    const provider = TranscriptionProviderFactory.getProvider();
    expect(provider).toBeInstanceOf(AssemblyAiProvider);

    config.transcriptionProvider = origProvider;
  });

  it('should fail for unsupported providers', () => {
    const origProvider = config.transcriptionProvider;
    
    config.transcriptionProvider = 'unsupported-provider';
    expect(() => TranscriptionProviderFactory.getProvider()).toThrow('Unsupported transcription provider configured');

    config.transcriptionProvider = origProvider;
  });

  it('AssemblyAiProvider should correctly use speech_models config', async () => {
    const provider = new AssemblyAiProvider();
    
    // Override config
    const origModels = config.assemblyAiSpeechModels;
    config.assemblyAiSpeechModels = ['universal-3-pro', 'universal-2'];
    config.assemblyAiApiKey = 'mock-key';

    // Mock client creation
    const mockSubmit = vi.fn().mockResolvedValue({ id: 'mock-id' });
    provider.getAssemblyClient = () => ({
      transcripts: {
        submit: mockSubmit,
      },
    });

    const jobId = await provider.submitTranscript('https://test-audio.com', 'en');
    expect(jobId).toBe('mock-id');
    expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({
      speech_models: ['universal-3-pro', 'universal-2'],
      language_code: 'en',
    }));

    config.assemblyAiSpeechModels = origModels;
  });

  it('AssemblyAiProvider should normalize transcription results', () => {
    const provider = new AssemblyAiProvider();
    const mockResult = {
      text: 'hello world',
      audio_duration: 10,
      words: [
        { text: 'hello', start: 100, end: 500 },
        { text: 'world', start: 600, end: 1000 },
      ],
    };

    const segments = provider.normalizeResult(mockResult);
    expect(segments.length).toBe(1);
    expect(segments[0].text).toBe('hello world');
    expect(segments[0].start).toBe(0.1); // 100ms
    expect(segments[0].end).toBe(1.0);   // 1000ms
  });
});

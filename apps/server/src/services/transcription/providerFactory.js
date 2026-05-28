import config from '../../config/env.js';
import AssemblyAiProvider from './assemblyaiProvider.js';
import AppError from '../../utils/AppError.js';

class TranscriptionProviderFactory {
  static getProvider() {
    const providerName = (config.transcriptionProvider || 'assemblyai').toLowerCase();

    switch (providerName) {
      case 'assemblyai':
        return new AssemblyAiProvider();
      // Future provider adapters can be registered here:
      // case 'deepgram':
      //   return new DeepgramProvider();
      // case 'whisper':
      //   return new WhisperProvider();
      // case 'google':
      //   return new GoogleSpeechToTextProvider();
      default:
        throw new AppError(`Unsupported transcription provider configured: ${providerName}`, 500);
    }
  }
}

export default TranscriptionProviderFactory;

export type IngestionStatus = 'uploading' | 'transcribing' | 'processing' | 'ready' | 'failed';

export interface TopicSegment {
  topic: string;
  startTime: number;
  startLabel: string;
}

export interface Lesson {
  id: string;
  lessonId: string;
  courseId: string;
  moduleId: string;
  title: string;
  description: string;
  order: number;
  source: 'youtube' | 'upload' | 'google_drive' | 'zoom' | 'external_url';
  status: IngestionStatus;
  progress: number;
  chunkCount: number;
  duration: number;
  starterQuestions: string[];
  topicSegments: TopicSegment[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  error?: string | null;
  errorDetails?: any;
  suggestedAction?: string | null;
  videoUrl?: string | null;
  youtubeVideoId?: string | null;
  youtubeUrl?: string | null;
  sourceUrl?: string | null;
  playbackUrl?: string | null;
}

export interface IngestYoutubePayload {
  courseId: string;
  moduleId?: string;
  title: string;
  description?: string;
  youtubeUrl: string;
  language?: string;
  order?: number;
}

export interface IngestUrlPayload {
  courseId: string;
  moduleId?: string;
  title: string;
  description?: string;
  sourceUrl: string;
  language?: string;
  order?: number;
}

import { useLessonStatusQuery } from '../api/lessonQueries';

export function useLessonStatus(lessonId, enabled = true) {
  const { data, error, isLoading } = useLessonStatusQuery(lessonId, enabled);

  return {
    status: data?.status ?? null,
    progress: data?.progress || 0,
    chunkCount: data?.chunkCount || 0,
    error: data?.error || error?.message || null,
    loading: isLoading,
  };
}

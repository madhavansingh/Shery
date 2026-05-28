import { useMutation } from '@tanstack/react-query';
import { deleteChatSession, getLectureSummary } from '../services/api';

export function useLectureSummaryMutation() {
  return useMutation({
    mutationFn: ({ lessonId, type = 'full', startTime = 0, endTime = 0 }) => getLectureSummary(lessonId, type, startTime, endTime),
  });
}

export function useDeleteChatSessionMutation() {
  return useMutation({
    mutationFn: deleteChatSession,
  });
}

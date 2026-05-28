export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  followUps?: string[];
}

export interface ChatSession {
  id: string;
  sessionId: string;
  lessonId: string;
  studentId: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface StreamEvent {
  type: 'session' | 'token' | 'followUps' | 'error' | 'done';
  sessionId?: string;
  content?: string;
  items?: string[];
  message?: string;
  fullResponse?: string;
  followUps?: string[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: string; // "A" | "B" | "C" | "D"
  explanation: string;
  startLabel: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
}

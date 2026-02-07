export interface ConversationMessage {
  id: string;
  sender: 'user' | 'assistant' | 'status';
  text: string;
  timestamp: string;
  fileUrl?: string;
  fileName?: string;
}

export enum SessionStatus {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  LISTENING = 'listening',
  SPEAKING = 'speaking',
  ERROR = 'error',
  CLOSING = 'closing',
}

export interface LiveSessionCallbacks {
  onMessage: (message: ConversationMessage) => void;
  onStatusChange: (status: SessionStatus) => void;
  onError: (error: string) => void;
}

export interface ConversationUIProps {
  messages: ConversationMessage[];
  status: SessionStatus;
  onStart: () => void;
  onStop: () => void;
  errorMessage: string | null;
}

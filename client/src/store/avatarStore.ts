import { create } from 'zustand';

export type AvatarState = 'collapsed' | 'expanded';
export type SessionStatus = 'idle' | 'connecting' | 'connected' | 'speaking' | 'listening' | 'error';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AvatarStore {
  widgetState: AvatarState;
  sessionStatus: SessionStatus;
  messages: Message[];
  isListening: boolean;
  isSpeaking: boolean;
  currentTranscript: string;
  sessionId: string | null;
  conversationId: number | null;
  
  setWidgetState: (state: AvatarState) => void;
  setSessionStatus: (status: SessionStatus) => void;
  addMessage: (role: 'user' | 'assistant', content: string) => void;
  setIsListening: (listening: boolean) => void;
  setIsSpeaking: (speaking: boolean) => void;
  setCurrentTranscript: (transcript: string) => void;
  setSessionId: (id: string | null) => void;
  setConversationId: (id: number | null) => void;
  clearMessages: () => void;
  toggleWidget: () => void;
}

export const useAvatarStore = create<AvatarStore>((set, get) => ({
  widgetState: 'collapsed',
  sessionStatus: 'idle',
  messages: [],
  isListening: false,
  isSpeaking: false,
  currentTranscript: '',
  sessionId: null,
  conversationId: null,

  setWidgetState: (state) => set({ widgetState: state }),
  setSessionStatus: (status) => set({ sessionStatus: status }),
  
  addMessage: (role, content) => set((state) => ({
    messages: [...state.messages, {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role,
      content,
      timestamp: new Date()
    }]
  })),
  
  setIsListening: (listening) => set({ isListening: listening }),
  setIsSpeaking: (speaking) => set({ isSpeaking: speaking }),
  setCurrentTranscript: (transcript) => set({ currentTranscript: transcript }),
  setSessionId: (id) => set({ sessionId: id }),
  setConversationId: (id) => set({ conversationId: id }),
  
  clearMessages: () => set({ messages: [] }),
  
  toggleWidget: () => set((state) => ({
    widgetState: state.widgetState === 'collapsed' ? 'expanded' : 'collapsed'
  })),
}));

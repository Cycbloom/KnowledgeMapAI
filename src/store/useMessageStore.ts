
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type MessageType = 'info' | 'success' | 'warning' | 'error' | 'loading';

export interface Message {
  id: string;
  type: MessageType;
  content: string;
  duration?: number; // ms, 0 for persistent
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface MessageState {
  messages: Message[];
  addMessage: (message: Omit<Message, 'id'>) => string;
  removeMessage: (id: string) => void;
  clearMessages: () => void;
}

export const useMessageStore = create<MessageState>()(
  devtools(
    (set) => ({
      messages: [],
      addMessage: (message) => {
        const id = Math.random().toString(36).substring(7);
        const newMessage = { ...message, id };
        
        set((state) => ({ messages: [...state.messages, newMessage] }));

        if (message.duration !== 0) {
          setTimeout(() => {
            set((state) => ({
              messages: state.messages.filter((m) => m.id !== id),
            }));
          }, message.duration || 3000);
        }

        return id;
      },
      removeMessage: (id) =>
        set((state) => ({
          messages: state.messages.filter((m) => m.id !== id),
        })),
      clearMessages: () => set({ messages: [] }),
    }),
    { name: 'MessageStore' }
  )
);

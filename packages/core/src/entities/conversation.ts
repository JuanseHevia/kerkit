export type MessageRole = 'user' | 'assistant' | 'system';

export interface ConversationMessage {
  role: MessageRole;
  content: string;
  timestamp: Date;
}

/** Ids of the entities that were in the assistant's context window for a turn. */
export interface ContextSnapshot {
  recentAppointments: string[];
  activePrescriptions: string[];
  recentNotes: string[];
  pinnedNotes: string[];
  activeAuthorizations: string[];
  recentCheckpoints: string[];
}

export interface ConversationBase {
  id: string;
  userId: string;
  messages: ConversationMessage[];
  contextSnapshot: ContextSnapshot;
  createdAt: Date;
  updatedAt: Date;
}

export type Conversation<TExt = Record<never, never>> = ConversationBase & TExt;

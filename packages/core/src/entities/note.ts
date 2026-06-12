export type NoteInputType = 'text' | 'voice';

/**
 * Freeform caretaker note (the "scratchpad"). The cognitive-offload surface:
 * anything the caretaker doesn't want to hold in their head. Free text is
 * treated as potentially containing identifiers — the privacy sweep pass
 * runs over it before any LLM call.
 */
export interface NoteBase {
  id: string;
  userId: string;
  title?: string | null;
  content: string;
  inputType: NoteInputType;
  category?: string | null;
  tags: string[];
  isPinned: boolean;
  /** Reserved for voice notes. Audio is ephemeral by contract — see the voice docs. */
  audioUrl?: string;
  linkedAppointmentId?: string;
  linkedPrescriptionId?: string;
  source?: string | null;
  sourceExternalId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type Note<TExt = Record<never, never>> = NoteBase & TExt;

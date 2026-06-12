/**
 * Signal types cover the institutional messages a caretaker actually receives
 * during a treatment: authorization progress, medication availability,
 * results, reminders. Locale packs supply the matching patterns.
 */
export type SignalType =
  | 'auth_preparing'
  | 'auth_approved'
  | 'med_ready_for_pickup'
  | 'med_delivery_confirmed'
  | 'auth_docs_needed'
  | 'auth_not_required'
  | 'auth_pdf_received'
  | 'med_shortage'
  | 'report_available'
  | 'lab_results_available'
  | 'prescription_detected'
  | 'appointment_reminder'
  | 'unknown';

export type SignalChannel = 'email' | (string & {});

/**
 * A classified inbound message (née GmailSignal): "this email from the insurer
 * means your authorization was approved". The channel is generic; email is the
 * reference implementation.
 */
export interface SignalBase {
  id: string;
  userId: string;
  channel: SignalChannel;
  /** Message id in the source channel (e.g. email message id). */
  externalId: string;
  signalType: SignalType;
  subject: string;
  sender: string;
  detectedAt: Date;
  acknowledged: boolean;
  suggestedAction?: string;
  linkedAuthorizationId?: string;
  institutionId?: string;
  createdAt: Date;
}

export type Signal<TExt = Record<never, never>> = SignalBase & TExt;

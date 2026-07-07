import type { LocalePack, RedactionSession } from '@kerkit/core';
import type { PatientContextResult, ProviderAdapter } from '@kerkit/ai';
import type { createFixtureRepositories } from '@kerkit/ai/demo';

/** Everything the route factories need, wired once at app boot. */
export interface DemoDeps {
  repos: ReturnType<typeof createFixtureRepositories>;
  pack: LocalePack;
  userId: string;
  provider: ProviderAdapter;
  /** Pre-redacted patient block + its rehydration tokens. */
  patientContext: PatientContextResult;
  systemPrompt: string;
  /** The shared request-scoped session, threaded through assembly + the chat sink. */
  session: RedactionSession;
  /** Pinned clock so the Feb-2026 fixtures land in the active window. */
  now: () => Date;
}

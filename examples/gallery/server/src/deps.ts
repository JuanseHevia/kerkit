import type { LocalePack } from '@kerkit/core';
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
  /** Pinned clock so the Feb-2026 fixtures land in the active window. */
  now: () => Date;
}

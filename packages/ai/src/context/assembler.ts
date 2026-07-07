import { redactEntityForLlm, sweepText } from '@kerkit/core';
import type { LocalePack, RedactionSession } from '@kerkit/core';
import type { ContextSource } from './source.js';

export interface SectionReport {
  key: string;
  heading: string;
  fetched: number;
  included: number;
  /** Items dropped by the maxItems budget. */
  dropped: number;
  /** Fields tokenized (direct identifiers) across the section's items. */
  tokenizedFields: number;
  /** Sensitive fields passed through by explicit opt-in. */
  sensitiveAllowed: readonly string[];
}

export interface AssembledContext {
  /** The redacted, swept context block — the ONLY thing that goes to the model. */
  contextText: string;
  /** placeholder token → original value, for app-side rehydration in UI. */
  redactionMap: Map<string, string>;
  /**
   * What was included, excluded, tokenized, and swept. Doubles as the
   * user-facing transparency feature and your debugging tool.
   */
  explain(): { sections: SectionReport[]; sweptMatches: number };
}

export interface ContextAssemblerOptions {
  /** Supplies identifier patterns for the sweep pass. */
  pack: Pick<LocalePack, 'identifierPatterns'>;
}

/**
 * The caretaker context window. Sources fetch in parallel; every item is
 * structurally redacted with its source's classification; the assembled
 * text gets a final identifier sweep. No source can opt out.
 */
export class ContextAssembler {
  private sources: ContextSource[] = [];

  constructor(private readonly options: ContextAssemblerOptions) {}

  add<T extends Record<string, unknown>>(source: ContextSource<T>): this {
    this.sources.push(source as unknown as ContextSource);
    return this;
  }

  async assemble(
    userId: string,
    opts: {
      /**
       * Tokens already known to the app (e.g. from buildPatientContextBlock),
       * so mentions of those values inside free text get swept to the same
       * placeholders. Pass them — names hide in note contents. Ignored when
       * `session` is supplied (the session already carries them).
       */
      knownTokens?: ReadonlyMap<string, string>;
      /**
       * Shared request-scoped session. Pass the SAME instance you gave
       * `buildPatientContextBlock` and `runChatLoop` so tokens dedup across all
       * three (a name in a note becomes the same placeholder as the patient
       * field). Prefer `createRedactedChat`, which wires this for you.
       */
      session?: RedactionSession;
    } = {},
  ): Promise<AssembledContext> {
    const ordered = [...this.sources].sort((a, b) => a.priority - b.priority);

    const fetched = await Promise.all(
      ordered.map(async (source) => ({ source, items: await source.fetch(userId) })),
    );

    const session = opts.session;
    // Without a session, accumulate locally (seeded with knownTokens). With a
    // session, snapshot its map after redaction (below) — it owns the tokens.
    const redactionMap = new Map<string, string>(session ? [] : (opts.knownTokens ?? []));
    const reports: SectionReport[] = [];
    const blocks: string[] = [];

    for (const { source, items } of fetched) {
      const included = items.slice(0, source.maxItems);
      let tokenizedFields = 0;
      const lines: string[] = [];

      for (const item of included) {
        const { redacted, tokens } = session
          ? session.redactEntity(item, source.classification, {
              entityKind: source.key,
              allowSensitiveFields: source.allowSensitiveFields,
            })
          : redactEntityForLlm(item, source.classification, {
              allowSensitiveFields: source.allowSensitiveFields,
            });
        tokenizedFields += tokens.size;
        // Without a session, accumulate into the local map (the session owns
        // its own map, exposed via tokenToValue()).
        if (!session) for (const [token, value] of tokens) redactionMap.set(token, value);
        lines.push(`- ${source.formatItem(redacted)}`);
      }

      reports.push({
        key: source.key,
        heading: source.heading,
        fetched: items.length,
        included: included.length,
        dropped: items.length - included.length,
        tokenizedFields,
        sensitiveAllowed: source.allowSensitiveFields ?? [],
      });

      if (lines.length > 0) {
        blocks.push(`--- ${source.heading} ---\n${lines.join('\n')}`);
      }
    }

    // Belt-and-suspenders: sweep the whole block for identifiers that hid in
    // free text, plus token-map values that leaked through other fields.
    const joined = blocks.join('\n\n');
    let contextText: string;
    let sweptMatches: number;
    if (session) {
      const before = session.explain().sweptMatches;
      contextText = session.sweep(joined);
      sweptMatches = session.explain().sweptMatches - before;
      for (const [token, value] of session.tokenToValue()) redactionMap.set(token, value);
    } else {
      const swept = sweepText(joined, this.options.pack.identifierPatterns ?? [], redactionMap);
      contextText = swept.text;
      sweptMatches = swept.matches.length;
    }

    return {
      contextText,
      redactionMap,
      explain: () => ({ sections: reports, sweptMatches }),
    };
  }
}

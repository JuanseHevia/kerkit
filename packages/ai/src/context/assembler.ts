import { redactEntityForLlm, sweepText } from '@kerkit/core';
import type { LocalePack } from '@kerkit/core';
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
       * placeholders. Pass them — names hide in note contents.
       */
      knownTokens?: ReadonlyMap<string, string>;
    } = {},
  ): Promise<AssembledContext> {
    const ordered = [...this.sources].sort((a, b) => a.priority - b.priority);

    const fetched = await Promise.all(
      ordered.map(async (source) => ({ source, items: await source.fetch(userId) })),
    );

    const redactionMap = new Map<string, string>(opts.knownTokens ?? []);
    const reports: SectionReport[] = [];
    const blocks: string[] = [];

    for (const { source, items } of fetched) {
      const included = items.slice(0, source.maxItems);
      let tokenizedFields = 0;
      const lines: string[] = [];

      for (const item of included) {
        const { redacted, tokens } = redactEntityForLlm(item, source.classification, {
          allowSensitiveFields: source.allowSensitiveFields,
        });
        for (const [token, value] of tokens) {
          redactionMap.set(token, value);
          tokenizedFields++;
        }
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
    // free text, plus any token-map values that leaked through other fields.
    const swept = sweepText(
      blocks.join('\n\n'),
      this.options.pack.identifierPatterns ?? [],
      redactionMap,
    );

    return {
      contextText: swept.text,
      redactionMap,
      explain: () => ({ sections: reports, sweptMatches: swept.matches.length }),
    };
  }
}

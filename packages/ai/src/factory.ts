import { RedactionSession, type LocalePack, type Patient, type RedactionPolicy } from '@kerkit/core';
import { ContextAssembler, type AssembledContext } from './context/assembler.js';
import type { ContextSource } from './context/source.js';
import { buildPatientContextBlock, buildSystemPrompt } from './prompts/builder.js';
import { runChatLoop, type ChatLoopResult } from './loop/chat-loop.js';
import type { ChatMessage, ProviderAdapter } from './messages.js';
import { createToolExecutor, toToolSpecs } from './mcp/executor.js';
import type { ToolContext, ToolDefinition } from './mcp/types.js';
import type { ExternalSources, KerkitRepositories } from './repositories.js';

export interface RedactedChatOptions {
  pack: LocalePack;
  provider: ProviderAdapter;
  repos: KerkitRepositories;
  patient: Patient;
  userId: string;
  assistantName: string;
  caretakerName?: string;
  insurerName?: string;
  allowSensitiveFields?: readonly ('diagnosis' | 'treatmentPhase')[];
  /** Context sources for the assistant's window (e.g. `defaultSources(...)`). */
  sources?: ContextSource[];
  /** Tool definitions (e.g. `allTools` from '@kerkit/ai/mcp'). */
  tools?: ToolDefinition[];
  /** Bridges for the external tools (email/calendar/documents). */
  external?: ExternalSources;
  /** Redaction policy; `pseudonymizeContacts` defaults to false. */
  policy?: Partial<RedactionPolicy>;
  maxRounds?: number;
  extraInstructions?: string;
  institutionsBlock?: string;
}

export interface RedactedChat {
  /** The one shared session. Use `.tokenToValue()` to rehydrate the UI, `.explain()` to debug. */
  readonly session: RedactionSession;
  /** System prompt built with the redacted patient block. */
  readonly systemPrompt: string;
  /** Assemble the redacted caretaker context window (session already wired). */
  assembleContext(): Promise<AssembledContext>;
  /** Run one assistant turn. `history` is prior turns, if any. */
  respond(input: { message: string; history?: ChatMessage[] }): Promise<ChatLoopResult>;
}

/**
 * The safe default path. Owns ONE request-scoped `RedactionSession` and wires it
 * through the patient block, context assembly, tool execution, and the provider
 * sink — so the free-text name leak is closed without the caller threading four
 * call sites. Construct one per patient-conversation; call `respond` per turn.
 *
 * Prefer this over hand-threading `session` into `buildPatientContextBlock` /
 * `assemble` / `runChatLoop` (that lower-level path is for advanced use).
 */
export function createRedactedChat(options: RedactedChatOptions): RedactedChat {
  const session = new RedactionSession({
    patterns: options.pack.identifierPatterns ?? [],
    policy: options.policy,
  });

  const patientContext = buildPatientContextBlock(options.patient, {
    insurerName: options.insurerName,
    allowSensitiveFields: options.allowSensitiveFields,
    session,
  });

  const systemPrompt = buildSystemPrompt({
    pack: options.pack,
    assistantName: options.assistantName,
    caretakerName: options.caretakerName,
    careContextBlock: patientContext.block,
    institutionsBlock: options.institutionsBlock,
    extraInstructions: options.extraInstructions,
  });

  const tools = options.tools ?? [];
  const toolContext: ToolContext = {
    userId: options.userId,
    repos: options.repos,
    external: options.external,
    pack: options.pack,
    session,
  };
  const executeTool = tools.length > 0 ? createToolExecutor(tools, toolContext) : undefined;
  const toolSpecs = tools.length > 0 ? toToolSpecs(tools) : undefined;

  const assembleContext = async (): Promise<AssembledContext> => {
    const assembler = new ContextAssembler({ pack: options.pack });
    for (const source of options.sources ?? []) assembler.add(source);
    return assembler.assemble(options.userId, { session });
  };

  return {
    session,
    systemPrompt,
    assembleContext,
    async respond({ message, history }): Promise<ChatLoopResult> {
      const context = await assembleContext();
      const instructions = context.contextText
        ? `${systemPrompt}\n\n<context_window>\n${context.contextText}\n</context_window>`
        : systemPrompt;
      const messages: ChatMessage[] = [...(history ?? []), { role: 'user', content: message }];
      return runChatLoop({
        provider: options.provider,
        pack: options.pack,
        instructions,
        messages,
        tools: toolSpecs,
        executeTool,
        maxRounds: options.maxRounds,
        session,
      });
    },
  };
}

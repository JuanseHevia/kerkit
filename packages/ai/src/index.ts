export type {
  ChatMessage,
  ToolSpec,
  ToolCallRequest,
  ToolCallResult,
  TokenUsage,
  ProviderTurn,
  GenerateOptions,
  ProviderAdapter,
  RedactedText,
  SafeChatMessage,
} from './messages.js';

export type {
  KerkitRepositories,
  AppointmentsRepository,
  PrescriptionsRepository,
  NotesRepository,
  AuthorizationsRepository,
  CheckpointsRepository,
  SignalsRepository,
  ProfileRepository,
  ExternalSources,
} from './repositories.js';

export { ContextAssembler } from './context/assembler.js';
export type {
  AssembledContext,
  ContextAssemblerOptions,
  SectionReport,
} from './context/assembler.js';
export type { ContextSource } from './context/source.js';
export {
  defaultSources,
  appointmentsSource,
  prescriptionsSource,
  authorizationsSource,
  notesSource,
  checkpointsSource,
  signalsSource,
} from './context/sources.js';

export { buildSystemPrompt, buildPatientContextBlock } from './prompts/builder.js';
export type { SystemPromptOptions, PatientContextResult } from './prompts/builder.js';

export { runChatLoop } from './loop/chat-loop.js';
export type { ChatLoopOptions, ChatLoopResult, ExecutedToolCall } from './loop/chat-loop.js';

// The safe default path — wires one RedactionSession through the whole flow.
export { createRedactedChat } from './factory.js';
export type { RedactedChat, RedactedChatOptions } from './factory.js';

// Re-exported from @kerkit/core for convenience (the redaction primitives the
// AI layer threads). Full set lives in @kerkit/core.
export { RedactionSession } from '@kerkit/core';
export type { RedactionPolicy, RedactionExplain, RedactionFinding } from '@kerkit/core';

// MCP toolkit: import from '@kerkit/ai/mcp'
// OpenAI Responses adapter: import from '@kerkit/ai/openai'

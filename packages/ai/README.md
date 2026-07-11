# @kerkit/ai

The AI layer for caretaker apps: a **redaction-enforced context window**, a provider-agnostic tool-calling loop, an MCP tool toolkit, and prompt conventions with non-removable privacy blocks.

> ⚠️ Not a medical device. The prompt conventions actively refuse medical advice — that block cannot be removed. See the project NOTICE.

## Quickstart: `createRedactedChat`

Start here. `createRedactedChat` owns **one request-scoped `RedactionSession`** and threads it through the patient block, context assembly, every tool, and the provider sink — so identifiers are redacted at the boundary without you wiring four call sites by hand. Construct one per patient-conversation; call `respond` per turn.

```ts
import { createRedactedChat, defaultSources } from '@kerkit/ai';
import { allTools } from '@kerkit/ai/mcp';
import { OpenAIResponsesAdapter } from '@kerkit/ai/openai';
import { createFixtureRepositories } from '@kerkit/ai/demo';
import { fixturePatient } from '@kerkit/core';
import { argentina } from '@kerkit/pack-argentina';
import OpenAI from 'openai';

// Your data layer: any `KerkitRepositories` implementation. The demo fixtures
// run against the synthetic persona with zero setup.
const repos = createFixtureRepositories();

// Your model provider. The adapter needs only `responses.create` — pass
// `new OpenAI()`; OpenAI types never touch kerkit's public surface.
const provider = new OpenAIResponsesAdapter(new OpenAI(), 'gpt-5-mini');

const chat = createRedactedChat({
  pack: argentina,
  provider,
  repos,
  patient: fixturePatient,
  userId: fixturePatient.userId,
  assistantName: 'Aidé',
  allowSensitiveFields: ['treatmentPhase'], // health fields are opt-in
  sources: defaultSources(repos, argentina), // the caretaker context window
  tools: allTools, // the nine caretaker tools
});

// The redacted context window, with a transparency report.
const ctx = await chat.assembleContext();
ctx.contextText; // the ONLY thing that reaches the model
ctx.explain(); // what was included / excluded / tokenized — show it to the user

// One assistant turn. Free-text names in tool output are swept at the sink.
const { message, redaction } = await chat.respond({
  message: '¿Cómo viene el trámite de la medicación?',
});
message; // model answer (see the leak-check caveat below)
redaction?.tokensAllocated; // observability: what the sink tokenized this turn
```

That single call covers **patient, repositories, sources, tools, provider, context assembly, and one response** — with the session already wired through all of them. Pass `history` to `respond` to continue a conversation; read `chat.session.tokenToValue()` to rehydrate tokens back into real values in your UI.

> This quickstart is a CI compile gate: [`src/readme-quickstart.example.ts`](./src/readme-quickstart.example.ts) type-checks the same call under `npm run lint`, so the snippet can't silently drift from the API.

## What the shared session protects — and what it can't

The session enforces two layers with **different guarantees**. Knowing which is which is the difference between a real privacy boundary and a false sense of one.

1. **Structural redaction — proven, deterministic.** Every row and entity is classified field-by-field before it leaves its source. `direct-identifier` fields (name, DNI, credential number) become stable tokens; sensitive health fields are dropped unless you opt in via `allowSensitiveFields`. This covers the fields the classification knows about, every time.

2. **Free-text recall — best-effort.** Identifiers hiding inside prose (a name typed into a note, an address in an email body) are caught two ways: the locale's regex patterns match *shaped* identifiers (DNI/CUIL), and a **known-value sweep** replaces values the session has *already tokenized somewhere else* — which is why the patient's name, tokenized first by the patient block, is then swept out of a note that mentions it.

**Row-level structural redaction does not, on its own, catch an arbitrary name in free text.** A name is not regex-shaped, so it is only swept if the shared session already holds it as a known value. That is the whole reason one session must span the patient block, assembly, tools, and the sink — and it is also the limit: a brand-new name that appears **only** in free text and was never tokenized elsewhere can still reach the model. Keep your own output leak-check. `respond()` (and `runChatLoop`) return a `redaction` report for observability, but the model-emitted `message` is **not** sink-swept — it is generated text, not application data.

## Tools

Nine tools: `read_appointments`, `read_prescriptions`, `read_authorizations`, `read_notes`, `read_checkpoints`, `write_note`, plus `read_email` / `read_calendar` / `read_documents` behind the optional `ExternalSources` interface (your Composio/Google glue implements it; tools degrade gracefully without it).

Wired through `createRedactedChat` (or given a `session` in their `ToolContext`), tool output passes the structural classification pass **and** the shared session's sweep before leaving the tool — the same discipline as assembled context.

Run them in-process (`createToolExecutor`) or on an MCP server (`registerKerkitTools(server, allTools, { userMode: { kind: 'injected' } })` — in injected mode a missing `_userId` is a hard error; there is no fallback user).

## Prompts

`buildSystemPrompt({ pack, assistantName, … })` assembles identity + tone + privacy + boundaries. The privacy and not-medical-advice blocks come from the pack's required copy keys and cannot be removed; `extraInstructions` appends. `buildPatientContextBlock(patient, { session })` produces the treatment-context block with identifiers already tokenized on the shared allocator — the safe replacement for interpolating names into prompts.

## Advanced: composing the low-level API

`createRedactedChat` is the safe default. Reach for the primitives below only when you need to compose the pieces yourself (a custom loop, a non-default context window, your own turn orchestration). **When you do, you own threading the session** — the *same* `RedactionSession` instance must reach all four call sites, or the sites you skip stop redacting free-text names.

```ts
import {
  RedactionSession, // re-exported from @kerkit/core
  ContextAssembler,
  buildPatientContextBlock,
  buildSystemPrompt,
  defaultSources,
  runChatLoop,
} from '@kerkit/ai';
import { allTools, toToolSpecs, createToolExecutor } from '@kerkit/ai/mcp';
import { OpenAIResponsesAdapter } from '@kerkit/ai/openai';
import { createFixtureRepositories } from '@kerkit/ai/demo';
import { fixturePatient } from '@kerkit/core';
import { argentina } from '@kerkit/pack-argentina';
import OpenAI from 'openai';

const repos = createFixtureRepositories(); // any KerkitRepositories implementation

// ONE session — the same instance must reach all four call sites below.
const session = new RedactionSession({ patterns: argentina.identifierPatterns ?? [] });
const userId = fixturePatient.userId;

// 1) Patient block — mints the patient-name token on the shared allocator.
const patient = buildPatientContextBlock(fixturePatient, {
  allowSensitiveFields: ['treatmentPhase'],
  session,
});
const instructions = buildSystemPrompt({
  pack: argentina,
  assistantName: 'Aidé',
  careContextBlock: patient.block,
});

// 2) Context assembly — the same session sweeps the assembled window.
const assembler = new ContextAssembler({ pack: argentina });
for (const source of defaultSources(repos, argentina)) assembler.add(source);
const ctx = await assembler.assemble(userId, { session });

// 3) Tool context — the same session sweeps every tool's output.
const executeTool = createToolExecutor(allTools, { userId, repos, pack: argentina, session });

// 4) The loop — the same session is the provider sink.
const provider = new OpenAIResponsesAdapter(new OpenAI(), 'gpt-5-mini');
const result = await runChatLoop({
  provider,
  pack: argentina,
  instructions,
  messages: [{ role: 'user', content: '¿Cómo viene el trámite de la medicación?' }],
  tools: toToolSpecs(allTools),
  executeTool,
  session, // omit this and the sink is off — free-text names LEAK
});
```

Omit `session` at any of those four sites and that site stops redacting free-text names — the exact footgun `createRedactedChat` closes. `runChatLoop` fires a one-time `KRK_NO_SESSION` warning when it sees a patient context (placeholder tokens) reach the sink without a session, so the regression is loud rather than silent.

Loop semantics: max 5 rounds by default; tool errors are reported to the model, not thrown; provider state is opaque (`OpenAIResponsesAdapter` ships, other providers are a contribution-sized adapter away — kerkit's message shapes are the only public surface).

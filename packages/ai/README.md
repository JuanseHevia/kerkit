# @kerkit/ai

The AI layer for caretaker apps: a **redaction-enforced context window**, a provider-agnostic tool-calling loop, an MCP tool toolkit, and prompt conventions with non-removable privacy blocks.

> ⚠️ Not a medical device. The prompt conventions actively refuse medical advice — that block cannot be removed. See the project NOTICE.

## The flagship: ContextAssembler

Every caretaker app with an assistant needs the same thing: gather the user's world (appointments, trámites, prescriptions, notes), render it into model context, and *not leak identifiers while doing it*. The assembler makes the safe path the only path — redaction runs between fetch and format, so no source can bypass it:

```ts
import { ContextAssembler, defaultSources } from '@kerkit/ai';
import { argentina } from '@kerkit/pack-argentina';

const assembler = new ContextAssembler({ pack: argentina });
for (const source of defaultSources(repos, argentina)) assembler.add(source);

const ctx = await assembler.assemble(userId);
ctx.contextText   // redacted + swept — the only thing that reaches the model
ctx.redactionMap  // «NAME» → real value, for rehydration in your UI
ctx.explain()     // what was included/excluded/tokenized — show it to the user
```

`explain()` doubles as the transparency feature: "this is exactly what the assistant saw."

## The loop

```ts
import { runChatLoop } from '@kerkit/ai';
import { allTools, toToolSpecs, createToolExecutor } from '@kerkit/ai/mcp';
import { OpenAIResponsesAdapter } from '@kerkit/ai/openai';
import OpenAI from 'openai';

const provider = new OpenAIResponsesAdapter(new OpenAI(), 'gpt-5-mini');

const result = await runChatLoop({
  provider,
  pack: argentina,
  instructions: systemPrompt,
  messages: [{ role: 'user', content: '¿Cómo viene el trámite de la medicación?' }],
  tools: toToolSpecs(allTools),
  executeTool: createToolExecutor(allTools, { userId, repos, pack: argentina }),
});
```

Max 5 rounds by default; tool errors are reported to the model, not thrown; provider state is opaque (`OpenAIResponsesAdapter` ships, other providers are a contribution-sized adapter away — kerkit's message shapes are the only public surface).

## Tools

Nine tools: `read_appointments`, `read_prescriptions`, `read_authorizations`, `read_notes`, `read_checkpoints`, `write_note`, plus `read_email` / `read_calendar` / `read_documents` behind the optional `ExternalSources` interface (your Composio/Google glue implements it; tools degrade gracefully without it).

Tool outputs are redacted with the same discipline as assembled context — rows pass the structural classification pass and the identifier sweep before leaving the tool.

Run them in-process (`createToolExecutor`) or on an MCP server (`registerKerkitTools(server, allTools, { userMode: { kind: 'injected' } })` — in injected mode a missing `_userId` is a hard error; there is no fallback user).

## Prompts

`buildSystemPrompt({ pack, assistantName, … })` assembles identity + tone + privacy + boundaries. The privacy and not-medical-advice blocks come from the pack's required copy keys and cannot be removed; `extraInstructions` appends. `buildPatientContextBlock(patient)` produces the treatment-context block with identifiers already tokenized — the safe replacement for interpolating names into prompts.

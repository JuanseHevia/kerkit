---
"@kerkit/core": minor
"@kerkit/ai": minor
---

Enforce PII redaction at the provider boundary via a request-scoped `RedactionSession` (M1).

**Security note.** Prior to this release, apps calling `runChatLoop` without a manual token
sweep did **not** redact free-text patient/contact **names** in tool output, message history,
tool-error strings, external-tool output, or `write_note` echoes — only structured
`direct-identifier` fields and regex-matchable identifiers (DNI/CUIL) were covered. Names are
not regex-matchable, so a name hiding in a note's free text could reach the model. This release
closes that at a single sink.

**What's new**
- `RedactionSession` (`@kerkit/core`): one request-scoped, collision-safe token allocator +
  known-value sweep. Fixes the `«NAME»` token collision (two people no longer share a token) and
  is fail-closed (a sweep that throws drops to a placeholder, never raw).
- `createRedactedChat` (`@kerkit/ai`): the safe default — wires one session through the patient
  block, context assembly, tools, and the `runChatLoop` sink. Prefer it over hand-threading.
- A required `session` on `buildPatientContextBlock`, `ContextAssembler.assemble`,
  `redactedRowsResult`/`ToolContext`, MCP registration, and `runChatLoop`. Provider-bound
  messages and tool results use branded `RedactedText`, so sessionless setup and raw provider
  strings fail at compile time. `runChatLoop` results always include redaction metrics.
- MCP registration requires a per-call `createSession` factory and may emit token metadata via
  the app-side `onRedaction` callback. Original values never enter model-visible MCP content.
- Opt-in `pseudonymizeContacts` policy (default off) tokenizes Person/Institution
  phone/email/address; `Signal.sender` (inbound insurer address) is now always tokenized.

**Migration (breaking low-level API hardening)**
- Adopt `createRedactedChat`, or create one `RedactionSession` per request and thread it through
  context assembly, patient prompts, MCP/tool execution, and `runChatLoop`. Former optional or
  sessionless call sites intentionally no longer compile.
- Token shape changed for the session path (`«NAME»` → `«PATIENT_NAME_1»`). If you consume the
  public `redactionMap` / `tokens` maps, treat tokens as opaque and rehydrate through the map;
  don't hardcode token strings.

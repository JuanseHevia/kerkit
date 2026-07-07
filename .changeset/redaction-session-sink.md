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
- Optional `session?` on `buildPatientContextBlock`, `ContextAssembler.assemble`,
  `redactedRowsResult`/`ToolContext`, and `runChatLoop`. `runChatLoop` result gains
  `redaction` (tokens allocated, sweep matches, fail-closed count); a one-time warning fires if
  a patient context runs without a session.
- Opt-in `pseudonymizeContacts` policy (default off) tokenizes Person/Institution
  phone/email/address; `Signal.sender` (inbound insurer address) is now always tokenized.

**Migration (signature is non-breaking; two caveats)**
- The safe path is opt-in: to redact free-text names, adopt `createRedactedChat` (or thread one
  `RedactionSession`). Existing code compiles unchanged but only gains regex + structural
  coverage until you do. Order matters: thread the session, confirm your leak check is green,
  *then* delete any manual tool-output sweep.
- Token shape changed for the session path (`«NAME»` → `«PATIENT_NAME_1»`). If you consume the
  public `redactionMap` / `tokens` maps, treat tokens as opaque and rehydrate through the map;
  don't hardcode token strings.

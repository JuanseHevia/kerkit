---
"@kerkit/ai": patch
---

Docs: make `createRedactedChat` the canonical quickstart in `packages/ai/README.md`.

The package README now leads with the safe factory — one request-scoped
`RedactionSession` wired through the patient block, context assembly, tools, and
the provider sink — instead of the old low-level flow (`ContextAssembler` +
`runChatLoop` with a session-less tool context), which demonstrated the exact
free-text-name leak M1 closed. `runChatLoop` and manual session threading move to
an explicit "advanced" section where every example threads the same session
through all four call sites.

A new section spells out the redaction boundary: structural, row-level redaction
is proven but does **not**, on its own, catch an arbitrary name in free text — the
known-value sweep only recalls values the shared session has already tokenized,
so a brand-new free-text name can still reach the model. The model-emitted
message is not sink-swept; keep your own output leak-check.

The canonical snippet is now a CI compile gate: `src/readme-quickstart.example.ts`
type-checks the documented call under `npm run lint` (via `tsconfig.lint.json`),
without shipping in the package tarball.

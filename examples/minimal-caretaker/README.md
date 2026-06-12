# minimal-caretaker

A complete caretaker-app backend wired from kerkit packages, running in **demo mode**: synthetic persona, scripted assistant, no database, no OAuth, no LLM key.

```bash
npm install        # from the repo root
npm run dev        # from this directory → http://localhost:3010
```

Then:

```bash
# The caretaker context window — redacted, with the transparency report
curl http://localhost:3010/context

# Chat through the real tool-calling loop (scripted model)
curl -X POST http://localhost:3010/chat \
  -H 'content-type: application/json' \
  -d '{"message":"¿Cómo viene el trámite de la medicación?"}'

# The data-rights surface
curl http://localhost:3010/privacy/export
```

## What to look at

- [src/app.ts](./src/app.ts) — the whole backend in ~100 lines. The interesting part is what you *don't* see: redaction happens inside `ContextAssembler` and the tools; the demo cannot leak the synthetic DNI even if it tries.
- [src/mock-provider.ts](./src/mock-provider.ts) — the `ProviderAdapter` seam. Going real is two changes: `new OpenAIResponsesAdapter(new OpenAI(), 'gpt-5-mini')` instead of `MockProvider`, and `createKerkitRepositories(db, tables)` (from `@kerkit/server`, with Postgres) instead of the fixture repos.
- `GET /context` → `explain` — the report of what was included, dropped, tokenized, and swept. Ship this to your users as "what the assistant sees".

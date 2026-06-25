# kerkit · Showcase Gallery

A visual, container-runnable tour of the kerkit SDK. Three live scenes over the
canonical synthetic persona — no database, no OAuth, **no API key** — so you can
*see* what the SDK does before integrating it.

| Scene | What it shows | SDK surface |
| --- | --- | --- |
| **Privacy X-Ray** | Raw entity vs. exactly what an LLM is allowed to see — tokenized identifiers, gated health fields, and a regex sweep over free text. | `redactEntityForLlm`, `sweepText`, field classifications |
| **Caretaker Assistant** | The real provider-agnostic tool-calling loop with a visible trace and a "no PII leaked" check. Runs offline. | `runChatLoop`, `@kerkit/ai/mcp`, `ContextAssembler` |
| **Treatment & Tasks** | Cycle progress, care events with prep/authorization needs, and a dependency-aware checklist roll-up. | `cycleProgress`, `resolveCareEventKind`, `checklistProgress` |

## Run it

### Docker (one command; the app runs offline)

```bash
# from this directory
docker compose up
# → http://localhost:3010
```

The first build downloads npm dependencies; once built, the app itself runs with
no network, no database, and no API key.

### Local dev (Vite + tsx, hot reload)

From the **repo root** — the gallery depends on the workspace packages, so build them once first:

```bash
npm install
npm run build                      # builds the @kerkit/* packages (and the gallery)
npm run dev -w kerkit-gallery      # web on :5173 (proxying /api → :3010)
```

Open <http://localhost:5173>. The Vite dev server proxies `/api` to the Express
backend on port 3010, which `npm run dev` starts alongside it.

### Use a real model (optional)

```bash
OPENAI_API_KEY=sk-... docker compose up
```

With a key set, the assistant swaps the scripted `MockProvider` for the real
OpenAI Responses adapter (`@kerkit/ai/openai`) via a tiny `fetch` client — the
loop, the tools, and the redaction boundary are identical either way.

## How it's wired

- **Backend** (`server/`) — the same wiring as
  [`examples/minimal-caretaker`](../minimal-caretaker): fixture repositories
  (`@kerkit/ai/demo`), the `@kerkit/pack-argentina` locale pack, the audited
  privacy router (`@kerkit/server`), and a handful of read endpoints under
  `/api` for the scenes. The server is authoritative for all SDK logic, so what
  you see really is what the model would receive.
- **Frontend** (`web/`) — Vite + React + Tailwind. The theme transcribes
  `@kerkit/ui`'s "Calm Confidence" tokens into CSS variables.
- **Data** — every datum is read from `@kerkit/core` fixtures (the allow-listed
  synthetic persona). The gallery is `private`, so it never ships to npm.

> Not a medical device, not a clinical record. The Spanish content is the
> `@kerkit/pack-argentina` locale pack doing its job.

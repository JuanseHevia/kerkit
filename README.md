# kerkit

**Building blocks for caretaker apps.** An open-source SDK extracted from a real app used to manage a chemotherapy patient's treatment in Argentina's obra social system.

> ⚠️ **kerkit is not a medical device and does not provide medical advice.** It models caretaker-authored *logistics* data — appointments, trámites, prescriptions-as-documents, notes — not clinical records. See [NOTICE](./NOTICE).

## See it in action

The **[Showcase Gallery](./examples/gallery)** is a visual, container-runnable tour of the SDK — three live scenes over a synthetic persona, with no database, no OAuth, and **no API key**. One command:

```bash
cd examples/gallery && docker compose up   # → http://localhost:3010
```

[![kerkit Showcase Gallery](./docs/assets/gallery/landing.png)](./examples/gallery)

### 🛡️ Privacy X-Ray — *see exactly what the model receives*

The same entity, twice: raw data on the left, the redacted projection on the right. Direct identifiers become tokens, sensitive health fields are gated behind an explicit opt-in, and a regex sweep catches PII hiding in free text.

<p align="center">
  <img src="./docs/assets/gallery/privacy-xray.png" width="49%" alt="Privacy X-Ray: raw vs. redacted" />
  <img src="./docs/assets/gallery/privacy-sweep.png" width="49%" alt="Free-text identifier sweep" />
</p>

### 💬 Caretaker Assistant — *a real tool-calling loop, zero leaks*

The provider-agnostic `runChatLoop` over fixture data, with a visible tool-call trace and a leak check that proves the raw identifiers never reach the model. Runs offline on a scripted provider; set `OPENAI_API_KEY` for the real thing.

![Caretaker Assistant: tool trace + leak check](./docs/assets/gallery/assistant.png)

### 📊 Treatment & Tasks — *the caretaker domain, computed*

Treatment cycle progress, upcoming care events that know their prep and authorization needs, and a dependency-aware checklist roll-up — straight from the core domain functions.

![Treatment & Tasks dashboard](./docs/assets/gallery/dashboard.png)

## Is this for me?

| You are… | Use |
|---|---|
| Building a caretaker app **for Argentina** (obra social, trámites, recetas) | Everything: `core` + `pack-argentina` + `ai` + `ui` + `server` |
| Building a caretaker app **elsewhere in LatAm / es** | `core` + `ai` (+ `ui`); fork `pack-argentina` as the template for your locale pack |
| Building **in English / another system** | `core` + `ai` are locale-neutral; you write the pack. Expect Argentina-shaped reference data |
| **Curious / evaluating** | Start with `examples/minimal-caretaker` (runs with zero OAuth and no LLM key) |

Argentina-first is a feature, not an accident: the entities, the authorization state machine, and the email-signal patterns were proven against a real treatment at a real obra social.

## Why kerkit exists

A caretaker accompanying a chemo patient carries a second job: tracking authorizations that expire, prescriptions that lapse, studies that need pre-approval, and a dozen institutional email threads. Generic AI assistants can answer questions; they don't ship the **domain model**, the **privacy discipline**, or the **calm UI conventions** this situation demands. kerkit packages those three things so you can build the app your community needs.

## Packages

| Package | What it is | Status |
|---|---|---|
| `@kerkit/core` | Entities, Zod schemas, authorization state machine, care-event taxonomy, **privacy primitives** (classification, redaction, consent, audit), repository interfaces, locale-pack interface, synthetic fixtures | 🚧 0.x |
| `@kerkit/pack-argentina` | es-AR strings (voseo), obra social model, signal patterns, AR identifier redaction rules, Ley 25.326 docs | 🚧 0.x |
| `@kerkit/ai` | ContextAssembler (redaction-enforced caretaker context window), provider-agnostic tool-calling loop, MCP tool toolkit, prompt conventions | 🚧 0.x |
| `@kerkit/ui` | "Calm Confidence" design tokens (React Native components land in waves) | 🚧 0.x |
| `@kerkit/server` | Drizzle schema factory, repositories, consent/export/delete route factories with audit, cron skeletons | 🚧 0.x |

**Try it in two minutes** — [`examples/minimal-caretaker`](./examples/minimal-caretaker) runs the whole stack (context window, tool-calling chat, privacy endpoints) with no database, no OAuth, and no LLM key.

## Privacy is code here, not a paragraph

- Every entity field carries a **data classification** (`direct-identifier` / `sensitive-health` / `logistics` / `public`). CI fails if a field is unclassified.
- **Redaction before LLM calls** is enforced at the context-assembly boundary: direct identifiers become placeholder tokens; sensitive health fields pass only with explicit per-field opt-in in your code.
- **Consent, export, and delete** are first-class primitives, not roadmap items.
- System prompts ship with non-removable blocks: never ask the user for identifiers or credentials; never present as medical advice.

## License

[Apache-2.0](./LICENSE). See [NOTICE](./NOTICE) for scope disclaimers.

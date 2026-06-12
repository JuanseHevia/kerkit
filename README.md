# kerkit

**Building blocks for caretaker apps.** An open-source SDK extracted from a real app used to manage a chemotherapy patient's treatment in Argentina's obra social system.

> ⚠️ **kerkit is not a medical device and does not provide medical advice.** It models caretaker-authored *logistics* data — appointments, trámites, prescriptions-as-documents, notes — not clinical records. See [NOTICE](./NOTICE).

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
| `@kerkit/core` | Entities, Zod schemas, authorization state machine, care-event taxonomy, **privacy primitives** (classification, redaction, consent, audit), locale-pack interface, synthetic fixtures | 🚧 0.x |
| `@kerkit/pack-argentina` | es-AR strings (voseo), obra social model, signal patterns, AR identifier redaction rules, Ley 25.326 docs | planned |
| `@kerkit/ai` | ContextAssembler (redaction-enforced caretaker context window), provider-agnostic tool-calling loop, MCP tool toolkit, prompt conventions | planned |
| `@kerkit/ui` | "Calm Confidence" design tokens + React Native components | planned |
| `@kerkit/server` | Drizzle schema factory, repositories, consent/export/delete route factories, audit middleware | planned |

## Privacy is code here, not a paragraph

- Every entity field carries a **data classification** (`direct-identifier` / `sensitive-health` / `logistics` / `public`). CI fails if a field is unclassified.
- **Redaction before LLM calls** is enforced at the context-assembly boundary: direct identifiers become placeholder tokens; sensitive health fields pass only with explicit per-field opt-in in your code.
- **Consent, export, and delete** are first-class primitives, not roadmap items.
- System prompts ship with non-removable blocks: never ask the user for identifiers or credentials; never present as medical advice.

## License

[Apache-2.0](./LICENSE). See [NOTICE](./NOTICE) for scope disclaimers.

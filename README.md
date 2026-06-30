# kerkit

**Building blocks for caretaker apps.** An open-source TypeScript SDK extracted from a real app used to manage a chemotherapy patient's treatment in Argentina's obra social system.

[![CI](https://github.com/JuanseHevia/kerkit/actions/workflows/ci.yml/badge.svg)](https://github.com/JuanseHevia/kerkit/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

> **Status: pre-1.0 — API may change between minor versions.** Not published to npm yet; use from source.

> ⚠️ **kerkit is not a medical device and does not provide medical advice.** It models caretaker-authored *logistics* data — appointments, trámites, prescriptions-as-documents, notes — not clinical records. See [NOTICE](./NOTICE).

## Table of contents

- [Quickstart](#quickstart)
- [Is this for me?](#is-this-for-me)
- [Why kerkit exists](#why-kerkit-exists)
- [See it in action](#see-it-in-action)
- [Packages](#packages)
- [Usage example](#usage-example)
- [Privacy model](#privacy-model)
- [Monorepo layout](#monorepo-layout)
- [Contributing](#contributing)
- [License](#license)

## Quickstart

**Prerequisites:** Node ≥ 22, npm ≥ 11 (ships with Node 22).

```bash
git clone https://github.com/JuanseHevia/kerkit.git
cd kerkit
npm install
npm run build
npm run test
```

All 11 tests should pass. Then run the zero-config demo — no database, no OAuth, no LLM key:

```bash
cd examples/minimal-caretaker
npm run dev   # → http://localhost:3010
```

**You're in if** the server starts and these return data:

```bash
# The caretaker context window — redacted, with a transparency report
curl http://localhost:3010/context

# A real tool-calling loop (scripted model — set OPENAI_API_KEY for the live thing)
curl -X POST http://localhost:3010/chat \
  -H 'content-type: application/json' \
  -d '{"message":"¿Cómo viene el trámite de la medicación?"}'

# Data rights surface
curl http://localhost:3010/privacy/export
```

## Is this for me?

| You are… | Use |
|---|---|
| Building a caretaker app **for Argentina** (obra social, trámites, recetas) | Everything: `core` + `pack-argentina` + `ai` + `ui` + `server` |
| Building a caretaker app **elsewhere in LatAm / es** | `core` + `ai` (+ `ui`); fork `pack-argentina` as the template for your locale pack |
| Building **in English / another system** | `core` + `ai` are locale-neutral; you write the pack |
| **Curious / evaluating** | Start with the [Showcase Gallery](#see-it-in-action) (one Docker command, no setup) |

Argentina-first is a feature, not an accident: the entities, the authorization state machine, and the email-signal patterns were proven against a real treatment at a real obra social.

## Why kerkit exists

A caretaker accompanying a chemo patient carries a second job: tracking authorizations that expire, prescriptions that lapse, studies that need pre-approval, and a dozen institutional email threads. Generic AI assistants can answer questions; they don't ship the **domain model**, the **privacy discipline**, or the **calm UI conventions** this situation demands. kerkit packages those three things so you can build the app your community needs.

## See it in action

The **[Showcase Gallery](./examples/gallery)** is a visual, container-runnable tour of the SDK — three live scenes over a synthetic persona, with no database, no OAuth, and no API key:

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

The provider-agnostic `runChatLoop` over fixture data, with a visible tool-call trace and a leak check that proves the raw identifiers never reach the model.

![Caretaker Assistant: tool trace + leak check](./docs/assets/gallery/assistant.png)

### 📊 Treatment & Tasks — *the caretaker domain, computed*

Treatment cycle progress, upcoming care events that know their prep and authorization needs, and a dependency-aware checklist roll-up — straight from the core domain functions.

![Treatment & Tasks dashboard](./docs/assets/gallery/dashboard.png)

## Packages

| Package | Purpose | Install |
|---|---|---|
| [`@kerkit/core`](./packages/core) | Entities, Zod schemas, authorization state machine, care-event taxonomy, privacy primitives, repository interfaces, synthetic fixtures | `npm i @kerkit/core` |
| [`@kerkit/pack-argentina`](./packages/pack-argentina) | es-AR strings (voseo), obra social model, email signal patterns, DNI/CUIL redaction rules, Ley 25.326 guidance | `npm i @kerkit/pack-argentina` |
| [`@kerkit/ai`](./packages/ai) | ContextAssembler (redaction-enforced context window), provider-agnostic tool-calling loop, MCP tool toolkit, prompt conventions | `npm i @kerkit/ai` |
| [`@kerkit/ui`](./packages/ui) | "Calm Confidence" design tokens; React Native components (shipping in waves) | `npm i @kerkit/ui` |
| [`@kerkit/server`](./packages/server) | Drizzle schema factory, repository implementations, consent/export/delete route factories with audit, cron skeletons | `npm i @kerkit/server` |

> All packages are `0.1.0` and not yet published. Until the first npm release, depend on them via npm workspaces (already set up in this monorepo).

## Usage example

```ts
import {
  CARE_EVENT_KINDS,
  isValidTransition,
  fixtureEntities,
} from '@kerkit/core';

// Query what a care event requires — no lookup tables, just TypeScript
const { chemo } = CARE_EVENT_KINDS;
console.log(chemo.requiresAuthorization);   // true
console.log(chemo.requiresPrep);            // true
console.log(chemo.typicalDurationMinutes);  // 240

// Drive the authorization state machine
isValidTransition('needed', 'requested');   // true
isValidTransition('confirmed', 'pending');  // false — confirmed is terminal

// Canonical synthetic persona, ready for tests and demos
const { patient, appointmentChemo, authorization } = fixtureEntities;
console.log(patient.name);                  // "Marta Pérez"
console.log(authorization.status);         // "pending"
```

Extending entities (add a field without forking): see [EXTENDING.md](./EXTENDING.md).

## Privacy model

Privacy is enforced in code, not documented in a paragraph:

- Every entity field carries a **data classification** (`direct-identifier` / `sensitive-health` / `logistics` / `public`). CI fails if a field is unclassified.
- **Redaction before LLM calls** is enforced at the context-assembly boundary inside `ContextAssembler`: direct identifiers become placeholder tokens; sensitive health fields pass only with explicit per-field opt-in in your code. Your app cannot accidentally leak them.
- **Consent, export, and delete** are first-class primitives in `@kerkit/server`, not roadmap items.
- System prompts ship with non-removable blocks: never ask the user for identifiers or credentials; never present as medical advice.

Deep dive: [`docs/anonymization-testing-framework.md`](./docs/anonymization-testing-framework.md).

## Monorepo layout

```
kerkit/
├── packages/
│   ├── core/            # Entities, schemas, domain logic, privacy primitives
│   ├── pack-argentina/  # Argentina locale pack
│   ├── ai/              # AI context assembly + tool-calling loop
│   ├── ui/              # Design tokens + React Native components
│   └── server/          # Drizzle schema, repositories, privacy routes
├── examples/
│   ├── minimal-caretaker/  # Zero-config demo server (no DB, no OAuth, no LLM key)
│   └── gallery/            # Visual Showcase Gallery (Docker)
└── docs/
    ├── anonymization-testing-framework.md
    └── domain-fidelity-review.md
```

**Tooling:** npm workspaces, [Turborepo](https://turbo.build/), [Zod](https://zod.dev/), [Drizzle ORM](https://orm.drizzle.team/), [Changesets](https://github.com/changesets/changesets), [gitleaks](https://github.com/gitleaks/gitleaks) (Argentine identifier rules).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution lanes, the PII rules (all examples use the canonical synthetic persona), and how to share domain knowledge as an eval scenario — no code required.

Bug fixes with tests and Argentine insurer data rows for `@kerkit/pack-argentina` are accepted without prior discussion. Everything else: open an issue first.

## License

[Apache-2.0](./LICENSE). See [NOTICE](./NOTICE) for scope disclaimers.

> ⚠️ **Not a medical device.** kerkit models logistics data authored by caretakers. It does not provide medical advice, clinical recommendations, or dosing guidance.

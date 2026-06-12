# @kerkit/pack-argentina

The Argentina locale pack for [kerkit](https://github.com/JuanseHevia/kerkit) — and the reference implementation of the `LocalePack` interface. Building for another country? Fork this package as your template.

## What's inside

- **es-AR strings** for every kerkit copy key, voseo throughout ("tenés", "podés", "mirá")
- **Insurer catalog** — obras sociales and prepagas for onboarding/autocomplete (names only; SLA data is illustrated on the synthetic demo insurer)
- **Signal patterns** — 12 email-classification rules generalized from production use of the obra social authorization workflow ("aprobada", "en preparación", "lista para retirar"…)
- **Identifier patterns** — DNI/CUIL/credential regexes that feed `@kerkit/core`'s redaction sweep, so Argentine identifiers never reach an LLM through free text
- **Locale rules** — 30-day receta validity, 5-day expiry alert window, 48h authorization deadline margin
- **Prompt tone + examples** — the assistant's voice: warm, attentive, precise; logistics, never medical advice
- **[docs/ley-25326.md](./docs/ley-25326.md)** — how kerkit's privacy primitives map to Argentine data-protection obligations

## Usage

```ts
import { argentina } from '@kerkit/pack-argentina';
import { getCopy, sweepText } from '@kerkit/core';

getCopy(argentina, 'status.authorization.escalation'); // 'Necesita atención'
sweepText(noteContent, argentina.identifierPatterns ?? []); // DNI/CUIL redacted
```

## Contributing

Insurer rows and pattern improvements are accepted without prior discussion. Prompt changes need an issue first (with eval results). Always use the synthetic persona — never real data.

---
"@kerkit/core": minor
"@kerkit/pack-argentina": minor
"@kerkit/ai": minor
---

Complete the deterministic M2 privacy gate and make provider safety structural.

- Add public typed PII patterns, confidence tiers, spans, and sync/async detector interfaces.
- Normalize NFKC text, zero-width/control characters, and identifier spacing while preserving
  original offsets; resolve overlaps deterministically and replace spans right-to-left.
- Make async detector failures fail closed at the provider boundary.
- Expand the Argentina pack with typed DNI, validated CUIL/CUIT, phone, email, credential, and
  labeled-address detection plus the versioned `es-ar-v1` adversarial corpus.
- Gate high-confidence corpus recall and structural redaction properties. Heuristic recall and
  false positives are reported with masked case diagnostics rather than blocking initially.

Free-text detection remains a measured, extensible defense and is not a guarantee over arbitrary
language. Consumers may add `PiiDetector` implementations for their own domains and locales.

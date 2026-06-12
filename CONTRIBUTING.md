# Contributing to kerkit

Thanks for being here. kerkit is maintained by one person; these lanes exist so your effort lands.

## Contribution lanes

**Accepted without prior discussion** (open a PR directly):
- Bug fixes with a test
- Argentine insurer data rows (OSDE, Swiss Medical, Galeno…) for `@kerkit/pack-argentina`
- Accessibility improvements
- Documentation fixes and translations of docs
- Test fixtures (synthetic data only — see PII rules below)

**Issue first, please** (let's agree on direction before you build):
- New locale packs
- Prompt changes — must include the eval delta (run the prompt eval set, report before/after)
- Entity/schema changes
- New LLM provider adapters

**Out of scope** (will be closed with thanks):
- A generic People/Events/Notes core refactor (this is a deliberate v2 question, tracked separately)
- Features that produce medical advice, dosing math, or clinical recommendations
- Swapping the ORM

## PII rules (non-negotiable)

- All fixtures, seeds, tests, and prompt examples use the canonical synthetic persona from `@kerkit/core/fixtures` ("Marta Pérez", DNI 12.345.678, "Obra Social Demo Salud"). Do not invent new fake-but-plausible people.
- Never paste real emails, names, identifiers, or screenshots containing them into issues or PRs.
- CI runs gitleaks with Argentine identifier rules on every push; a finding blocks merge.

## Dev setup

```bash
npm install
npm run build
npm run test
```

Versioning is lockstep across packages via [changesets](https://github.com/changesets/changesets) — run `npm run changeset` with your PR. Pre-1.0, a minor bump may be breaking; breaking changes are documented in the changelog.

## Sharing domain knowledge

If you're a caretaker (or build for them) and want to improve the assistant's behavior, open an issue with the **eval-scenario** template: the situation in your words, and what a good assistant response looks like. This is one of the most valuable contributions possible — no code required.

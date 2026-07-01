import { describe, expect, it } from 'vitest';
import { AR_CONTROLS } from './controls.js';
import { runComplianceSuite } from './harness.js';
import { createFixtureProbe, createLeakyProbe } from './fixture-probe.js';
import { ALL_PROFILES, type AppProfile } from './types.js';

describe('AR_CONTROLS catalog', () => {
  it('every control has a unique id', () => {
    const ids = AR_CONTROLS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every control is fully cited and applicable to at least one profile', () => {
    for (const control of AR_CONTROLS) {
      expect(control.appliesTo.length, `${control.id} appliesTo`).toBeGreaterThan(0);
      expect(control.basis.length, `${control.id} basis`).toBeGreaterThan(0);
      for (const basis of control.basis) {
        expect(basis.law, `${control.id} basis.law`).toBeTruthy();
        expect(basis.article, `${control.id} basis.article`).toBeTruthy();
        expect(basis.url, `${control.id} basis.url`).toMatch(/^https?:\/\//);
        expect(['verified', 'partial', 'sourced']).toContain(basis.confidence);
      }
    }
  });

  it('only verified/partial obligations become blocking automated checks', () => {
    // Honesty gate: nothing merely "sourced" should gate CI.
    for (const control of AR_CONTROLS) {
      if (control.check) {
        const confidences = control.basis.map((b) => b.confidence);
        expect(confidences.some((c) => c === 'verified' || c === 'partial')).toBe(true);
      }
    }
  });
});

describe('runComplianceSuite — fixture probe (green path)', () => {
  it('reports COMPLIANT for the synthetic persona', async () => {
    const report = await runComplianceSuite(createFixtureProbe({ profile: 'llm_assistant' }));
    expect(report.compliant).toBe(true);
    expect(report.results.some((r) => r.status === 'fail')).toBe(false);
  });

  it('runs the LLM-only controls under the llm_assistant profile', async () => {
    const report = await runComplianceSuite(createFixtureProbe({ profile: 'llm_assistant' }));
    const ids = report.results.map((r) => r.id);
    expect(ids).toContain('AR-REDACT-SINK');
    expect(ids).toContain('AR-LLM-CONSENT-GATE');
    const sink = report.results.find((r) => r.id === 'AR-REDACT-SINK');
    expect(sink?.status).toBe('pass');
  });

  it('surfaces operator attestations without auto-passing them', async () => {
    const report = await runComplianceSuite(createFixtureProbe({ profile: 'llm_assistant' }));
    expect(report.attestationsRequired.length).toBeGreaterThan(0);
    expect(report.attestationsRequired.every((r) => r.status === 'attest')).toBe(true);
    // Attestations never affect the compliant verdict.
    expect(report.compliant).toBe(true);
  });

  it('formats a citeable markdown report', async () => {
    const report = await runComplianceSuite(createFixtureProbe());
    const md = report.format('markdown');
    expect(md).toContain('Compliance report');
    expect(md).toContain('Ley 25.326');
  });
});

describe('profile gating', () => {
  it('does not run the e-prescription receipt check for a logistics app', async () => {
    const report = await runComplianceSuite(createFixtureProbe({ profile: 'logistics' }));
    expect(report.results.map((r) => r.id)).not.toContain('AR-EPRESCRIPTION-RECEIPT');
  });

  it('runs the e-prescription controls (incl. inherited clinical attestations) for an eprescription app', async () => {
    const report = await runComplianceSuite(createFixtureProbe({ profile: 'eprescription' }));
    const ids = report.results.map((r) => r.id);
    expect(ids).toContain('AR-EPRESCRIPTION-RECEIPT');
    expect(ids).toContain('AR-CLINICAL-ACCESS-48H'); // inherited via Ley 27.553 → 26.529
    expect(ids).toContain('AR-DIGITAL-SIGNATURE');
  });

  it('every profile produces a non-empty applicable control set', async () => {
    for (const profile of ALL_PROFILES as AppProfile[]) {
      const report = await runComplianceSuite(createFixtureProbe({ profile }));
      expect(report.results.length, `profile ${profile}`).toBeGreaterThan(0);
    }
  });
});

describe('runComplianceSuite — leaky probe (red path proves checks fail)', () => {
  it('reports NON-COMPLIANT', async () => {
    const report = await runComplianceSuite(createLeakyProbe({ profile: 'llm_assistant' }));
    expect(report.compliant).toBe(false);
  });

  it('fails exactly the controls the broken probe targets', async () => {
    const report = await runComplianceSuite(createLeakyProbe({ profile: 'llm_assistant' }));
    const failed = new Set(report.results.filter((r) => r.status === 'fail').map((r) => r.id));
    expect(failed).toContain('AR-REDACT-SINK');
    expect(failed).toContain('AR-LLM-CONSENT-GATE');
    expect(failed).toContain('AR-CONSENT-SENSITIVE');
    expect(failed).toContain('AR-AUDIT-NO-PII');
    expect(failed).toContain('AR-AUDIT-COMPLETE');
    expect(failed).toContain('AR-DSR-ERASURE');
    expect(failed).toContain('AR-DELETE-ORDER');
  });

  it('the redaction-sink failure names the leaked identifier', async () => {
    const report = await runComplianceSuite(createLeakyProbe({ profile: 'llm_assistant' }));
    const sink = report.results.find((r) => r.id === 'AR-REDACT-SINK');
    expect(sink?.status).toBe('fail');
    expect(sink?.evidence).toContain('12.345.678');
  });
});

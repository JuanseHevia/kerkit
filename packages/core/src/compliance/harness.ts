import { AR_CONTROLS } from './controls.js';
import type {
  AppProfile,
  ComplianceControl,
  ComplianceProbe,
  ComplianceReport,
  ControlResult,
  Jurisdiction,
} from './types.js';

export interface RunOptions {
  /** Defaults to the probe's declared profile. */
  profile?: AppProfile;
  jurisdiction?: Jurisdiction;
  /** Override the catalog (defaults to AR_CONTROLS). */
  controls?: ComplianceControl[];
}

const STATUS_ICON: Record<ControlResult['status'], string> = {
  pass: '✅',
  fail: '❌',
  skip: '⏭️',
  attest: '📋',
};

function buildReport(
  jurisdiction: Jurisdiction,
  profile: AppProfile,
  results: ControlResult[],
): ComplianceReport {
  const compliant = !results.some((r) => r.kind === 'check' && r.status === 'fail');
  const attestationsRequired = results.filter((r) => r.kind === 'attest');

  const format = (fmt: 'markdown' | 'text'): string => {
    const md = fmt === 'markdown';
    const lines: string[] = [];
    const header = `Compliance report — ${jurisdiction} / profile: ${profile}`;
    lines.push(md ? `# ${header}` : header);
    lines.push('');
    lines.push(
      `Result: ${compliant ? 'COMPLIANT' : 'NON-COMPLIANT'} ` +
        `(${results.filter((r) => r.status === 'pass').length} pass, ` +
        `${results.filter((r) => r.status === 'fail').length} fail, ` +
        `${results.filter((r) => r.status === 'skip').length} skip, ` +
        `${attestationsRequired.length} attestation(s) required)`,
    );
    lines.push('');
    for (const r of results) {
      const cite = r.basis.map((b) => `${b.law} ${b.article}`).join('; ');
      if (md) {
        lines.push(`- ${STATUS_ICON[r.status]} **${r.id}** — ${r.title}`);
        lines.push(`  - ${r.evidence}`);
        lines.push(`  - _${cite}_`);
      } else {
        lines.push(`${STATUS_ICON[r.status]} ${r.id}  ${r.title}`);
        lines.push(`    ${r.evidence}  [${cite}]`);
      }
    }
    return lines.join('\n');
  };

  return { jurisdiction, profile, results, compliant, attestationsRequired, format };
}

/**
 * Run the compliance conformance suite. Selects every control applicable to the
 * profile, runs the automated `check`s, and reports the rest as attestations.
 * Pure and deterministic given a deterministic probe — safe for CI gating.
 */
export async function runComplianceSuite(
  probe: ComplianceProbe,
  options: RunOptions = {},
): Promise<ComplianceReport> {
  const profile = options.profile ?? probe.profile;
  const jurisdiction = options.jurisdiction ?? probe.jurisdiction;
  const catalog = options.controls ?? AR_CONTROLS;

  const applicable = catalog.filter((c) => c.appliesTo.includes(profile));
  const results: ControlResult[] = [];

  for (const control of applicable) {
    const base = {
      id: control.id,
      title: control.title,
      category: control.category,
      appliesTo: control.appliesTo,
      basis: control.basis,
    };

    if (!control.check) {
      results.push({
        ...base,
        kind: 'attest',
        status: 'attest',
        evidence: 'Operator attestation required — not automatically verifiable.',
      });
      continue;
    }

    try {
      const outcome = await control.check(probe);
      results.push({ ...base, kind: 'check', status: outcome.status, evidence: outcome.evidence });
    } catch (err) {
      results.push({
        ...base,
        kind: 'check',
        status: 'fail',
        evidence: `check threw: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return buildReport(jurisdiction, profile, results);
}

import { useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import type { DataClass, FieldRow, XrayResponse } from '../lib/types';
import { DATA_CLASS } from '../theme/dataClass';
import { Card, ErrorBox, Pill, SceneHeader, Segmented, Spinner } from '../components/primitives';
import { ArrowIcon, LockIcon } from '../components/icons';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlight(text: string, needles: string[], className: string): ReactNode[] {
  const uniq = [...new Set(needles)].filter(Boolean).sort((a, b) => b.length - a.length);
  if (uniq.length === 0) return [text];
  const re = new RegExp(`(${uniq.map(escapeRegExp).join('|')})`, 'g');
  return text.split(re).map((part, i) =>
    uniq.includes(part) ? (
      <mark key={i} className={className}>
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

/** Highlight any «PLACEHOLDER» token (e.g. «NAME», «REDACTADO») in swept text. */
function highlightTokens(text: string, className: string): ReactNode[] {
  return text.split(/(«[^»]+»)/g).map((part, i) =>
    /^«[^»]+»$/.test(part) ? (
      <mark key={i} className={className}>
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function DataClassBadge({ dataClass }: { dataClass: DataClass }) {
  const s = DATA_CLASS[dataClass];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium"
      style={{ color: s.text, background: s.bg }}
    >
      {s.label}
    </span>
  );
}

function RawRow({ row }: { row: FieldRow }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line/70 py-2 last:border-0">
      <div className="min-w-0">
        <div className="font-mono text-[11px] text-ink-faint">{row.field}</div>
        <div className="mt-0.5 break-words font-mono text-[12.5px] text-ink">{row.raw ?? '—'}</div>
      </div>
      <DataClassBadge dataClass={row.dataClass} />
    </div>
  );
}

function ModelRow({ row }: { row: FieldRow }) {
  let value: ReactNode;
  if (row.disposition === 'tokenized') {
    value = (
      <span className="inline-flex items-center gap-1 rounded-md bg-[#E2EEF1] px-1.5 py-0.5 font-mono text-[12px] text-[#2E6E7E]">
        {row.llm}
      </span>
    );
  } else if (row.disposition === 'dropped') {
    value = (
      <span className="inline-flex items-center gap-1 font-mono text-[12px] text-ink-faint">
        <LockIcon className="h-3.5 w-3.5" /> omitido
      </span>
    );
  } else if (row.disposition === 'empty') {
    value = <span className="font-mono text-[12px] text-ink-faint">—</span>;
  } else if (row.disposition === 'swept') {
    value = (
      <span className="break-words font-mono text-[12.5px] text-ink">
        {highlightTokens(row.llm ?? '', 'rounded bg-forward-soft px-0.5 text-forward-deep')}
      </span>
    );
  } else {
    value = <span className="break-words font-mono text-[12.5px] text-ink">{row.llm ?? '—'}</span>;
  }

  return (
    <div className="flex items-start justify-between gap-3 border-b border-line/70 py-2 last:border-0">
      <div className="min-w-0">
        <div className="font-mono text-[11px] text-ink-faint">{row.field}</div>
        <div className="mt-0.5">{value}</div>
      </div>
      {row.disposition === 'allowed' ? (
        <Pill tone="warm" className="shrink-0">
          opt-in
        </Pill>
      ) : row.disposition === 'swept' ? (
        <Pill tone="ocean" className="shrink-0">
          swept
        </Pill>
      ) : null}
    </div>
  );
}

function Counts({ fields }: { fields: FieldRow[] }) {
  const n = (d: FieldRow['disposition']) => fields.filter((f) => f.disposition === d).length;
  const stats = [
    { label: 'tokenized', value: n('tokenized'), tone: 'ocean' as const },
    { label: 'health gated', value: n('dropped'), tone: 'danger' as const },
    { label: 'opt-in', value: n('allowed'), tone: 'warm' as const },
    { label: 'swept', value: n('swept'), tone: 'ocean' as const },
    { label: 'passthrough', value: n('passthrough'), tone: 'forward' as const },
  ].filter((s) => s.value > 0);
  return (
    <div className="flex flex-wrap gap-2">
      {stats.map((s) => (
        <Pill key={s.label} tone={s.tone}>
          <span className="font-semibold">{s.value}</span> {s.label}
        </Pill>
      ))}
    </div>
  );
}

function Legend() {
  return (
    <Card className="p-5">
      <div className="text-sm font-semibold text-ink">Field classification</div>
      <p className="mt-1 text-[13px] text-ink-soft">
        Each field is classified at compile time. The class decides what the model may see — missing
        classifications fail safe to <span className="font-mono">sensitive-health</span>.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(Object.keys(DATA_CLASS) as DataClass[]).map((k) => {
          const s = DATA_CLASS[k];
          return (
            <div key={k} className="flex items-start gap-2.5">
              <span className="mt-0.5 h-3 w-3 shrink-0 rounded-full" style={{ background: s.text }} />
              <div>
                <div className="text-[13px] font-medium text-ink">{s.label}</div>
                <div className="text-[12.5px] leading-snug text-ink-soft">{s.gloss}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Sweep({ sweep }: { sweep: NonNullable<XrayResponse['sweep']> }) {
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-ink">Free-text sweep</div>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            The field <span className="font-mono">{sweep.field}</span> is plain logistics text — but a
            DNI hides in the prose. The regex sweep (locale-pack patterns) catches it.
          </p>
        </div>
        <Pill tone="danger">
          {sweep.matches.length} caught
        </Pill>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            Before
          </div>
          <div className="rounded-xl border border-line bg-page/60 p-3 font-mono text-[12.5px] leading-relaxed text-ink">
            {highlight(sweep.before, sweep.matches, 'rounded bg-[#FBE9E7] px-0.5 text-[#C62828]')}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            After
          </div>
          <div className="rounded-xl border border-line bg-page/60 p-3 font-mono text-[12.5px] leading-relaxed text-ink">
            {highlightTokens(sweep.after, 'rounded bg-forward-soft px-0.5 text-forward-deep')}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function PrivacyXray() {
  const [entity, setEntity] = useState('patient');
  const { data, error, loading, reload } = useAsync<XrayResponse>(() => api.xray(entity), [entity]);

  return (
    <div>
      <SceneHeader eyebrow="Scene 01 · privacy-as-code" title="Privacy X-Ray">
        The same entity, twice: what you store versus what an LLM is allowed to see. Redaction runs at
        the assembly boundary — no source can opt out.
      </SceneHeader>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented
          value={entity}
          onChange={setEntity}
          options={(data?.options ?? [{ key: 'patient', label: 'Paciente' }]).map((o) => ({
            key: o.key,
            label: o.label,
          }))}
        />
        {data ? <Counts fields={data.fields} /> : null}
      </div>

      {loading && !data ? <Spinner label="Redacting…" /> : null}
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}

      {data ? (
        <div className="space-y-5 k-fade-in">
          <p className="max-w-3xl text-[14px] leading-relaxed text-ink-soft">{data.blurb}</p>

          <div className="grid items-start gap-4 md:grid-cols-[1fr_auto_1fr]">
            <Card className="p-5">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#C4956A]" />
                <span className="text-[13px] font-semibold text-ink">What you store</span>
                <span className="ml-auto font-mono text-[11px] text-ink-faint">{data.label}</span>
              </div>
              <div>
                {data.fields.map((f) => (
                  <RawRow key={f.field} row={f} />
                ))}
              </div>
            </Card>

            <div className="hidden items-center justify-center self-center md:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card text-forward-deep shadow-card">
                <ArrowIcon className="h-4 w-4" />
              </div>
            </div>

            <Card className="border-forward/30 p-5">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-forward" />
                <span className="text-[13px] font-semibold text-ink">What the model sees</span>
                <span className="ml-auto font-mono text-[11px] text-forward-deep">redactEntityForLlm()</span>
              </div>
              <div>
                {data.fields.map((f) => (
                  <ModelRow key={f.field} row={f} />
                ))}
              </div>
            </Card>
          </div>

          {data.sweep ? <Sweep sweep={data.sweep} /> : null}

          <Legend />
        </div>
      ) : null}
    </div>
  );
}

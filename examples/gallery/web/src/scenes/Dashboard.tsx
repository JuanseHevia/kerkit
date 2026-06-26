import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { fmtDate, fmtDateTime, pct } from '../lib/format';
import type { CareEvent, DashboardResponse, TaskRow } from '../lib/types';
import { Card, ErrorBox, Pill, SceneHeader, Spinner } from '../components/primitives';
import { ProgressRing } from '../components/ProgressRing';
import { CheckIcon, LockIcon } from '../components/icons';

type Tone = 'forward' | 'warm' | 'ocean' | 'neutral' | 'danger';

function authTone(status: string): Tone {
  if (status === 'confirmed') return 'forward';
  if (status === 'escalation') return 'danger';
  if (status === 'requested' || status === 'pending') return 'warm';
  return 'neutral';
}

function TreatmentCard({ t }: { t: DashboardResponse['treatment'] }) {
  return (
    <Card className="p-6">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        <ProgressRing fraction={t.fraction}>
          <div className="font-display text-2xl font-semibold text-ink">
            {t.completedSessions}/{t.totalSessions}
          </div>
          <div className="text-[11px] uppercase tracking-wide text-ink-faint">sessions</div>
        </ProgressRing>
        <div className="flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Treatment plan
          </div>
          <div className="mt-1 font-display text-xl text-ink">{t.protocolLabel}</div>
          <div className="mt-3 grid grid-cols-2 gap-y-3 text-[13px]">
            <div>
              <div className="text-ink-faint">Current cycle</div>
              <div className="font-medium text-ink">
                {t.currentCycle ?? '—'} of {t.cycleCount}
              </div>
            </div>
            <div>
              <div className="text-ink-faint">Session in cycle</div>
              <div className="font-medium text-ink">{t.sessionInCycle}</div>
            </div>
            <div>
              <div className="text-ink-faint">Progress</div>
              <div className="font-medium text-forward-deep">{pct(t.fraction)}</div>
            </div>
            <div>
              <div className="text-ink-faint">Next session (est.)</div>
              <div className="font-medium text-ink">{fmtDate(t.nextSessionEstimate)}</div>
            </div>
          </div>
          <p className="mt-3 text-[11.5px] leading-snug text-ink-faint">
            Descriptive orientation only — <span className="font-mono">cycleProgress()</span> /{' '}
            <span className="font-mono">nextExpectedSession()</span>. Never a clinical schedule.
          </p>
        </div>
      </div>
    </Card>
  );
}

function CareEventCard({ e }: { e: CareEvent }) {
  return (
    <div className="rounded-card border border-line bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-forward-soft px-1.5 py-0.5 text-[11px] font-semibold text-forward-deep">
              {e.kindLabel}
            </span>
            <span className="text-[12px] text-ink-faint">{fmtDateTime(e.date)}</span>
          </div>
          <div className="mt-1.5 font-medium text-ink">{e.title}</div>
          <div className="mt-0.5 text-[12.5px] text-ink-soft">
            {e.institution ?? '—'}
            {e.locationDetail ? ` · ${e.locationDetail}` : ''}
          </div>
        </div>
        {e.typicalDurationMinutes ? (
          <span className="shrink-0 text-[12px] text-ink-faint">~{e.typicalDurationMinutes}m</span>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {e.requiresAuthorization ? (
          e.authorization ? (
            <Pill tone={authTone(e.authorization.status)}>auth · {e.authorization.statusLabel}</Pill>
          ) : (
            <Pill tone="neutral">auth required</Pill>
          )
        ) : null}
        {e.requiresPrep ? <Pill tone="neutral">prep</Pill> : null}
        {e.generatesResultDocument ? <Pill tone="ocean">result doc</Pill> : null}
      </div>
    </div>
  );
}

function TaskItem({ task }: { task: TaskRow }) {
  const done = task.status === 'done';
  const dependent = task.dependsOn.length > 0;
  const blocked = task.blocking.length > 0;
  return (
    <div className="flex items-start gap-3 border-b border-line/70 py-3 last:border-0">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          done ? 'border-forward bg-forward text-white' : 'border-line bg-card text-transparent'
        }`}
      >
        <CheckIcon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className={`text-[14px] ${done ? 'text-ink-faint line-through' : 'text-ink'}`}>
          {task.title}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Pill tone="neutral">{task.kindLabel}</Pill>
          <span className="text-[11.5px] text-ink-faint">due {fmtDate(task.dueDate)}</span>
          {dependent && blocked ? (
            <Pill tone="danger">
              <LockIcon className="h-3 w-3" /> blocked
            </Pill>
          ) : null}
          {dependent && !blocked && !done ? <Pill tone="forward">unblocked</Pill> : null}
        </div>
      </div>
      <span className="shrink-0 text-[11.5px] font-medium text-ink-faint">{task.statusLabel}</span>
    </div>
  );
}

function ChecklistCard({ c }: { c: NonNullable<DashboardResponse['checklist']> }) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Checklist
          </div>
          <div className="mt-1 font-display text-lg text-ink">{c.title}</div>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl font-semibold text-forward-deep">
            {pct(c.progress.fraction)}
          </div>
          <div className="text-[11px] text-ink-faint">
            {c.progress.done}/{c.progress.total} done
          </div>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-forward transition-all duration-700"
          style={{ width: pct(c.progress.fraction) }}
        />
      </div>
      <div className="mt-2">
        {c.tasks.map((t) => (
          <TaskItem key={t.id} task={t} />
        ))}
      </div>
    </Card>
  );
}

export function Dashboard() {
  const { data, error, loading, reload } = useAsync<DashboardResponse>(() => api.dashboard(), []);

  return (
    <div>
      <SceneHeader eyebrow="Scene 03 · the caretaker domain" title="Treatment & Tasks">
        The primitives a real care app runs on: treatment cycle progress, care events that know their
        prep and authorization needs, and a dependency-aware checklist — straight from the core domain
        functions.
      </SceneHeader>

      {loading && !data ? <Spinner label="Loading dashboard…" /> : null}
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}

      {data ? (
        <div className="space-y-5 k-fade-in">
          <TreatmentCard t={data.treatment} />

          <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-lg text-ink">Upcoming care events</h2>
                <span className="text-xs text-ink-faint">{data.careEvents.length} scheduled</span>
              </div>
              <div className="space-y-3">
                {data.careEvents.map((e) => (
                  <CareEventCard key={e.id} e={e} />
                ))}
              </div>
            </div>

            {data.checklist ? <ChecklistCard c={data.checklist} /> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

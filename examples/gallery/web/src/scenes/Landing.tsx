import { Link } from 'react-router-dom';
import { Card, Eyebrow, Pill } from '../components/primitives';
import { ArrowIcon, ChatIcon, PulseIcon, ShieldIcon } from '../components/icons';

const SCENES = [
  {
    to: '/privacy',
    icon: ShieldIcon,
    title: 'Privacy X-Ray',
    tagline: 'See exactly what the model receives.',
    body: 'Raw patient data on the left, the redacted projection on the right. Direct identifiers become tokens; health fields are gated; a regex sweep catches PII hiding in free text.',
    api: 'redactEntityForLlm · sweepText',
  },
  {
    to: '/assistant',
    icon: ChatIcon,
    title: 'Caretaker Assistant',
    tagline: 'A real tool-calling loop, zero leaks.',
    body: 'Chat against fixture data through the provider-agnostic loop. Every tool call is shown — and a leak check proves the raw identifiers never reach the model. Runs offline.',
    api: 'runChatLoop · @kerkit/ai/mcp',
  },
  {
    to: '/dashboard',
    icon: PulseIcon,
    title: 'Treatment & Tasks',
    tagline: 'The caretaker domain, computed.',
    body: 'Cycle progress, upcoming care events with their prep/authorization needs, and a dependency-aware checklist roll-up — all from the core domain functions.',
    api: 'cycleProgress · checklistProgress',
  },
];

const PACKAGES = ['@kerkit/core', '@kerkit/ai', '@kerkit/server', '@kerkit/pack-argentina'];

export function Landing() {
  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="k-fade-in overflow-hidden rounded-card border border-line bg-card shadow-card">
        <div className="k-dotgrid px-7 pb-9 pt-10 sm:px-10">
          <Eyebrow>The caretaker-app SDK · privacy is code, not a paragraph</Eyebrow>
          <h1 className="mt-3 max-w-3xl font-display text-[40px] font-semibold leading-[1.08] text-ink sm:text-[46px]">
            See what kerkit does for a care app — before you write a line.
          </h1>
          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-ink-soft">
            Three live scenes over a synthetic persona: the redaction boundary that keeps PII out of
            your LLM calls, a real assistant loop, and the domain primitives that model appointments,
            authorizations, treatment cycles, and chores.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <Pill tone="forward">
              <span className="h-1.5 w-1.5 rounded-full bg-forward" /> Runs offline · no API key
            </Pill>
            <Pill tone="ocean">One container</Pill>
            <Pill tone="neutral">Synthetic data only</Pill>
          </div>
          <div className="mt-6 inline-flex items-center gap-3 rounded-xl border border-line bg-page/70 px-4 py-2.5 font-mono text-[12.5px] text-ink-soft">
            <span className="text-forward-deep">$</span> docker compose up
            <span className="text-ink-faint">→ localhost:3010</span>
          </div>
        </div>
      </section>

      {/* Scene grid */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-xl text-ink">The gallery</h2>
          <span className="text-xs text-ink-faint">3 scenes</span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {SCENES.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.to}
                to={s.to}
                className="group flex flex-col rounded-card border border-line bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forward-soft text-forward-deep">
                  <Icon />
                </div>
                <h3 className="mt-4 font-display text-lg text-ink">{s.title}</h3>
                <p className="mt-0.5 text-sm font-medium text-forward-deep">{s.tagline}</p>
                <p className="mt-2 flex-1 text-[13.5px] leading-relaxed text-ink-soft">{s.body}</p>
                <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                  <span className="font-mono text-[11px] text-ink-faint">{s.api}</span>
                  <span className="flex items-center gap-1 text-sm font-medium text-ink transition-colors group-hover:text-forward-deep">
                    Open <ArrowIcon className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Built on */}
      <section className="flex flex-wrap items-center gap-2 text-xs text-ink-faint">
        <span className="mr-1">Built on</span>
        {PACKAGES.map((p) => (
          <span key={p} className="rounded-full border border-line bg-card px-2.5 py-1 font-mono text-ink-soft">
            {p}
          </span>
        ))}
      </section>

      {/* Starters */}
      <section>
        <Card className="p-6">
          <Eyebrow>Copy-me starter</Eyebrow>
          <h2 className="mt-1.5 font-display text-xl text-ink">Start from the minimal backend</h2>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-soft">
            The gallery is a tour; <span className="font-mono">examples/minimal-caretaker</span> is the
            template. A ~100-line Express server wiring the full stack — context assembly, the tool
            loop, and the audited privacy routes — with no database, no OAuth, and no LLM key.
          </p>
          <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-page/70 px-4 py-3 font-mono text-[12.5px] leading-relaxed text-ink-soft">
            <div>
              <span className="text-forward-deep">$</span> npm install &amp;&amp; npm run build
            </div>
            <div>
              <span className="text-forward-deep">$</span> npm run dev -w examples/minimal-caretaker
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}

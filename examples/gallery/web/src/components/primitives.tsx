import type { ReactNode } from 'react';

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-card border border-line bg-card shadow-card ${className}`}>{children}</div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
      {children}
    </div>
  );
}

export function SceneHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-7 k-fade-in">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="mt-1.5 font-display text-3xl leading-tight text-ink">{title}</h1>
      {children ? <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-soft">{children}</p> : null}
    </header>
  );
}

type Tone = 'forward' | 'warm' | 'ocean' | 'neutral' | 'danger';

const TONE: Record<Tone, { bg: string; text: string; ring: string }> = {
  forward: { bg: 'bg-forward-soft', text: 'text-forward-deep', ring: 'ring-forward/20' },
  warm: { bg: 'bg-[#F6ECE1]', text: 'text-[#9A6B3C]', ring: 'ring-warm/20' },
  ocean: { bg: 'bg-[#E2EEF1]', text: 'text-[#2E6E7E]', ring: 'ring-ocean/20' },
  neutral: { bg: 'bg-[#F0EFEA]', text: 'text-ink-soft', ring: 'ring-black/5' },
  danger: { bg: 'bg-[#FBE9E7]', text: 'text-[#C62828]', ring: 'ring-[#C62828]/20' },
};

export function Pill({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${t.bg} ${t.text} ${t.ring} ${className}`}
    >
      {children}
    </span>
  );
}

export function Mono({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono text-[12.5px] ${className}`}>{children}</span>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-ink-faint">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-forward" />
      {label ? <span className="text-sm">{label}</span> : null}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="p-6">
      <div className="text-sm font-semibold text-[#C62828]">No se pudo cargar</div>
      <p className="mt-1 font-mono text-xs text-ink-soft">{message}</p>
      {onRetry ? (
        <button
          onClick={onRetry}
          className="mt-3 rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
        >
          Reintentar
        </button>
      ) : null}
    </Card>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (key: T) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-line bg-card p-1 shadow-card">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              active ? 'bg-ink text-white' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

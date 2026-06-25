import { useRef, useState } from 'react';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { stringify } from '../lib/format';
import type { ChatResponse, ContextResponse, HealthResponse } from '../lib/types';
import { Card, Mono, Pill, SceneHeader, Spinner } from '../components/primitives';
import { CheckIcon, AlertIcon } from '../components/icons';

interface UserMsg {
  role: 'user';
  content: string;
}
interface AssistantMsg {
  role: 'assistant';
  res: ChatResponse;
}
type Msg = UserMsg | AssistantMsg;

const SUGGESTIONS = [
  '¿Cómo viene el trámite de la medicación?',
  '¿Qué turnos tengo?',
  '¿Tengo recetas por vencer?',
  'Mostrame las notas',
];

function ToolTrace({ res }: { res: ChatResponse }) {
  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {res.leakCheck.leaked ? (
          <Pill tone="danger">
            <AlertIcon className="h-3.5 w-3.5" /> PII leaked
          </Pill>
        ) : (
          <Pill tone="forward">
            <CheckIcon className="h-3.5 w-3.5" /> No PII leaked
          </Pill>
        )}
        <span className="text-[11px] text-ink-faint">
          {res.rounds} round{res.rounds === 1 ? '' : 's'} · {res.toolCalls.length} tool call
          {res.toolCalls.length === 1 ? '' : 's'}
        </span>
      </div>
      {res.toolCalls.map((t, i) => (
        <div key={i} className="rounded-xl border border-line bg-page/60 p-3">
          <div className="flex items-center gap-2">
            <Mono className="text-forward-deep">{t.name}()</Mono>
            {Object.keys(t.args).length > 0 ? (
              <Mono className="text-ink-faint">{JSON.stringify(t.args)}</Mono>
            ) : (
              <span className="text-[11px] text-ink-faint">no args</span>
            )}
          </div>
          <pre className="k-scroll mt-2 max-h-44 overflow-auto whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed text-ink-soft">
            {stringify(t.result)}
          </pre>
        </div>
      ))}
    </div>
  );
}

function ContextPeek() {
  const [open, setOpen] = useState(false);
  const { data } = useAsync<ContextResponse>(() => api.context(), []);

  return (
    <Card className="p-5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-sm font-semibold text-ink">The model's context window</span>
        <span className="font-mono text-[11px] text-forward-deep">{open ? 'hide' : 'inspect'}</span>
      </button>
      <p className="mt-1 text-[12.5px] leading-snug text-ink-soft">
        Everything — and only this — is what the assistant receives. Already redacted and swept.
      </p>
      {data ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Pill tone="ocean">{data.explain.sections.length} sections</Pill>
          <Pill tone="forward">{data.explain.sweptMatches} swept</Pill>
          <Pill tone="neutral">{data.redactionMap.length} tokens</Pill>
        </div>
      ) : null}
      {open && data ? (
        <pre className="k-scroll mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-page/60 p-3 font-mono text-[11.5px] leading-relaxed text-ink">
          {data.contextText}
        </pre>
      ) : null}
    </Card>
  );
}

export function Assistant() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const health = useAsync<HealthResponse>(() => api.health(), []);
  const listEnd = useRef<HTMLDivElement>(null);
  // Synchronous guard: state updates lag a click, so a ref prevents a rapid
  // second click from firing a duplicate request before `sending` flips.
  const inFlight = useRef(false);

  async function send(text: string, fromInput = false) {
    const message = text.trim();
    if (!message || inFlight.current) return;
    inFlight.current = true;
    setErr(null);
    setSending(true);
    if (fromInput) setInput('');
    setMessages((m) => [...m, { role: 'user', content: message }]);
    try {
      const res = await api.chat(message);
      setMessages((m) => [...m, { role: 'assistant', res }]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      inFlight.current = false;
      setSending(false);
      requestAnimationFrame(() => listEnd.current?.scrollIntoView({ behavior: 'smooth' }));
    }
  }

  return (
    <div>
      <SceneHeader eyebrow="Scene 02 · the assistant loop" title="Caretaker Assistant">
        The real <span className="font-mono">runChatLoop</span> over fixture data: the model asks for a
        kerkit tool, the tool returns redacted rows, the model answers. Watch the trace — the raw
        identifiers never appear.
      </SceneHeader>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        {/* Chat */}
        <Card className="flex min-h-[28rem] flex-col p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-ink">Chat</span>
            {health.data ? (
              <Pill tone={health.data.mode === 'openai' ? 'ocean' : 'neutral'}>
                {health.data.mode === 'openai' ? 'OpenAI provider' : 'mock provider'}
              </Pill>
            ) : null}
          </div>

          <div className="k-scroll flex-1 space-y-4 overflow-y-auto pr-1">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-10 text-center">
                <p className="max-w-xs text-[13.5px] text-ink-soft">
                  Ask about appointments, authorizations, prescriptions or notes — in Spanish, the way
                  the persona's caretaker would.
                </p>
              </div>
            ) : null}

            {messages.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-ink px-4 py-2.5 text-[14px] text-white">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[92%]">
                    <div className="rounded-2xl rounded-bl-sm border border-line bg-page/70 px-4 py-2.5 text-[14px] leading-relaxed text-ink">
                      {m.res.message}
                    </div>
                    <ToolTrace res={m.res} />
                  </div>
                </div>
              ),
            )}

            {sending ? <Spinner label="Thinking…" /> : null}
            <div ref={listEnd} />
          </div>

          {/* Suggestions */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                disabled={sending}
                className="rounded-full border border-line bg-card px-3 py-1.5 text-[12.5px] text-ink-soft transition-colors hover:border-forward/40 hover:text-ink disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input, true);
            }}
            className="mt-3 flex items-center gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribí un mensaje…"
              className="flex-1 rounded-full border border-line bg-card px-4 py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-faint focus:border-forward/50"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="rounded-full bg-forward px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:bg-forward-deep disabled:opacity-40"
            >
              Send
            </button>
          </form>
          {err ? <p className="mt-2 font-mono text-xs text-[#C62828]">{err}</p> : null}
        </Card>

        {/* Side panel */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className="text-sm font-semibold text-ink">How it works</div>
            <ol className="mt-2 space-y-2 text-[13px] leading-relaxed text-ink-soft">
              <li>
                <span className="font-mono text-ink">1</span> · your message + the redacted system
                prompt go to the provider.
              </li>
              <li>
                <span className="font-mono text-ink">2</span> · it calls a kerkit tool; rows come back{' '}
                <span className="font-mono">redactedRowsResult()</span>.
              </li>
              <li>
                <span className="font-mono text-ink">3</span> · the model answers from redacted data —
                identifiers stay home.
              </li>
            </ol>
          </Card>
          <ContextPeek />
        </div>
      </div>
    </div>
  );
}

import type {
  ChatResponse,
  ContextResponse,
  DashboardResponse,
  HealthResponse,
  XrayResponse,
} from './types';

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const api = {
  health: () => getJson<HealthResponse>('/api/health'),
  context: () => getJson<ContextResponse>('/api/context'),
  xray: (entity: string) => postJson<XrayResponse>('/api/privacy/xray', { entity }),
  chat: (message: string) => postJson<ChatResponse>('/api/chat', { message }),
  dashboard: () => getJson<DashboardResponse>('/api/dashboard'),
};

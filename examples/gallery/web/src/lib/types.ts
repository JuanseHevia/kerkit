export type DataClass = 'direct-identifier' | 'sensitive-health' | 'logistics' | 'public';
export type Disposition = 'tokenized' | 'allowed' | 'dropped' | 'passthrough' | 'swept' | 'empty';

export interface FieldRow {
  field: string;
  dataClass: DataClass;
  raw: string | null;
  llm: string | null;
  disposition: Disposition;
}

export interface XrayResponse {
  entity: string;
  label: string;
  blurb: string;
  options: { key: string; label: string }[];
  allowSensitiveFields: string[];
  raw: Record<string, string | null>;
  redacted: Record<string, string | null>;
  tokens: [string, string][];
  fields: FieldRow[];
  sweep: { field: string; before: string; after: string; matches: string[] } | null;
}

export interface SectionReport {
  key: string;
  heading: string;
  fetched: number;
  included: number;
  dropped: number;
  tokenizedFields: number;
  sensitiveAllowed: string[];
}

export interface ContextResponse {
  contextText: string;
  explain: { sections: SectionReport[]; sweptMatches: number };
  redactionMap: [string, string][];
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
}

export interface ChatResponse {
  message: string;
  rounds: number;
  toolCalls: ToolCall[];
  leakCheck: { nationalId: string; name: string; leaked: boolean };
}

export interface CareEvent {
  id: string;
  title: string;
  type: string;
  kindLabel: string;
  date: string;
  status: string;
  institution: string | null;
  locationDetail: string | null;
  requiresAuthorization: boolean;
  requiresPrep: boolean;
  generatesResultDocument: boolean;
  typicalDurationMinutes: number | null;
  authorization: { status: string; statusLabel: string; description: string } | null;
}

export interface TaskRow {
  id: string;
  title: string;
  kind: string;
  kindLabel: string;
  status: string;
  statusLabel: string;
  dueDate: string | null;
  dependsOn: string[];
  blocking: string[];
  canComplete: boolean;
}

export interface DashboardResponse {
  treatment: {
    protocolLabel: string;
    totalSessions: number;
    completedSessions: number;
    currentCycle: number | null;
    cycleCount: number;
    sessionInCycle: number;
    fraction: number;
    lastSessionDate: string;
    nextSessionEstimate: string | null;
  };
  careEvents: CareEvent[];
  checklist: {
    title: string;
    kind: string;
    progress: { total: number; done: number; fraction: number; complete: boolean };
    tasks: TaskRow[];
  } | null;
}

export interface HealthResponse {
  ok: boolean;
  mode: 'mock' | 'openai';
}

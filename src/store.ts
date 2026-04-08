export interface TraceEntry {
  method: string;
  url: string;
  status: number;
  traceId: string;
  timestamp: number;
  requestBody?: string;
  responseBody?: string;
  queryParams?: Record<string, string>;
  cookies?: Record<string, string>;
  pageHref: string;
}

const MAX_ENTRIES = 50;

type Listener = () => void;

const entries: TraceEntry[] = [];
const listeners: Set<Listener> = new Set();

export function addTrace(entry: TraceEntry): void {
  entries.unshift(entry);
  if (entries.length > MAX_ENTRIES) {
    entries.pop();
  }
  listeners.forEach((fn) => fn());
}

export function getTraces(): readonly TraceEntry[] {
  return entries;
}

export function updateTraceBody(
  traceId: string,
  responseBody: string | undefined,
): void {
  const entry = entries.find((e) => e.traceId === traceId);
  if (entry) {
    entry.responseBody = responseBody;
    listeners.forEach((fn) => fn());
  }
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

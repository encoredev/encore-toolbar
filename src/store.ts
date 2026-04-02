export interface TraceEntry {
  method: string;
  url: string;
  traceId: string;
  timestamp: number;
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

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

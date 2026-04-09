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

const STORAGE_KEY = "encore-toolbar-traces";
const SETTINGS_KEY = "encore-toolbar-settings";

export interface Settings {
  maxTraces: number;
  showLogTime: boolean;
  persistTraces: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  maxTraces: 25,
  showLogTime: false,
  persistTraces: false,
};

let settings: Settings = loadSettings();

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function getSettings(): Settings {
  return { ...settings };
}

export function updateSettings(partial: Partial<Settings>): void {
  settings = { ...settings, ...partial };
  saveSettings();

  if (entries.length > settings.maxTraces) {
    entries = entries.slice(0, settings.maxTraces);
  }

  if (settings.persistTraces) {
    persistEntries();
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }

  notifyListeners();
}

type Listener = () => void;

let entries: TraceEntry[] = loadEntries(settings);
const listeners: Set<Listener> = new Set();

function loadEntries(s: Settings): TraceEntry[] {
  if (!s.persistTraces) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as TraceEntry[];
      return parsed.slice(0, s.maxTraces);
    }
  } catch {}
  return [];
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function persistEntries(): void {
  if (!settings.persistTraces) return;
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, 500);
}

function notifyListeners(): void {
  listeners.forEach((fn) => fn());
}

export function addTrace(entry: TraceEntry): void {
  entries = [entry, ...entries];
  if (entries.length > settings.maxTraces) {
    entries = entries.slice(0, settings.maxTraces);
  }
  persistEntries();
  notifyListeners();
}

export function getTraces(): readonly TraceEntry[] {
  return entries;
}

export function updateTraceBody(
  traceId: string,
  responseBody: string | undefined,
): void {
  const idx = entries.findIndex((e) => e.traceId === traceId);
  if (idx >= 0) {
    entries = entries.map((e, i) =>
      i === idx ? { ...e, responseBody } : e
    );
    persistEntries();
    notifyListeners();
  }
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

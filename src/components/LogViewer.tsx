import { JSX } from "preact";
import { useState, useEffect } from "preact/hooks";
import { getTraceLogs, type LogEntry } from "../daemon";

const LOG_CACHE_MAX = 50;

type CacheEntry =
  | { state: "loading" }
  | { state: "loaded"; logs: LogEntry[] }
  | { state: "error"; error: Error };

const logCache = new Map<string, CacheEntry>();

function evictOldest(): void {
  if (logCache.size > LOG_CACHE_MAX) {
    const oldest = logCache.keys().next().value;
    if (oldest) logCache.delete(oldest);
  }
}

const LEVEL_ABBREV: Record<string, string> = {
  TRACE: "TRC", DEBUG: "DBG", INFO: "INF", WARN: "WRN", ERROR: "ERR",
};

function formatLogTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${h}:${m}:${s}.${ms}`;
}

interface Props {
  traceId: string;
  appId: string;
  showLogTime: boolean;
}

export function LogViewer({ traceId, appId, showLogTime }: Props): JSX.Element {
  const [state, setState] = useState<CacheEntry | null>(() => logCache.get(traceId) ?? null);

  useEffect(() => {
    const cached = logCache.get(traceId);
    if (cached) {
      setState(cached);
      return;
    }

    if (!appId) {
      setState(null);
      return;
    }

    logCache.set(traceId, { state: "loading" });
    evictOldest();
    setState({ state: "loading" });

    getTraceLogs(appId, traceId)
      .then((logs) => {
        const entry: CacheEntry = { state: "loaded", logs };
        logCache.set(traceId, entry);
        setState(entry);
      })
      .catch((err) => {
        const error = err instanceof Error ? err : new Error(String(err?.message ?? err));
        const entry: CacheEntry = { state: "error", error };
        logCache.set(traceId, entry);
        setState(entry);
      });
  }, [traceId, appId]);

  if (!state || state.state === "loading") {
    return <div class="log-loading">Loading logs...</div>;
  }

  if (state.state === "error") {
    return <div class="log-error">Failed to load logs: {state.error.message}</div>;
  }

  const logs = state.logs;
  if (logs.length === 0) {
    return <div class="log-empty">No logs for this trace</div>;
  }

  return (
    <div class="log-list">
      {logs.map((log, i) => {
        const abbrev = LEVEL_ABBREV[log.level] ?? log.level;
        const fieldKeys = Object.keys(log.fields);
        return (
          <div key={i} class="log-entry">
            {showLogTime && <span class="log-time">{formatLogTime(log.timestamp)}</span>}
            <span class={`log-level ${abbrev}`}>{abbrev}</span>
            <span class="log-msg">
              {log.message}
              {fieldKeys.length > 0 && (
                <span class="log-fields">
                  {" "}{fieldKeys.map((k) => (
                    <span key={k}>
                      <span class="log-field-key">{k}</span>=<span class="log-field-value">{String(log.fields[k])}</span>{" "}
                    </span>
                  ))}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

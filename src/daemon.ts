const DAEMON_WS_URL = "ws://localhost:9400/__encore";

let requestId = 1;

interface PendingRequest {
  resolve: (result: any) => void;
  reject: (error: any) => void;
}

function daemonRpc(method: string, params?: Record<string, unknown>): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(DAEMON_WS_URL);
      const pending = new Map<number, PendingRequest>();

      ws.addEventListener("open", () => {
        const id = requestId++;
        const msg: Record<string, unknown> = { jsonrpc: "2.0", id, method };
        if (params) msg.params = params;
        pending.set(id, {
          resolve: (result) => {
            ws.close();
            resolve(result);
          },
          reject: (error) => {
            ws.close();
            reject(error);
          },
        });
        ws.send(JSON.stringify(msg));
      });

      ws.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.id != null && pending.has(data.id)) {
            const req = pending.get(data.id)!;
            pending.delete(data.id);
            if (data.error) {
              req.reject(data.error);
            } else {
              req.resolve(data.result);
            }
          }
        } catch {
          // ignore parse errors
        }
      });

      ws.addEventListener("error", () => {
        reject(new Error("Failed to connect to Encore daemon"));
      });

      ws.addEventListener("close", () => {
        pending.forEach((req) => req.reject(new Error("Connection closed")));
        pending.clear();
      });
    } catch (err) {
      reject(err);
    }
  });
}

export interface DaemonApp {
  id: string;
  name: string;
  offline?: boolean;
}

export function listApps(): Promise<DaemonApp[]> {
  return daemonRpc("list-apps");
}

// --- Trace logs ---

export interface LogEntry {
  level: string;
  message: string;
  timestamp: Date;
  fields: Record<string, unknown>;
}

const LEVEL_MAP: Record<number, string> = {
  0: "DEBUG",
  1: "INFO",
  2: "ERROR",
  3: "WARN",
  4: "TRACE",
};

function parseLogFieldValue(field: Record<string, unknown>): unknown {
  if ("str" in field) return field.str;
  if ("int" in field) return field.int;
  if ("uint" in field) return field.uint;
  if ("float32" in field) return field.float32;
  if ("float64" in field) return field.float64;
  if ("bool" in field) return field.bool;
  if ("dur" in field) {
    const ns = Number(field.dur);
    if (ns >= 1e9) return `${(ns / 1e9).toFixed(2)}s`;
    if (ns >= 1e6) return `${(ns / 1e6).toFixed(2)}ms`;
    if (ns >= 1e3) return `${(ns / 1e3).toFixed(0)}µs`;
    return `${ns}ns`;
  }
  if ("error" in field) {
    const err = field.error;
    if (typeof err === "string") return err;
    if (err && typeof err === "object" && "msg" in err) return (err as { msg: string }).msg;
    return String(err);
  }
  if ("json" in field) {
    try {
      return JSON.parse(atob(field.json as string));
    } catch {
      return field.json;
    }
  }
  if ("time" in field) return field.time;
  if ("uuid" in field) return field.uuid;
  return undefined;
}

function extractLogs(events: any[]): LogEntry[] {
  const logs: LogEntry[] = [];
  for (const ev of events) {
    const lm = ev.span_event?.log_message;
    if (!lm) continue;

    const fields: Record<string, unknown> = {};
    if (lm.fields) {
      for (const f of lm.fields) {
        fields[f.key] = parseLogFieldValue(f);
      }
    }

    logs.push({
      level: LEVEL_MAP[lm.level] ?? "INFO",
      message: lm.msg ?? "",
      timestamp: ev.event_time ? new Date(ev.event_time) : new Date(0),
      fields,
    });
  }
  return logs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

export function getTraceLogs(appId: string, traceId: string): Promise<LogEntry[]> {
  return daemonRpc("traces/get", { app_id: appId, trace_id: traceId })
    .then((events: any[]) => extractLogs(events));
}

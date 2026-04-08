import { JSX } from "preact";
import { pathname, timeAgo } from "../utils";
import type { TraceEntry } from "../store";

interface Props {
  traces: TraceEntry[];
  selectedTraceId: string | null;
  traceUrl: (traceId: string, url: string) => string;
  onSelect: (traceId: string | null) => void;
}

export function TraceList({ traces, selectedTraceId, traceUrl, onSelect }: Props): JSX.Element {
  if (traces.length === 0) {
    return <div class="empty">No matching traces</div>;
  }

  const compact = selectedTraceId != null;

  function handleRowClick(traceId: string, e: MouseEvent): void {
    if ((e.target as HTMLElement).closest("a")) return;
    onSelect(selectedTraceId === traceId ? null : traceId);
  }

  return (
    <table class="trace-table">
      {traces.map((t) => (
        <tr
          key={t.traceId}
          class={`trace-row${t.traceId === selectedTraceId ? " selected" : ""}`}
          onClick={(e) => handleRowClick(t.traceId, e as unknown as MouseEvent)}
        >
          <td class="col-dot">
            <span class={`status-dot ${t.status < 400 ? "ok" : "error"}`} />
          </td>
          <td class="col-url" title={t.url}>{pathname(t.url)}</td>
          {!compact && (
            <>
              <td class={`col-status ${t.status < 400 ? "ok" : "error"}`}>{t.status}</td>
              <td class="col-method">{t.method}</td>
              <td class="col-age">{timeAgo(t.timestamp)}</td>
              <td class="col-link">
                <a href={traceUrl(t.traceId, t.url)} target="_blank" rel="noopener">trace &rarr;</a>
              </td>
            </>
          )}
        </tr>
      ))}
    </table>
  );
}

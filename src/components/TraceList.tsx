import { JSX } from "preact";
import { pathname, timeAgo, isSuccess } from "../utils";
import type { TraceEntry } from "../store";

interface Props {
  traces: TraceEntry[];
  selectedTraceId: string | null;
  traceUrl: (traceId: string, url: string) => string | null;
  onSelect: (traceId: string | null) => void;
  newTraceIds?: Set<string>;
}

export function TraceList({ traces, selectedTraceId, traceUrl, onSelect, newTraceIds }: Props): JSX.Element {
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
      {traces.map((t) => {
        const url = traceUrl(t.traceId, t.url);
        return (
          <tr
            key={t.traceId}
            class={`trace-row${t.traceId === selectedTraceId ? " selected" : ""}${newTraceIds?.has(t.traceId) ? " new-trace" : ""}`}
            onClick={(e) => handleRowClick(t.traceId, e as unknown as MouseEvent)}
          >
            <td class="col-dot">
              <span class={`status-dot ${isSuccess(t.status) ? "ok" : "error"}`} />
            </td>
            <td class="col-url" title={t.url}>{pathname(t.url)}</td>
            {!compact && (
              <>
                <td class={`col-status ${isSuccess(t.status) ? "ok" : "error"}`}>{t.status}</td>
                <td class="col-method">{t.method}</td>
                <td class="col-age">{timeAgo(t.timestamp)}</td>
                <td class="col-link">
                  {url
                    ? <a href={url} target="_blank" rel="noopener">trace &rarr;</a>
                    : <span class="trace-link no-url" onClick={(e) => {
                        e.stopPropagation();
                        const el = e.currentTarget as HTMLElement;
                        el.classList.add("show-hint");
                        setTimeout(() => el.classList.remove("show-hint"), 2500);
                      }}>
                        trace &rarr;
                        <span class="trace-link-tooltip">Trace link could not be created, see docs for more info</span>
                      </span>
                  }
                </td>
              </>
            )}
          </tr>
        );
      })}
    </table>
  );
}

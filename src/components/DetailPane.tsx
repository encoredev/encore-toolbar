import { JSX } from "preact";
import { useState } from "preact/hooks";
import { CollapsibleSection } from "./shared/CollapsibleSection";
import { Tab } from "./shared/Tab";
import { CloseIcon } from "./shared/icons";
import { Prompts } from "./Prompts";
import { LogViewer } from "./LogViewer";
import { JsonViewer } from "./JsonViewer";
import { timeAgo, formatJson, isSuccess } from "../utils";
import type { TraceEntry } from "../store";

interface Props {
  trace: TraceEntry;
  traceUrl: string | null;
  appId: string;
  showLogTime: boolean;
  onClose: () => void;
}

export function DetailPane({ trace, traceUrl, appId, showLogTime, onClose }: Props): JSX.Element {
  const [activeTab, setActiveTab] = useState<"request" | "prompts">("request");

  return (
    <>
      <div class="detail-header">
        <div class="detail-meta">
          <span class="col-method">{trace.method}</span>
          <span class={`col-status ${isSuccess(trace.status) ? "ok" : "error"}`}>{trace.status}</span>
          <span style="color:#666;font-size:11px">{timeAgo(trace.timestamp)}</span>
          {traceUrl
            ? <a class="trace-link" href={traceUrl} target="_blank" rel="noopener">View trace &rarr;</a>
            : <span class="trace-link no-url" onClick={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.classList.add("show-hint");
                setTimeout(() => el.classList.remove("show-hint"), 2500);
              }}>
                View trace &rarr;
                <span class="trace-link-tooltip">Fill in App ID to enable trace linking</span>
              </span>
          }
        </div>
        <button class="detail-close" onClick={onClose}><CloseIcon /></button>
      </div>
      <div class="detail-tabs">
        <Tab active={activeTab === "request"} onClick={() => setActiveTab("request")}>Request</Tab>
        <Tab active={activeTab === "prompts"} onClick={() => setActiveTab("prompts")}>Prompts</Tab>
      </div>
      {activeTab === "request" && (
        <div class="detail-tab-pane">
          <div class="detail-body">
            <CollapsibleSection label="URL" defaultOpen copyText={trace.url} contentClass="detail-url collapsible-content">
              {trace.url}
            </CollapsibleSection>

            {trace.queryParams && (
              <CollapsibleSection label="Query Params" defaultOpen copyText={JSON.stringify(trace.queryParams, null, 2)} contentClass="detail-content collapsible-content">
                <JsonViewer data={trace.queryParams} />
              </CollapsibleSection>
            )}

            {trace.cookies && (
              <CollapsibleSection label="Cookies" copyText={JSON.stringify(trace.cookies, null, 2)} contentClass="detail-content collapsible-content">
                <JsonViewer data={trace.cookies} />
              </CollapsibleSection>
            )}

            {trace.requestBody && (
              <CollapsibleSection label="Request Body" defaultOpen copyText={formatJson(trace.requestBody)} contentClass="detail-content collapsible-content">
                <JsonViewer raw={trace.requestBody} />
              </CollapsibleSection>
            )}

            <CollapsibleSection label="Response Body" defaultOpen copyText={formatJson(trace.responseBody)} contentClass="detail-content collapsible-content">
              <JsonViewer raw={trace.responseBody} />
            </CollapsibleSection>

            <CollapsibleSection label="Backend Logs" defaultOpen>
              <LogViewer traceId={trace.traceId} appId={appId} showLogTime={showLogTime} />
            </CollapsibleSection>
          </div>
        </div>
      )}
      {activeTab === "prompts" && (
        <div class="detail-tab-pane">
          <Prompts trace={trace} />
        </div>
      )}
    </>
  );
}

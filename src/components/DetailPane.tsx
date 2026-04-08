import { JSX } from "preact";
import { useState } from "preact/hooks";
import { CollapsibleSection } from "./shared/CollapsibleSection";
import { CloseIcon } from "./shared/icons";
import { Prompts } from "./Prompts";
import { LogViewer } from "./LogViewer";
import { JsonViewer } from "./JsonViewer";
import { timeAgo, formatJson } from "../utils";
import type { TraceEntry } from "../store";

interface Props {
  trace: TraceEntry;
  traceUrl: string;
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
          <span class={`col-status ${trace.status < 400 ? "ok" : "error"}`}>{trace.status}</span>
          <span style="color:#666;font-size:11px">{timeAgo(trace.timestamp)}</span>
          <a class="trace-link" href={traceUrl} target="_blank" rel="noopener">View trace &rarr;</a>
        </div>
        <button class="detail-close" onClick={onClose}><CloseIcon /></button>
      </div>
      <div class="detail-tabs">
        <button class={`tab${activeTab === "request" ? " active" : ""}`} onClick={() => setActiveTab("request")}>Request</button>
        <button class={`tab${activeTab === "prompts" ? " active" : ""}`} onClick={() => setActiveTab("prompts")}>Prompts</button>
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

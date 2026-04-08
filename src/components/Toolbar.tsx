import { JSX } from "preact";
import { useState, useRef, useEffect, useMemo } from "preact/hooks";
import { useTraces, useSettings } from "../hooks";
import { TraceList } from "./TraceList";
import { DetailPane } from "./DetailPane";
import { Filters, filterTraces, type FilterState } from "./Filters";
import { Settings } from "./Settings";
import { Placement, type Position } from "./Placement";
import { AppIdInput } from "./AppIdInput";
import { CloseIcon, GearIcon, InfoIcon, ENCORE_LOGO } from "./shared/icons";
import { isLocalUrl } from "../utils";

const REMOTE_TRACE_BASE_URL = "https://app.encore.dev/trace/";
const DEFAULT_PANEL_WIDTH = 450;
const MIN_PANEL_WIDTH = 300;
const MAX_PANEL_WIDTH = 800;

export interface ToolbarProps {
  appId?: string;
  envName?: string;
}

export function Toolbar({ appId: initialAppId, envName }: ToolbarProps): JSX.Element {
  const allTraces = useTraces();
  const [settings] = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"traces" | "placement">("traces");
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [appId, setAppId] = useState(initialAppId ?? "");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [position, setPosition] = useState<Position>(
    () => (localStorage.getItem("encore-toolbar-position") as Position) || "bottom-right"
  );
  const [panelWidth, setPanelWidth] = useState(
    () => Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH,
      parseInt(localStorage.getItem("encore-toolbar-width") ?? "", 10) || DEFAULT_PANEL_WIDTH))
  );

  const [filter, setFilter] = useState<FilterState>({
    selectedMethods: new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    pathRegex: null,
    errorsOnly: false,
  });

  const filteredTraces = useMemo(() => filterTraces(allTraces, filter), [allTraces, filter]);

  const isSidebar = position === "side-right" || position === "side-left";

  // Body push for sidebar mode
  const originalMarginsRef = useRef<{ left: number; right: number } | null>(null);

  useEffect(() => {
    if (!originalMarginsRef.current) {
      const cs = getComputedStyle(document.body);
      originalMarginsRef.current = {
        left: parseFloat(cs.marginLeft) || 0,
        right: parseFloat(cs.marginRight) || 0,
      };
    }

    if (isSidebar && isOpen) {
      const orig = originalMarginsRef.current;
      if (position === "side-right") {
        document.body.style.marginRight = `${orig.right + panelWidth}px`;
        document.body.style.marginLeft = "";
      } else {
        document.body.style.marginLeft = `${orig.left + panelWidth}px`;
        document.body.style.marginRight = "";
      }
      document.documentElement.style.overflowX = "hidden";
    } else {
      document.body.style.marginLeft = "";
      document.body.style.marginRight = "";
      document.documentElement.style.overflowX = "";
    }

    return () => {
      document.body.style.marginLeft = "";
      document.body.style.marginRight = "";
      document.documentElement.style.overflowX = "";
    };
  }, [isSidebar, isOpen, panelWidth, position]);

  function handlePositionChange(pos: Position): void {
    setPosition(pos);
    localStorage.setItem("encore-toolbar-position", pos);
  }

  // Panel resize (sidebar mode)
  function handlePanelResizeStart(e: MouseEvent): void {
    if (!isSidebar) return;
    e.preventDefault();
    const resizeEl = e.currentTarget as HTMLElement;
    resizeEl.classList.add("dragging");

    const onMouseMove = (ev: MouseEvent) => {
      let newWidth = position === "side-right"
        ? window.innerWidth - ev.clientX
        : ev.clientX;
      newWidth = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, newWidth));
      setPanelWidth(newWidth);
    };

    const onMouseUp = () => {
      resizeEl.classList.remove("dragging");
      localStorage.setItem("encore-toolbar-width", String(panelWidth));
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  function getTraceUrl(traceId: string, requestUrl: string): string {
    const aid = appId.trim();
    if (isLocalUrl(requestUrl) && aid) {
      return `http://localhost:9400/${encodeURIComponent(aid)}/envs/local/traces/${encodeURIComponent(traceId)}`;
    }
    if (aid && envName) {
      return `https://app.encore.cloud/${encodeURIComponent(aid)}/envs/${encodeURIComponent(envName)}/traces/${encodeURIComponent(traceId)}`;
    }
    return `${REMOTE_TRACE_BASE_URL}${encodeURIComponent(traceId)}`;
  }

  // Toggle/panel positioning
  const toggleStyle: Record<string, string> = {};
  const panelStyle: Record<string, string> = {};

  if (isSidebar) {
    const side = position === "side-right" ? "right" : "left";
    toggleStyle.bottom = "16px";
    toggleStyle[side] = "16px";
    panelStyle.top = "0";
    panelStyle.bottom = "0";
    panelStyle[side] = "0";
    panelStyle.width = `${panelWidth}px`;
    panelStyle.height = "100vh";
    panelStyle.maxHeight = "100vh";
    panelStyle.borderRadius = "0";
  } else {
    switch (position) {
      case "bottom-right":
        toggleStyle.bottom = "16px"; toggleStyle.right = "16px";
        panelStyle.bottom = "64px"; panelStyle.right = "16px";
        break;
      case "bottom-left":
        toggleStyle.bottom = "16px"; toggleStyle.left = "16px";
        panelStyle.bottom = "64px"; panelStyle.left = "16px";
        break;
      case "top-right":
        toggleStyle.top = "16px"; toggleStyle.right = "16px";
        panelStyle.top = "64px"; panelStyle.right = "16px";
        break;
      case "top-left":
        toggleStyle.top = "16px"; toggleStyle.left = "16px";
        panelStyle.top = "64px"; panelStyle.left = "16px";
        break;
    }
  }

  const selectedTrace = selectedTraceId ? filteredTraces.find((t) => t.traceId === selectedTraceId) : undefined;

  // If selected trace was filtered out, deselect
  useEffect(() => {
    if (selectedTraceId && !filteredTraces.find((t) => t.traceId === selectedTraceId)) {
      setSelectedTraceId(null);
    }
  }, [filteredTraces, selectedTraceId]);

  const sidebarClass = isSidebar
    ? position === "side-right" ? " sidebar-right" : " sidebar-left"
    : "";

  // Internal drag handle for resizing trace list vs detail pane
  const bodyRef = useRef<HTMLDivElement>(null);
  const traceListRef = useRef<HTMLDivElement>(null);

  function handleDragStart(e: MouseEvent): void {
    e.preventDefault();
    const dragEl = e.currentTarget as HTMLElement;
    dragEl.classList.add("dragging");

    const onMouseMove = (ev: MouseEvent) => {
      if (!bodyRef.current || !traceListRef.current) return;
      const rect = bodyRef.current.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const pct = Math.max(15, Math.min(85, (x / rect.width) * 100));
      traceListRef.current.style.width = `${pct}%`;
    };

    const onMouseUp = () => {
      dragEl.classList.remove("dragging");
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  return (
    <>
      {/* Toggle button */}
      <button class="toggle" style={toggleStyle} onClick={() => setIsOpen(!isOpen)}>
        <span dangerouslySetInnerHTML={{ __html: ENCORE_LOGO }} />
        <span class="badge">{allTraces.length > 0 ? allTraces.length : ""}</span>
      </button>

      {/* Panel */}
      <div class={`panel${isOpen ? " open" : ""}${sidebarClass}`} style={panelStyle}>
        {/* Title bar */}
        <div class="panel-title">
          <span class="panel-title-text">Encore Dev Toolbar</span>
          <span class="info-icon">
            <InfoIcon />
            <div class="info-tooltip">
              Automatically captures requests to your Encore backend. Click any trace to view request/response data, backend logs, and generate debugging prompts for your AI assistant. Set your App ID to enable trace linking and log fetching.{" "}
              <a href="https://encore.dev/docs" target="_blank" rel="noopener">Docs</a>
            </div>
          </span>
          <AppIdInput initialValue={initialAppId} onChange={setAppId} />
          <button class="close-btn" onClick={() => setIsOpen(false)}><CloseIcon /></button>
        </div>

        {/* Tabs */}
        <div class="panel-header">
          <button class={`tab${activeTab === "traces" ? " active" : ""}`} onClick={() => setActiveTab("traces")}>Traces</button>
          <button class={`tab${activeTab === "placement" ? " active" : ""}`} onClick={() => setActiveTab("placement")}>Placement</button>
        </div>

        {/* Traces page */}
        {activeTab === "traces" && (
          <div style={{ display: "flex", flexDirection: "column", flex: "1", minHeight: "0" }}>
            {/* Settings gear */}
            <div class="trace-settings-toggle">
              <button class={`trace-settings-btn${settingsOpen ? " active" : ""}`} onClick={() => setSettingsOpen(!settingsOpen)}>
                <GearIcon /> Settings
              </button>
            </div>
            {settingsOpen && <Settings />}
            <Filters onChange={setFilter} />

            {allTraces.length === 0 ? (
              <div class="empty">No traces yet</div>
            ) : (
              <div ref={bodyRef} class={`panel-body${selectedTrace ? " has-selection" : ""}`}>
                <div ref={traceListRef} class="trace-list">
                  <TraceList
                    traces={filteredTraces}
                    selectedTraceId={selectedTraceId}
                    traceUrl={getTraceUrl}
                    onSelect={setSelectedTraceId}
                  />
                </div>
                {selectedTrace && (
                  <>
                    <div class="drag-handle" onMouseDown={handleDragStart as any} />
                    <div class="detail-pane" style={{ display: "flex" }}>
                      <DetailPane
                        trace={selectedTrace}
                        traceUrl={getTraceUrl(selectedTrace.traceId, selectedTrace.url)}
                        appId={appId.trim()}
                        showLogTime={settings.showLogTime}
                        onClose={() => setSelectedTraceId(null)}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Placement page */}
        {activeTab === "placement" && (
          <Placement position={position} onPositionChange={handlePositionChange} />
        )}

        {/* Panel resize handle (sidebar) */}
        {isSidebar && (
          <div class="panel-resize" onMouseDown={handlePanelResizeStart as any} />
        )}
      </div>
    </>
  );
}

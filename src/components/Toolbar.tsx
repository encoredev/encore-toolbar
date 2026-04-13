import { JSX } from "preact";
import { useState, useRef, useEffect, useMemo, useCallback } from "preact/hooks";
import { useTraces, useSettings } from "../hooks";
import { TraceList } from "./TraceList";
import { DetailPane } from "./DetailPane";
import { Filters, filterTraces, DEFAULT_FILTER, type FilterState } from "./Filters";
import { Settings } from "./Settings";
import { Placement, type Position } from "./Placement";
import { AppIdInput } from "./AppIdInput";
import { Tab } from "./shared/Tab";
import { CloseIcon, GearIcon, InfoIcon, ENCORE_LOGO } from "./shared/icons";
import { isLocalUrl, startDrag } from "../utils";
import { getAppInfo, resolveAppInfo, resolveLocalAppSlug, awaitLocalAppSlug } from "../appinfo";

const DEFAULT_PANEL_WIDTH = 450;
const MIN_PANEL_WIDTH = 300;
const MAX_PANEL_WIDTH = 800;

export interface ToolbarProps {
  appId?: string;
  envName?: string;
}

export function Toolbar({ appId: initialAppId, envName: initialEnvName }: ToolbarProps): JSX.Element {
  const allTraces = useTraces();
  const [settings] = useSettings();
  const [isOpen, setIsOpen] = useState(() => localStorage.getItem("encore-toolbar-open") === "true");
  const [isHidden, setIsHidden] = useState(false);
  const [activeTab, setActiveTab] = useState<"traces" | "placement">("traces");
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [appId, setAppIdRaw] = useState(() => initialAppId ?? localStorage.getItem("encore-toolbar-app-id") ?? "");
  const [envName, setEnvNameRaw] = useState(() => initialEnvName ?? localStorage.getItem("encore-toolbar-env-name") ?? "");

  function setAppId(v: string): void { setAppIdRaw(v); localStorage.setItem("encore-toolbar-app-id", v); }
  function setEnvName(v: string): void { setEnvNameRaw(v); localStorage.setItem("encore-toolbar-env-name", v); }
  const [, forceRender] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [position, setPosition] = useState<Position>(
    () => (localStorage.getItem("encore-toolbar-position") as Position) || "bottom-right"
  );
  const [panelWidth, setPanelWidth] = useState(
    () => Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH,
      parseInt(localStorage.getItem("encore-toolbar-width") ?? "", 10) || DEFAULT_PANEL_WIDTH))
  );

  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [seenCount, setSeenCount] = useState(() => allTraces.length);
  const seenTraceIds = useRef(new Set(allTraces.map((t) => t.traceId)));

  const filteredTraces = useMemo(() => filterTraces(allTraces, filter), [allTraces, filter]);

  // Compute which traces should animate (not yet seen)
  const newTraceIds = useMemo(() => {
    if (!isOpen || activeTab !== "traces") return new Set<string>();
    const ids = new Set<string>();
    for (const t of filteredTraces) {
      if (!seenTraceIds.current.has(t.traceId)) {
        ids.add(t.traceId);
      }
    }
    return ids;
  }, [filteredTraces, isOpen, activeTab]);

  // Update badge count whenever traces change while viewing
  useEffect(() => {
    if (isOpen && activeTab === "traces") {
      setSeenCount(allTraces.length);
    }
  }, [isOpen, activeTab, allTraces.length]);

  // Sync seenTraceIds only on panel open / tab switch (not on every trace)
  // so that newTraceIds stays stable during the animation window
  useEffect(() => {
    if (isOpen && activeTab === "traces") {
      for (const t of allTraces) {
        seenTraceIds.current.add(t.traceId);
      }
    }
  }, [isOpen, activeTab]);

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
    let lastWidth = panelWidth;
    startDrag(e, (ev) => {
      lastWidth = position === "side-right"
        ? window.innerWidth - ev.clientX
        : ev.clientX;
      lastWidth = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, lastWidth));
      setPanelWidth(lastWidth);
    }, () => localStorage.setItem("encore-toolbar-width", String(lastWidth)));
  }

  const getTraceUrl = useCallback((traceId: string, requestUrl: string): string | null => {
    const info = getAppInfo(requestUrl);
    if (info === "pending") {
      resolveAppInfo(requestUrl).then(() => forceRender((n) => n + 1));
      return null;
    }
    let slug = info?.appSlug || appId.trim();
    const env = info?.envName || envName.trim();

    // Daemon fallback: local request, no healthz slug, no manual App ID.
    if (!slug && isLocalUrl(requestUrl)) {
      const local = resolveLocalAppSlug(requestUrl);
      if (local === "pending") {
        awaitLocalAppSlug(requestUrl).then(() => forceRender((n) => n + 1));
        return null;
      }
      if (local) slug = local;
    }

    if (!slug) return null;
    if (isLocalUrl(requestUrl)) {
      return `http://localhost:9400/${encodeURIComponent(slug)}/envs/local/traces/${encodeURIComponent(traceId)}`;
    }
    if (!env) return null;
    return `https://app.encore.cloud/${encodeURIComponent(slug)}/envs/${encodeURIComponent(env)}/traces/${encodeURIComponent(traceId)}`;
  }, [appId, envName]);

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
      case "middle-right":
        toggleStyle.top = "50%"; toggleStyle.right = "16px"; toggleStyle.transform = "translateY(-50%)";
        panelStyle.top = "50%"; panelStyle.right = "16px"; panelStyle.transform = "translateY(-50%)";
        break;
      case "middle-left":
        toggleStyle.top = "50%"; toggleStyle.left = "16px"; toggleStyle.transform = "translateY(-50%)";
        panelStyle.top = "50%"; panelStyle.left = "16px"; panelStyle.transform = "translateY(-50%)";
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
    startDrag(e, (ev) => {
      if (!bodyRef.current || !traceListRef.current) return;
      const rect = bodyRef.current.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const pct = Math.max(15, Math.min(85, (x / rect.width) * 100));
      traceListRef.current.style.width = `${pct}%`;
    });
  }

  if (isHidden) return <></>;

  return (
    <>
      {/* Toggle button */}
      <button class="toggle" style={toggleStyle} onClick={() => { const next = !isOpen; setIsOpen(next); localStorage.setItem("encore-toolbar-open", String(next)); }}>
        <span dangerouslySetInnerHTML={{ __html: ENCORE_LOGO }} />
        <span class="badge">{allTraces.length - seenCount > 0 ? allTraces.length - seenCount : ""}</span>
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
          <button class="close-btn" style={{ marginLeft: "auto" }} onClick={() => { setIsOpen(false); localStorage.setItem("encore-toolbar-open", "false"); }}><CloseIcon /></button>
        </div>

        {/* Tabs */}
        <div class="panel-header">
          <Tab active={activeTab === "traces"} onClick={() => setActiveTab("traces")}>Traces</Tab>
          <Tab active={activeTab === "placement"} onClick={() => setActiveTab("placement")}>Placement</Tab>
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
            {settingsOpen && (
              <>
                <Settings />
                <div class="trace-settings open" style={{ display: "flex" }}>
                  <AppIdInput initialAppId={appId} initialEnvName={envName} onAppIdChange={setAppId} onEnvNameChange={setEnvName} />
                </div>
              </>
            )}
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
                    newTraceIds={newTraceIds}
                  />
                </div>
                {selectedTrace && (
                  <>
                    <div class="drag-handle" onMouseDown={handleDragStart as any} />
                    <div class="detail-pane" style={{ display: "flex" }}>
                      {(() => {
                        const info = getAppInfo(selectedTrace.url);
                        const resolved = info !== null && info !== "pending" ? info : null;
                        const env = resolved?.envName || envName.trim();
                        const isLocal = env === "local";
                        const slug = resolved?.appSlug || appId.trim();
                        return (
                          <DetailPane
                            trace={selectedTrace}
                            traceUrl={getTraceUrl(selectedTrace.traceId, selectedTrace.url)}
                            appId={slug}
                            isLocalEnv={isLocal}
                            showLogTime={settings.showLogTime}
                            onClose={() => setSelectedTraceId(null)}
                          />
                        );
                      })()}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Placement page */}
        {activeTab === "placement" && (
          <Placement position={position} onPositionChange={handlePositionChange} onHide={() => setIsHidden(true)} />
        )}

        {/* Panel resize handle (sidebar) */}
        {isSidebar && (
          <div class="panel-resize" onMouseDown={handlePanelResizeStart as any} />
        )}
      </div>
    </>
  );
}

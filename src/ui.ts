import { getTraces, subscribe } from "./store";

const TRACE_BASE_URL = "https://app.encore.dev/trace/";

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "..." : str;
}

function getStyles(): string {
  return `
    :host {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      color: #e0e0e0;
    }

    .toggle {
      position: fixed;
      bottom: 16px;
      right: 16px;
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background: #1a1a2e;
      border: 1px solid #333;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }

    .toggle:hover {
      background: #252540;
    }

    .badge {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 16px;
      height: 16px;
      border-radius: 8px;
      background: #6c63ff;
      color: #fff;
      font-size: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
    }

    .badge:empty {
      display: none;
    }

    .panel {
      position: fixed;
      bottom: 64px;
      right: 16px;
      width: 380px;
      max-height: 400px;
      background: #1a1a2e;
      border: 1px solid #333;
      border-radius: 8px;
      z-index: 2147483647;
      display: none;
      flex-direction: column;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    }

    .panel.open {
      display: flex;
    }

    .panel-header {
      padding: 10px 12px;
      border-bottom: 1px solid #333;
      font-weight: 600;
      font-size: 12px;
      color: #999;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .panel-body {
      overflow-y: auto;
      flex: 1;
      max-height: 360px;
    }

    .trace-entry {
      padding: 8px 12px;
      border-bottom: 1px solid #2a2a3e;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .trace-entry:last-child {
      border-bottom: none;
    }

    .method {
      font-weight: 600;
      font-size: 11px;
      color: #6c63ff;
      flex-shrink: 0;
    }

    .url {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #ccc;
    }

    .trace-link {
      color: #6c63ff;
      text-decoration: none;
      font-size: 11px;
      flex-shrink: 0;
    }

    .trace-link:hover {
      text-decoration: underline;
    }

    .empty {
      padding: 24px 12px;
      text-align: center;
      color: #666;
    }
  `;
}

export function createWidget(): void {
  const host = document.createElement("div");
  host.id = "encore-trace-widget";
  const shadow = host.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = getStyles();
  shadow.appendChild(style);

  // Toggle button
  const toggle = document.createElement("button");
  toggle.className = "toggle";
  toggle.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`;

  const badge = document.createElement("span");
  badge.className = "badge";
  toggle.appendChild(badge);
  shadow.appendChild(toggle);

  // Panel
  const panel = document.createElement("div");
  panel.className = "panel";

  const header = document.createElement("div");
  header.className = "panel-header";
  header.textContent = "Encore Traces";
  panel.appendChild(header);

  const body = document.createElement("div");
  body.className = "panel-body";
  panel.appendChild(body);
  shadow.appendChild(panel);

  // Toggle behavior
  toggle.addEventListener("click", () => {
    panel.classList.toggle("open");
  });

  // Render function
  function render(): void {
    const traces = getTraces();
    badge.textContent = traces.length > 0 ? String(traces.length) : "";

    if (traces.length === 0) {
      body.innerHTML = `<div class="empty">No traces yet</div>`;
      return;
    }

    body.innerHTML = traces
      .map(
        (t) => `
        <div class="trace-entry">
          <span class="method">${t.method}</span>
          <span class="url" title="${t.url}">${truncate(t.url, 40)}</span>
          <a class="trace-link" href="${TRACE_BASE_URL}${t.traceId}" target="_blank" rel="noopener">trace &rarr;</a>
        </div>
      `
      )
      .join("");
  }

  subscribe(render);
  render();

  document.body.appendChild(host);
}

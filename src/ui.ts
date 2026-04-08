import { getTraces, subscribe, type TraceEntry } from "./store";
import { renderJson, unmountJson } from "./json-viewer";
import { listApps, getTraceLogs, type DaemonApp, type LogEntry } from "./daemon";

const REMOTE_TRACE_BASE_URL = "https://app.encore.dev/trace/";

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "..." : str;
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function pathname(url: string): string {
  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return url;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getStyles(): string {
  return `
    :host {
      all: initial;
      font-family: "Geist Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      color: #eaeaea;
    }

    .toggle {
      position: fixed;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: #000;
      border: 1px solid hsla(0,0%,100%,0.15);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
      box-shadow: 0 8px 30px rgba(0,0,0,0.12);
      transition: background 0.15s ease;
    }

    .toggle:hover {
      background: #111;
    }

    .badge {
      position: absolute;
      top: -6px;
      right: -6px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #fff;
      color: #000;
      font-size: 9px;
      font-weight: 700;
      border: 2px solid #000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }

    .badge:empty {
      display: none;
    }

    .panel {
      position: fixed;
      width: 450px;
      max-height: 70vh;
      background: #000;
      border: 1px solid hsla(0,0%,100%,0.15);
      border-radius: 12px;
      z-index: 2147483647;
      display: none;
      flex-direction: column;
      box-shadow: 0 8px 30px rgba(0,0,0,0.12);
    }

    .panel.open {
      display: flex;
    }

    .panel-title {
      padding: 10px 12px 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .app-id-wrapper {
      margin-left: 12px;
      position: relative;
      flex: 1;
    }

    .app-id-input {
      font-size: 11px;
      font-family: "Geist Mono", "SF Mono", monospace;
      color: #eaeaea;
      background: transparent;
      border: 1px solid hsla(0,0%,100%,0.1);
      border-radius: 6px;
      padding: 3px 8px;
      width: 100%;
      box-sizing: border-box;
      outline: none;
      transition: border-color 0.1s ease;
    }

    .app-id-input::placeholder {
      color: #ee5151;
    }

    .app-id-input.filled::placeholder {
      color: #555;
    }

    .app-id-hint {
      padding: 6px 10px;
      font-size: 10px;
      color: #888;
      line-height: 1.4;
      border-bottom: 1px solid hsla(0,0%,100%,0.08);
    }

    .app-id-input:focus {
      border-color: hsla(0,0%,100%,0.3);
    }

    .app-id-dropdown {
      display: none;
      position: absolute;
      top: calc(100% + 4px);
      right: 0;
      background: #111;
      border: 1px solid hsla(0,0%,100%,0.15);
      border-radius: 8px;
      padding: 4px 0;
      z-index: 10;
      min-width: 100%;
      max-height: 200px;
      overflow-y: auto;
      box-shadow: 0 8px 30px rgba(0,0,0,0.3);
    }

    .app-id-dropdown.open {
      display: block;
    }

    .app-id-option {
      padding: 4px 10px;
      font-size: 11px;
      color: #999;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: background 0.1s ease;
    }

    .app-id-option:hover {
      background: hsla(0,0%,100%,0.06);
      color: #eaeaea;
    }

    .app-id-option .app-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .app-id-option .app-dot.online {
      background: #50e3c2;
    }

    .app-id-option .app-dot.offline {
      background: #666;
    }

    .close-btn {
      margin-left: 6px;
      background: transparent;
      border: none;
      color: #999;
      cursor: pointer;
      display: flex;
      align-items: center;
      padding: 2px;
      border-radius: 4px;
      transition: color 0.1s ease;
    }

    .close-btn:hover {
      color: #eaeaea;
    }

    .panel-title-text {
      font-weight: 700;
      font-size: 13px;
      color: #eaeaea;
    }

    .info-icon {
      position: relative;
      display: flex;
      align-items: center;
      cursor: default;
    }

    .info-icon svg {
      color: #555;
      transition: color 0.1s ease;
    }

    .info-icon:hover svg {
      color: #999;
    }

    .info-tooltip {
      display: none;
      position: absolute;
      top: calc(100% + 2px);
      left: 50%;
      transform: translateX(-50%);
      background: #111;
      border: 1px solid hsla(0,0%,100%,0.15);
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 11px;
      color: #999;
      line-height: 1.5;
      white-space: normal;
      width: 240px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.3);
      z-index: 10;
      cursor: default;
    }

    .info-tooltip::before {
      content: "";
      position: absolute;
      top: -6px;
      left: 0;
      right: 0;
      height: 6px;
    }

    .info-tooltip a {
      color: #eaeaea;
      text-decoration: underline;
    }

    .info-icon:hover .info-tooltip,
    .info-tooltip:hover {
      display: block;
    }

    .panel-header {
      padding: 0;
      border-bottom: 1px solid hsla(0,0%,100%,0.1);
      display: flex;
      align-items: stretch;
    }

    .tab {
      padding: 8px 12px;
      font-weight: 600;
      font-size: 11px;
      color: #555;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      cursor: pointer;
      border: none;
      background: transparent;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      transition: color 0.1s ease;
    }

    .tab:hover {
      color: #888;
    }

    .tab.active {
      color: #eaeaea;
      border-bottom-color: #eaeaea;
    }

    .settings-page {
      padding: 16px 12px;
    }

    .settings-section {
      margin-bottom: 16px;
    }

    .settings-section:last-child {
      margin-bottom: 0;
    }

    .settings-label {
      font-size: 11px;
      font-weight: 600;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }

    .position-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }

    .position-grid.fixed {
      grid-template-columns: 1fr 1fr;
    }

    .position-option {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 12px;
      font-size: 11px;
      color: #888;
      background: transparent;
      border: 1px solid hsla(0,0%,100%,0.1);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.1s ease;
    }

    .position-option:hover {
      border-color: hsla(0,0%,100%,0.25);
      color: #ccc;
    }

    .position-option.active {
      background: hsla(0,0%,100%,0.1);
      border-color: hsla(0,0%,100%,0.25);
      color: #eaeaea;
    }

    .position-dot {
      width: 32px;
      height: 20px;
      border: 1px solid hsla(0,0%,100%,0.15);
      border-radius: 4px;
      position: relative;
      flex-shrink: 0;
    }

    .position-dot::after {
      content: "";
      position: absolute;
      width: 6px;
      height: 6px;
      border-radius: 2px;
      background: currentColor;
    }

    .position-option[data-position="bottom-right"] .position-dot::after {
      bottom: 2px;
      right: 2px;
    }

    .position-option[data-position="bottom-left"] .position-dot::after {
      bottom: 2px;
      left: 2px;
    }

    .position-option[data-position="top-right"] .position-dot::after {
      top: 2px;
      right: 2px;
    }

    .position-option[data-position="top-left"] .position-dot::after {
      top: 2px;
      left: 2px;
    }

    .position-option[data-position="side-right"] .position-dot::after {
      top: 2px;
      right: 2px;
      bottom: 2px;
      width: 3px;
      height: auto;
      border-radius: 1px;
    }

    .position-option[data-position="side-left"] .position-dot::after {
      top: 2px;
      left: 2px;
      bottom: 2px;
      width: 3px;
      height: auto;
      border-radius: 1px;
    }

    .panel-body {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: row;
      min-height: 0;
    }

    .trace-list {
      overflow-y: auto;
      flex: 1;
      padding-bottom: 12px;
      align-self: stretch;
    }

    .panel-body.has-selection .trace-list {
      flex: none;
      width: 35%;
      min-width: 80px;
    }

    .drag-handle {
      width: 4px;
      cursor: col-resize;
      background: hsla(0,0%,100%,0.1);
      flex-shrink: 0;
      align-self: stretch;
      transition: background 0.1s ease;
    }

    .drag-handle:hover,
    .drag-handle.dragging {
      background: hsla(0,0%,100%,0.3);
    }

    .trace-table {
      width: 100%;
      border-collapse: collapse;
    }

    .trace-table td {
      padding: 6px 8px;
      border-bottom: 1px solid hsla(0,0%,100%,0.08);
      white-space: nowrap;
      vertical-align: middle;
    }

    .trace-table tr.trace-row {
      cursor: pointer;
      transition: background 0.1s ease;
    }

    .trace-table tr.trace-row:hover td {
      background: hsla(0,0%,100%,0.04);
    }

    .trace-table tr.trace-row.selected td {
      background: hsla(0,0%,100%,0.12);
    }

    .trace-table tr:last-child td {
      border-bottom: none;
    }

    .col-dot {
      width: 1%;
      padding-right: 0;
      padding-left: 10px;
    }

    .col-dot + .col-url {
      padding-left: 4px;
    }

    .status-dot {
      display: inline-block;
      width: 7px;
      height: 7px;
      border-radius: 50%;
    }

    .status-dot.ok {
      background: #50e3c2;
    }

    .status-dot.error {
      background: #ee5151;
    }

    .col-method {
      font-weight: 600;
      font-size: 11px;
      color: #fff;
      width: 1%;
    }

    .col-status {
      font-weight: 600;
      font-size: 11px;
      width: 1%;
      text-align: right;
    }

    .col-status.ok {
      color: #50e3c2;
    }

    .col-status.error {
      color: #ee5151;
    }

    .col-url {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 0;
      width: 100%;
      color: #999;
    }

    .col-link {
      width: 1%;
    }

    .col-age {
      color: #666;
      font-size: 11px;
      text-align: right;
      width: 1%;
    }

    .col-link a {
      color: #eaeaea;
      text-decoration: none;
      font-size: 11px;
      transition: color 0.1s ease;
    }

    .col-link a:hover {
      color: #fff;
      text-decoration: underline;
    }

    /* Detail pane (right side) */
    .detail-pane {
      flex: 1;
      overflow-y: auto;
      display: none;
      flex-direction: column;
      align-self: stretch;
    }

    .panel-body.has-selection .detail-pane {
      display: flex;
    }

    .detail-header {
      padding: 8px 10px;
      border-bottom: 1px solid hsla(0,0%,100%,0.1);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }

    .detail-tabs {
      display: flex;
      align-items: stretch;
      border-bottom: 1px solid hsla(0,0%,100%,0.1);
      flex-shrink: 0;
    }

    .detail-tab-pane {
      flex: 1;
      overflow-y: auto;
      min-height: 0;
    }

    .detail-close {
      background: transparent;
      border: none;
      color: #999;
      cursor: pointer;
      display: flex;
      align-items: center;
      padding: 2px;
      transition: color 0.1s ease;
    }

    .detail-close:hover {
      color: #eaeaea;
    }

    .detail-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
    }

    .detail-meta span {
      width: auto;
      white-space: nowrap;
    }

    .trace-link {
      color: #eaeaea;
      text-decoration: none;
      font-size: 11px;
      white-space: nowrap;
    }

    .trace-link:hover {
      color: #fff;
      text-decoration: underline;
    }

    .detail-body {
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow-y: auto;
    }

    .detail-section {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .detail-label {
      font-size: 10px;
      font-weight: 600;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .collapsible-label {
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      user-select: none;
    }

    .section-copy {
      margin-left: auto;
      background: transparent;
      border: none;
      color: #555;
      cursor: pointer;
      display: flex;
      align-items: center;
      padding: 1px;
      transition: color 0.1s ease;
    }

    .section-copy:hover {
      color: #eaeaea;
    }

    .section-copy.copied {
      color: #50e3c2;
    }

    .collapsible-label > svg {
      transition: transform 0.15s ease;
    }

    .collapsible-label.open > svg {
      transform: rotate(90deg);
    }

    .collapsible-content {
      display: none;
    }

    .collapsible-content.open {
      display: block;
    }

    .detail-url {
      font-family: "Geist Mono", "SF Mono", "Menlo", "Monaco", monospace;
      font-size: 11px;
      color: #eaeaea;
      word-break: break-all;
    }

    .detail-content {
      font-family: "Geist Mono", "SF Mono", "Menlo", "Monaco", monospace;
      font-size: 11px;
      color: #eaeaea;
      background: hsla(0,0%,100%,0.04);
      border: 1px solid hsla(0,0%,100%,0.08);
      border-radius: 6px;
      padding: 6px 8px;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 300px;
      overflow-y: auto;
    }

    .detail-content ul {
      list-style: none;
      margin: 0;
      padding: 0 0 0 16px;
    }

    .detail-content > ul {
      padding-left: 0;
    }

    .detail-content li {
      line-height: 1.6;
    }

    .filters {
      padding: 8px 12px;
      border-bottom: 1px solid hsla(0,0%,100%,0.1);
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }

    .filter-toggle {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: #888;
      cursor: pointer;
      user-select: none;
      padding: 3px 8px;
      border-radius: 6px;
      border: 1px solid hsla(0,0%,100%,0.1);
      background: transparent;
      transition: all 0.1s ease;
    }

    .filter-toggle:hover {
      border-color: hsla(0,0%,100%,0.2);
    }

    .filter-toggle.active {
      background: hsla(0,0%,100%,0.1);
      color: #eaeaea;
      border-color: hsla(0,0%,100%,0.2);
    }

    .method-dropdown {
      position: relative;
    }

    .method-menu {
      display: none;
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      background: #111;
      border: 1px solid hsla(0,0%,100%,0.15);
      border-radius: 8px;
      padding: 4px 0;
      z-index: 10;
      min-width: 100px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.3);
    }

    .method-menu.open {
      display: block;
    }

    .method-option {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      font-size: 11px;
      color: #999;
      cursor: pointer;
      transition: background 0.1s ease;
    }

    .method-option:hover {
      background: hsla(0,0%,100%,0.12);
    }

    .method-option.selected {
      color: #eaeaea;
    }

    .method-check {
      width: 12px;
      height: 12px;
      border: 1px solid hsla(0,0%,100%,0.2);
      border-radius: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .method-option.selected .method-check {
      background: #eaeaea;
      border-color: #eaeaea;
    }

    .path-input {
      flex: 1;
      min-width: 100px;
      font-size: 11px;
      font-family: "Geist Mono", "SF Mono", monospace;
      color: #eaeaea;
      background: transparent;
      border: 1px solid hsla(0,0%,100%,0.1);
      border-radius: 6px;
      padding: 3px 8px;
      outline: none;
      transition: border-color 0.1s ease;
    }

    .path-input::placeholder {
      color: #555;
    }

    .path-input:focus {
      border-color: hsla(0,0%,100%,0.3);
    }

    .path-input.invalid {
      border-color: #ee5151;
    }

    .empty {
      padding: 24px 12px;
      text-align: center;
      color: #666;
    }

    .prompt-block {
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .prompt-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      color: #999;
    }

    .toggle-switch {
      position: relative;
      width: 28px;
      height: 16px;
      background: hsla(0,0%,100%,0.15);
      border-radius: 8px;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.15s ease;
    }

    .toggle-switch.on {
      background: #50e3c2;
    }

    .toggle-switch::after {
      content: "";
      position: absolute;
      top: 2px;
      left: 2px;
      width: 12px;
      height: 12px;
      background: #fff;
      border-radius: 50%;
      transition: transform 0.15s ease;
    }

    .toggle-switch.on::after {
      transform: translateX(12px);
    }

    .prompt-label {
      font-size: 10px;
      font-weight: 600;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }

    .prompt-box {
      position: relative;
      font-family: "Geist Mono", "SF Mono", "Menlo", "Monaco", monospace;
      font-size: 11px;
      color: #eaeaea;
      background: hsla(0,0%,100%,0.04);
      border: 1px solid hsla(0,0%,100%,0.08);
      border-radius: 6px;
      padding: 8px 10px;
      padding-right: 36px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .copy-btn {
      position: absolute;
      top: 6px;
      right: 6px;
      background: hsla(0,0%,100%,0.08);
      border: 1px solid hsla(0,0%,100%,0.12);
      border-radius: 4px;
      color: #999;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      transition: all 0.1s ease;
    }

    .copy-btn:hover {
      background: hsla(0,0%,100%,0.15);
      color: #eaeaea;
    }

    .copy-btn.copied {
      color: #50e3c2;
    }

    /* Panel edge resize handle (sidebar mode) */
    .panel-resize {
      display: none;
      position: absolute;
      top: 0;
      bottom: 0;
      width: 5px;
      cursor: col-resize;
      z-index: 1;
    }

    .panel-resize::after {
      content: "";
      position: absolute;
      top: 0;
      bottom: 0;
      width: 1px;
      background: hsla(0,0%,100%,0.1);
      transition: background 0.1s ease;
    }

    .panel-resize:hover::after,
    .panel-resize.dragging::after {
      background: hsla(0,0%,100%,0.3);
      width: 3px;
    }

    .panel.sidebar-left .panel-resize {
      display: block;
      right: -3px;
    }

    .panel.sidebar-left .panel-resize::after {
      right: 0;
    }

    .panel.sidebar-right .panel-resize {
      display: block;
      left: -3px;
    }

    .panel.sidebar-right .panel-resize::after {
      left: 0;
    }

    /* Log entries */
    .log-list {
      padding: 6px 0;
    }

    .log-entry {
      padding: 3px 10px;
      font-family: "Geist Mono", "SF Mono", "Menlo", "Monaco", monospace;
      font-size: 11px;
      line-height: 1.5;
      display: flex;
      gap: 8px;
      align-items: baseline;
    }

    .log-entry:hover {
      background: hsla(0,0%,100%,0.04);
    }

    .log-time {
      color: #555;
      flex-shrink: 0;
      font-variant-numeric: tabular-nums;
    }

    .log-level {
      flex-shrink: 0;
      font-weight: 700;
      font-size: 10px;
      width: 28px;
      text-align: center;
    }

    .log-level.TRC { color: #666; }
    .log-level.DBG { color: #888; }
    .log-level.INF { color: #50e3c2; }
    .log-level.WRN { color: #f5a623; }
    .log-level.ERR { color: #ee5151; }

    .log-msg {
      color: #eaeaea;
      word-break: break-word;
      min-width: 0;
    }

    .log-fields {
      color: #666;
      word-break: break-word;
    }

    .log-field-key {
      color: #888;
    }

    .log-field-value {
      color: #b0b0b0;
    }

    .log-empty {
      padding: 24px 12px;
      text-align: center;
      color: #666;
      font-size: 12px;
    }

    .log-loading {
      padding: 24px 12px;
      text-align: center;
      color: #666;
      font-size: 12px;
    }

    .log-error {
      padding: 12px;
      color: #ee5151;
      font-size: 12px;
    }
  `;
}

export interface WidgetOptions {
  appId?: string;
}

export function createWidget(opts?: WidgetOptions): void {
  const host = document.createElement("div");
  host.id = "encore-toolbar";
  const shadow = host.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = getStyles();
  shadow.appendChild(style);

  // Toggle button
  const toggle = document.createElement("button");
  toggle.className = "toggle";
  toggle.innerHTML = `<svg width="18" height="20" viewBox="0 0 60 67" fill="#eaeaea" xmlns="http://www.w3.org/2000/svg"><path d="M60 51.2335V66.1119H0V21.2179C9.50495 19.2126 18.9439 16.625 28.1188 13.4553C39.0759 9.70332 49.703 5.23979 60 0V16.5603C51.2871 20.7004 42.2442 24.323 33.0693 27.4927C22.7063 31.0506 12.0792 33.8969 1.32013 36.0963V36.2257C21.1881 34.4144 40.7261 31.2447 60 26.8458V42.0477C40.7261 46.3172 21.1221 49.3575 1.32013 51.1041V51.2335H60Z"/></svg>`;

  const badge = document.createElement("span");
  badge.className = "badge";
  toggle.appendChild(badge);
  shadow.appendChild(toggle);

  // Panel
  const panel = document.createElement("div");
  panel.className = "panel";

  // Title bar
  const titleBar = document.createElement("div");
  titleBar.className = "panel-title";

  const titleText = document.createElement("span");
  titleText.className = "panel-title-text";
  titleText.textContent = "Encore Dev Toolbar";
  titleBar.appendChild(titleText);

  const infoIcon = document.createElement("span");
  infoIcon.className = "info-icon";
  infoIcon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 9h.01"/><path d="M11 12h1v4h1"/></svg><div class="info-tooltip">Automatically captures requests to your Encore backend. Click any trace to view request/response data, backend logs, and generate debugging prompts for your AI assistant. Set your App ID to enable trace linking and log fetching. <a href="https://encore.dev/docs" target="_blank" rel="noopener">Docs</a></div>`;
  titleBar.appendChild(infoIcon);

  // App ID input with autocomplete
  const appIdWrapper = document.createElement("div");
  appIdWrapper.className = "app-id-wrapper";

  const appIdInput = document.createElement("input");
  appIdInput.className = "app-id-input";
  appIdInput.type = "text";
  appIdInput.placeholder = "Encore App ID";
  if (opts?.appId) {
    appIdInput.value = opts.appId;
    appIdInput.classList.add("filled");
  }
  appIdWrapper.appendChild(appIdInput);

  const appIdDropdown = document.createElement("div");
  appIdDropdown.className = "app-id-dropdown";
  appIdWrapper.appendChild(appIdDropdown);
  titleBar.appendChild(appIdWrapper);

  let daemonApps: DaemonApp[] = [];

  function fetchApps(): void {
    listApps()
      .then((apps) => { daemonApps = apps; })
      .catch(() => { daemonApps = []; });
  }

  fetchApps();

  function renderAppDropdown(): void {
    const query = appIdInput.value.trim().toLowerCase();
    const filtered = daemonApps.filter((a) =>
      a.name.toLowerCase().includes(query) || a.id.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
      appIdDropdown.classList.remove("open");
      return;
    }

    appIdDropdown.innerHTML = `<div class="app-id-hint">Fill in the Encore App ID to make linking work better</div>` + filtered.map((a) =>
      `<div class="app-id-option" data-app-id="${escapeHtml(a.id)}"><span class="app-dot ${a.offline ? "offline" : "online"}"></span>${escapeHtml(a.name)}</div>`
    ).join("");
    appIdDropdown.classList.add("open");

    appIdDropdown.querySelectorAll<HTMLElement>(".app-id-option").forEach((opt) => {
      opt.addEventListener("click", () => {
        appIdInput.value = opt.dataset.appId!;
        appIdInput.classList.add("filled");
        appIdDropdown.classList.remove("open");
      });
    });
  }

  appIdInput.addEventListener("focus", () => {
    fetchApps();
    setTimeout(renderAppDropdown, 100);
  });

  appIdInput.addEventListener("input", () => {
    appIdInput.classList.toggle("filled", appIdInput.value.trim().length > 0);
    renderAppDropdown();
  });

  shadow.addEventListener("click", (e) => {
    if (!appIdWrapper.contains(e.target as Node)) {
      appIdDropdown.classList.remove("open");
    }
  });

  const closeBtn = document.createElement("button");
  closeBtn.className = "close-btn";
  closeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>`;
  closeBtn.addEventListener("click", () => {
    panel.classList.remove("open");
    applyBodyPush();
  });
  titleBar.appendChild(closeBtn);

  panel.appendChild(titleBar);

  // Tabs
  const header = document.createElement("div");
  header.className = "panel-header";
  panel.appendChild(header);

  const tracesTab = document.createElement("button");
  tracesTab.className = "tab active";
  tracesTab.textContent = "Traces";
  header.appendChild(tracesTab);

  const settingsTab = document.createElement("button");
  settingsTab.className = "tab";
  settingsTab.textContent = "Placement";
  header.appendChild(settingsTab);

  // Traces page container
  const tracesPage = document.createElement("div");
  tracesPage.style.display = "flex";
  tracesPage.style.flexDirection = "column";
  tracesPage.style.flex = "1";
  tracesPage.style.minHeight = "0";

  // Filters bar
  const filters = document.createElement("div");
  filters.className = "filters";
  tracesPage.appendChild(filters);

  // Method dropdown
  const ALL_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
  const selectedMethods = new Set<string>(ALL_METHODS);

  const methodDropdown = document.createElement("div");
  methodDropdown.className = "method-dropdown";

  const methodBtn = document.createElement("button");
  methodBtn.className = "filter-toggle";
  methodBtn.textContent = "Methods";
  methodDropdown.appendChild(methodBtn);

  const methodMenu = document.createElement("div");
  methodMenu.className = "method-menu";
  methodDropdown.appendChild(methodMenu);

  function renderMethodMenu(): void {
    methodMenu.innerHTML = ALL_METHODS.map(
      (m) =>
        `<div class="method-option${selectedMethods.has(m) ? " selected" : ""}" data-method="${m}"><span class="method-check">${selectedMethods.has(m) ? `<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>` : ""}</span>${m}</div>`,
    ).join("");
    methodBtn.classList.toggle("active", selectedMethods.size < ALL_METHODS.length);

    methodMenu.querySelectorAll<HTMLElement>(".method-option").forEach((opt) => {
      opt.addEventListener("click", () => {
        const m = opt.dataset.method!;
        if (selectedMethods.has(m)) {
          if (selectedMethods.size > 1) selectedMethods.delete(m);
        } else {
          selectedMethods.add(m);
        }
        renderMethodMenu();
        render();
      });
    });
  }

  methodBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = methodMenu.classList.toggle("open");
    if (isOpen) renderMethodMenu();
  });

  // Close method menu when clicking outside
  shadow.addEventListener("click", (e) => {
    if (!methodDropdown.contains(e.target as Node)) {
      methodMenu.classList.remove("open");
    }
  });

  // Path filter input
  const pathInput = document.createElement("input");
  pathInput.className = "path-input";
  pathInput.type = "text";
  pathInput.placeholder = "Filter path (regex)";
  // Errors-only toggle
  const errorsBtn = document.createElement("button");
  errorsBtn.className = "filter-toggle";
  errorsBtn.textContent = "Errors only";

  // Append filters in order: path, method, errors
  filters.appendChild(pathInput);
  filters.appendChild(methodDropdown);
  filters.appendChild(errorsBtn);

  let errorsOnly = false;
  errorsBtn.addEventListener("click", () => {
    errorsOnly = !errorsOnly;
    errorsBtn.classList.toggle("active", errorsOnly);
    render();
  });

  let pathRegex: RegExp | null = null;
  pathInput.addEventListener("input", () => {
    const val = pathInput.value.trim();
    if (!val) {
      pathRegex = null;
      pathInput.classList.remove("invalid");
    } else {
      try {
        pathRegex = new RegExp(val, "i");
        pathInput.classList.remove("invalid");
      } catch {
        pathRegex = null;
        pathInput.classList.add("invalid");
      }
    }
    render();
  });

  const body = document.createElement("div");
  body.className = "panel-body";

  const traceList = document.createElement("div");
  traceList.className = "trace-list";
  body.appendChild(traceList);

  const dragHandle = document.createElement("div");
  dragHandle.className = "drag-handle";
  body.appendChild(dragHandle);

  const detailPane = document.createElement("div");
  detailPane.className = "detail-pane";
  body.appendChild(detailPane);

  // Drag to resize
  let isDragging = false;
  dragHandle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    isDragging = true;
    dragHandle.classList.add("dragging");

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const bodyRect = body.getBoundingClientRect();
      const x = e.clientX - bodyRect.left;
      const pct = Math.max(15, Math.min(85, (x / bodyRect.width) * 100));
      traceList.style.width = `${pct}%`;
    };

    const onMouseUp = () => {
      isDragging = false;
      dragHandle.classList.remove("dragging");
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });

  tracesPage.appendChild(body);
  panel.appendChild(tracesPage);

  // Settings page
  const POSITIONS = [
    { key: "bottom-right", label: "Bottom right" },
    { key: "bottom-left", label: "Bottom left" },
    { key: "top-right", label: "Top right" },
    { key: "top-left", label: "Top left" },
    { key: "side-right", label: "Right side" },
    { key: "side-left", label: "Left side" },
  ] as const;

  type Position = (typeof POSITIONS)[number]["key"];

  const DEFAULT_PANEL_WIDTH = 450;
  const MIN_PANEL_WIDTH = 300;
  const MAX_PANEL_WIDTH = 800;
  let panelWidth = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH,
    parseInt(localStorage.getItem("encore-toolbar-width") ?? "", 10) || DEFAULT_PANEL_WIDTH));

  let currentPosition: Position = (localStorage.getItem("encore-toolbar-position") as Position) || "bottom-right";

  function isSidebarPosition(pos: Position): boolean {
    return pos === "side-right" || pos === "side-left";
  }

  function applyPosition(): void {
    const isSidebar = isSidebarPosition(currentPosition);

    // Reset all positioning
    toggle.style.top = "";
    toggle.style.bottom = "";
    toggle.style.left = "";
    toggle.style.right = "";
    panel.style.top = "";
    panel.style.bottom = "";
    panel.style.left = "";
    panel.style.right = "";
    panel.style.width = "";
    panel.style.height = "";
    panel.style.maxHeight = "";
    panel.style.borderRadius = "";

    // Reset body push
    document.body.style.marginLeft = "";
    document.body.style.marginRight = "";
    document.documentElement.style.overflowX = "";

    // Reset sidebar classes
    panel.classList.remove("sidebar-left", "sidebar-right");

    if (isSidebar) {
      const side = currentPosition === "side-right" ? "right" : "left";
      panel.classList.add(currentPosition === "side-right" ? "sidebar-right" : "sidebar-left");

      // Toggle button
      toggle.style.bottom = "16px";
      toggle.style[side] = "16px";

      // Panel: full-height sidebar
      panel.style.top = "0";
      panel.style.bottom = "0";
      panel.style[side] = "0";
      panel.style.width = `${panelWidth}px`;
      panel.style.height = "100vh";
      panel.style.maxHeight = "100vh";
      panel.style.borderRadius = "0";
    } else {
      switch (currentPosition) {
        case "bottom-right":
          toggle.style.bottom = "16px";
          toggle.style.right = "16px";
          panel.style.bottom = "64px";
          panel.style.right = "16px";
          break;
        case "bottom-left":
          toggle.style.bottom = "16px";
          toggle.style.left = "16px";
          panel.style.bottom = "64px";
          panel.style.left = "16px";
          break;
        case "top-right":
          toggle.style.top = "16px";
          toggle.style.right = "16px";
          panel.style.top = "64px";
          panel.style.right = "16px";
          break;
        case "top-left":
          toggle.style.top = "16px";
          toggle.style.left = "16px";
          panel.style.top = "64px";
          panel.style.left = "16px";
          break;
      }
    }

    applyBodyPush();
  }

  // Capture original body margins before we modify them
  const computedBody = getComputedStyle(document.body);
  const originalMarginLeft = parseFloat(computedBody.marginLeft) || 0;
  const originalMarginRight = parseFloat(computedBody.marginRight) || 0;

  function applyBodyPush(): void {
    const isSidebar = isSidebarPosition(currentPosition);
    const isOpen = panel.classList.contains("open");

    document.body.style.marginLeft = "";
    document.body.style.marginRight = "";
    document.documentElement.style.overflowX = "";

    if (isSidebar && isOpen) {
      if (currentPosition === "side-right") {
        document.body.style.marginRight = `${originalMarginRight + panelWidth}px`;
      } else {
        document.body.style.marginLeft = `${originalMarginLeft + panelWidth}px`;
      }
      document.documentElement.style.overflowX = "hidden";
    }
  }

  applyPosition();

  const settingsPage = document.createElement("div");
  settingsPage.className = "settings-page";
  settingsPage.style.display = "none";

  // Floating positions — grid order matches spatial position
  const FLOATING_POSITIONS: { key: Position; label: string }[] = [
    { key: "top-left", label: "Top left" },
    { key: "top-right", label: "Top right" },
    { key: "bottom-left", label: "Bottom left" },
    { key: "bottom-right", label: "Bottom right" },
  ];

  const floatingSection = document.createElement("div");
  floatingSection.className = "settings-section";
  const floatingLabel = document.createElement("div");
  floatingLabel.className = "settings-label";
  floatingLabel.textContent = "Floating";
  floatingSection.appendChild(floatingLabel);
  const floatingGrid = document.createElement("div");
  floatingGrid.className = "position-grid";
  floatingSection.appendChild(floatingGrid);
  settingsPage.appendChild(floatingSection);

  // Fixed positions — grid order matches spatial position
  const FIXED_POSITIONS: { key: Position; label: string }[] = [
    { key: "side-left", label: "Left side" },
    { key: "side-right", label: "Right side" },
  ];

  const fixedSection = document.createElement("div");
  fixedSection.className = "settings-section";
  const fixedLabel = document.createElement("div");
  fixedLabel.className = "settings-label";
  fixedLabel.textContent = "Fixed";
  fixedSection.appendChild(fixedLabel);
  const fixedGrid = document.createElement("div");
  fixedGrid.className = "position-grid fixed";
  fixedSection.appendChild(fixedGrid);
  settingsPage.appendChild(fixedSection);

  function renderPositionGrids(): void {
    [
      { grid: floatingGrid, items: FLOATING_POSITIONS },
      { grid: fixedGrid, items: FIXED_POSITIONS },
    ].forEach(({ grid, items }) => {
      grid.innerHTML = items.map(
        (p) =>
          `<button class="position-option${currentPosition === p.key ? " active" : ""}" data-position="${p.key}"><span class="position-dot"></span>${p.label}</button>`,
      ).join("");

      grid.querySelectorAll<HTMLElement>(".position-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          currentPosition = btn.dataset.position as Position;
          localStorage.setItem("encore-toolbar-position", currentPosition);
          applyPosition();
          renderPositionGrids();
        });
      });
    });
  }

  renderPositionGrids();
  panel.appendChild(settingsPage);

  // Panel edge resize handle (sidebar mode)
  const panelResize = document.createElement("div");
  panelResize.className = "panel-resize";
  panel.appendChild(panelResize);

  panelResize.addEventListener("mousedown", (e) => {
    if (!isSidebarPosition(currentPosition)) return;
    e.preventDefault();
    panelResize.classList.add("dragging");

    const onMouseMove = (e: MouseEvent) => {
      let newWidth: number;
      if (currentPosition === "side-right") {
        newWidth = window.innerWidth - e.clientX;
      } else {
        newWidth = e.clientX;
      }
      newWidth = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, newWidth));
      panelWidth = newWidth;
      panel.style.width = `${panelWidth}px`;
      applyBodyPush();
    };

    const onMouseUp = () => {
      panelResize.classList.remove("dragging");
      localStorage.setItem("encore-toolbar-width", String(panelWidth));
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });

  shadow.appendChild(panel);

  // Tab switching
  function switchTab(tab: "traces" | "settings"): void {
    tracesTab.classList.toggle("active", tab === "traces");
    settingsTab.classList.toggle("active", tab === "settings");
    tracesPage.style.display = tab === "traces" ? "flex" : "none";
    settingsPage.style.display = tab === "settings" ? "" : "none";
  }

  tracesTab.addEventListener("click", () => switchTab("traces"));
  settingsTab.addEventListener("click", () => switchTab("settings"));

  // Toggle behavior
  toggle.addEventListener("click", () => {
    panel.classList.toggle("open");
    applyBodyPush();
    render();
  });

  let selectedTraceId: string | null = null;
  let renderedDetailTraceId: string | null = null;
  const logCache = new Map<string, LogEntry[] | "loading" | Error>();

  function filterTraces(traces: readonly TraceEntry[]): TraceEntry[] {
    return traces.filter((t) => {
      if (errorsOnly && t.status < 400) return false;
      if (!selectedMethods.has(t.method)) return false;
      if (pathRegex && !pathRegex.test(t.url)) return false;
      return true;
    });
  }

  function tryParseJson(raw: string | undefined): { parsed: unknown; isJson: boolean } {
    if (!raw) return { parsed: undefined, isJson: false };
    try {
      return { parsed: JSON.parse(raw), isJson: true };
    } catch {
      return { parsed: raw, isJson: false };
    }
  }

  function mountJsonViewer(el: HTMLElement, raw: string | undefined): void {
    const { parsed, isJson } = tryParseJson(raw);
    if (isJson) {
      renderJson(el, parsed);
    } else {
      el.textContent = raw ?? "empty";
    }
  }

  function isLocalhost(): boolean {
    const h = window.location.hostname;
    return h === "localhost" || h === "127.0.0.1";
  }

  function traceUrl(traceId: string): string {
    if (isLocalhost()) {
      const appId = appIdInput.value.trim();
      if (appId) {
        return `http://localhost:9400/${encodeURIComponent(appId)}/envs/local/traces/${encodeURIComponent(traceId)}`;
      }
    }
    return `${REMOTE_TRACE_BASE_URL}${encodeURIComponent(traceId)}`;
  }

  function renderDetailPane(t: TraceEntry): void {
    // Unmount previous viewers
    detailPane.querySelectorAll<HTMLElement>("[data-json-target]").forEach((el) => unmountJson(el));

    detailPane.innerHTML = `
      <div class="detail-header">
        <div class="detail-meta">
          <span class="col-method">${escapeHtml(t.method)}</span>
          <span class="col-status ${t.status < 400 ? "ok" : "error"}">${t.status}</span>
          <span style="color:#666;font-size:11px">${timeAgo(t.timestamp)}</span>
          <a class="trace-link" href="${traceUrl(t.traceId)}" target="_blank" rel="noopener">View trace &rarr;</a>
        </div>
        <button class="detail-close"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg></button>
      </div>
      <div class="detail-tabs">
        <button class="tab active" data-detail-tab="request">Request</button>
        <button class="tab" data-detail-tab="prompts">Prompts</button>
      </div>
      <div class="detail-tab-pane" data-pane="request">
        <div class="detail-body">
          <div class="detail-section"><span class="detail-label collapsible-label open"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>URL<button class="section-copy" data-copy="url" title="Copy"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button></span><div class="detail-url collapsible-content open">${escapeHtml(t.url)}</div></div>
          ${t.queryParams ? `<div class="detail-section"><span class="detail-label collapsible-label open"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>Query Params<button class="section-copy" data-copy="query" title="Copy"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button></span><div class="detail-content collapsible-content open" data-json-target="query"></div></div>` : ""}
          ${t.cookies ? `<div class="detail-section"><span class="detail-label collapsible-label"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>Cookies<button class="section-copy" data-copy="cookies" title="Copy"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button></span><div class="detail-content collapsible-content" data-json-target="cookies"></div></div>` : ""}
          ${t.requestBody ? `<div class="detail-section"><span class="detail-label collapsible-label open"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>Request Body<button class="section-copy" data-copy="request" title="Copy"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button></span><div class="detail-content collapsible-content open" data-json-target="request"></div></div>` : ""}
          <div class="detail-section"><span class="detail-label collapsible-label open"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>Response Body<button class="section-copy" data-copy="response" title="Copy"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button></span><div class="detail-content collapsible-content open" data-json-target="response"></div></div>
          <div class="detail-section"><span class="detail-label collapsible-label open"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>Backend Logs</span><div class="collapsible-content open" data-logs-container><div class="log-loading">Loading logs...</div></div></div>
        </div>
      </div>
      <div class="detail-tab-pane" data-pane="prompts" style="display:none">
        <div class="prompt-block">
          <div class="prompt-toggle"><span class="toggle-switch on" data-mcp-toggle></span>Use Encore MCP</div>
          <div class="prompt-toggle"><span class="toggle-switch on" data-href-toggle></span>Include frontend href</div>
          <div class="prompt-box"><button class="copy-btn" data-copy-prompt title="Copy to clipboard"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button><span data-prompt-text></span></div>
        </div>
      </div>`;

    // Mount JSON viewers
    const queryEl = detailPane.querySelector<HTMLElement>('[data-json-target="query"]');
    if (queryEl) renderJson(queryEl, t.queryParams);

    const cookiesEl = detailPane.querySelector<HTMLElement>('[data-json-target="cookies"]');
    if (cookiesEl) renderJson(cookiesEl, t.cookies);

    const reqEl = detailPane.querySelector<HTMLElement>('[data-json-target="request"]');
    if (reqEl) mountJsonViewer(reqEl, t.requestBody);

    const resEl = detailPane.querySelector<HTMLElement>('[data-json-target="response"]');
    if (resEl) mountJsonViewer(resEl, t.responseBody);

    // Collapsible sections
    detailPane.querySelectorAll<HTMLElement>(".collapsible-label").forEach((label) => {
      label.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).closest(".section-copy")) return;
        label.classList.toggle("open");
        const content = label.nextElementSibling as HTMLElement;
        content?.classList.toggle("open");
      });
    });

    // Section copy buttons
    function prettyJson(raw: string | undefined): string {
      if (!raw) return "";
      try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
    }

    const copyData: Record<string, string> = {
      url: t.url,
      query: t.queryParams ? JSON.stringify(t.queryParams, null, 2) : "",
      cookies: t.cookies ? JSON.stringify(t.cookies, null, 2) : "",
      request: prettyJson(t.requestBody),
      response: prettyJson(t.responseBody),
    };

    detailPane.querySelectorAll<HTMLElement>(".section-copy").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const key = btn.dataset.copy!;
        navigator.clipboard.writeText(copyData[key] || "").then(() => {
          btn.classList.add("copied");
          setTimeout(() => btn.classList.remove("copied"), 1500);
        });
      });
    });

    // Prompt toggle and copy
    const mcpToggle = detailPane.querySelector<HTMLElement>("[data-mcp-toggle]");
    const hrefToggle = detailPane.querySelector<HTMLElement>("[data-href-toggle]");
    const promptTextEl = detailPane.querySelector<HTMLElement>("[data-prompt-text]");
    const copyBtn = detailPane.querySelector<HTMLElement>("[data-copy-prompt]");

    let useMcp = true;
    let includeHref = true;

    function formatResponseBody(): string {
      if (!t.responseBody) return "(empty)";
      try {
        return JSON.stringify(JSON.parse(t.responseBody), null, 2);
      } catch {
        return t.responseBody;
      }
    }

    function formatRequestBody(): string {
      if (!t.requestBody) return "(empty)";
      try {
        return JSON.stringify(JSON.parse(t.requestBody), null, 2);
      } catch {
        return t.requestBody;
      }
    }

    function hrefSuffix(): string {
      return includeHref ? ` The request was made from the frontend on href ${t.pageHref}` : "";
    }

    function getPromptText(): string {
      if (useMcp) {
        return `Investigate the trace ${t.traceId} using the Encore MCP.${hrefSuffix()}`;
      }
      return `Debug why the request:\n${t.method} ${t.url}${t.requestBody ? `\n${formatRequestBody()}` : ""}\n\nGot the response:\n${formatResponseBody()}${includeHref ? `\n\n${hrefSuffix().trim()}` : ""}`;
    }

    function updatePrompt(): void {
      if (promptTextEl) promptTextEl.textContent = getPromptText();
    }

    updatePrompt();

    if (mcpToggle) {
      mcpToggle.addEventListener("click", () => {
        useMcp = !useMcp;
        mcpToggle.classList.toggle("on", useMcp);
        updatePrompt();
      });
    }

    if (hrefToggle) {
      hrefToggle.addEventListener("click", () => {
        includeHref = !includeHref;
        hrefToggle.classList.toggle("on", includeHref);
        updatePrompt();
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(getPromptText()).then(() => {
          copyBtn.classList.add("copied");
          setTimeout(() => copyBtn.classList.remove("copied"), 1500);
        });
      });
    }

    // Backend logs section
    const logsContainer = detailPane.querySelector<HTMLElement>("[data-logs-container]")!;

    function formatLogTime(d: Date): string {
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      const s = String(d.getSeconds()).padStart(2, "0");
      const ms = String(d.getMilliseconds()).padStart(3, "0");
      return `${h}:${m}:${s}.${ms}`;
    }

    const LEVEL_ABBREV: Record<string, string> = {
      TRACE: "TRC", DEBUG: "DBG", INFO: "INF", WARN: "WRN", ERROR: "ERR",
    };

    function renderLogs(logs: LogEntry[]): void {
      if (logs.length === 0) {
        logsContainer.innerHTML = `<div class="log-empty">No logs for this trace</div>`;
        return;
      }
      logsContainer.innerHTML = `<div class="log-list">${logs.map((log) => {
        const abbrev = LEVEL_ABBREV[log.level] ?? log.level;
        const fieldKeys = Object.keys(log.fields);
        const fieldsHtml = fieldKeys.length > 0
          ? `<span class="log-fields"> ${fieldKeys.map((k) => `<span class="log-field-key">${escapeHtml(k)}</span>=<span class="log-field-value">${escapeHtml(String(log.fields[k]))}</span>`).join(" ")}</span>`
          : "";
        return `<div class="log-entry"><span class="log-level ${abbrev}">${abbrev}</span><span class="log-msg">${escapeHtml(log.message)}${fieldsHtml}</span></div>`;
      }).join("")}</div>`;
    }

    // Fetch logs eagerly when trace is selected
    {
      const cached = logCache.get(t.traceId);
      if (Array.isArray(cached)) {
        renderLogs(cached);
      } else if (cached instanceof Error) {
        logsContainer.innerHTML = `<div class="log-error">${escapeHtml(cached.message)}</div>`;
      } else {
        const appId = appIdInput.value.trim();
        if (!appId) {
          logsContainer.innerHTML = `<div class="log-empty">Set the App ID above to fetch backend logs</div>`;
        } else if (cached !== "loading") {
          logCache.set(t.traceId, "loading");
          getTraceLogs(appId, t.traceId)
            .then((logs) => {
              logCache.set(t.traceId, logs);
              if (selectedTraceId === t.traceId) renderLogs(logs);
            })
            .catch((err) => {
              const error = err instanceof Error ? err : new Error(String(err?.message ?? err));
              logCache.set(t.traceId, error);
              if (selectedTraceId === t.traceId) {
                logsContainer.innerHTML = `<div class="log-error">Failed to load logs: ${escapeHtml(error.message)}</div>`;
              }
            });
        }
      }
    }

    // Detail tab switching
    detailPane.querySelectorAll<HTMLElement>("[data-detail-tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        const target = tab.dataset.detailTab!;
        detailPane.querySelectorAll<HTMLElement>("[data-detail-tab]").forEach((t) => t.classList.toggle("active", t.dataset.detailTab === target));
        detailPane.querySelectorAll<HTMLElement>("[data-pane]").forEach((p) => (p.style.display = p.dataset.pane === target ? "" : "none"));
      });
    });

    // Close button
    detailPane.querySelector(".detail-close")!.addEventListener("click", () => {
      selectedTraceId = null;
      render();
    });
  }

  // Render function
  function render(): void {
    const allTraces = getTraces();
    badge.textContent = allTraces.length > 0 ? String(allTraces.length) : "";

    const traces = filterTraces(allTraces);
    const hasSelection = selectedTraceId != null;

    body.classList.toggle("has-selection", hasSelection);

    if (allTraces.length === 0) {
      traceList.innerHTML = `<div class="empty">No traces yet</div>`;
      detailPane.innerHTML = "";
      return;
    }

    if (traces.length === 0) {
      traceList.innerHTML = `<div class="empty">No matching traces</div>`;
      detailPane.innerHTML = "";
      return;
    }

    // Render trace list — when selected, only show path column
    if (hasSelection) {
      traceList.innerHTML = `<table class="trace-table">${traces
        .map(
          (t) => `
          <tr class="trace-row${t.traceId === selectedTraceId ? " selected" : ""}" data-trace-id="${escapeHtml(t.traceId)}">
            <td class="col-dot"><span class="status-dot ${t.status < 400 ? "ok" : "error"}"></span></td>
            <td class="col-url" title="${escapeHtml(t.url)}">${escapeHtml(pathname(t.url))}</td>
          </tr>`
        )
        .join("")}</table>`;
    } else {
      traceList.innerHTML = `<table class="trace-table">${traces
        .map(
          (t) => `
          <tr class="trace-row" data-trace-id="${escapeHtml(t.traceId)}">
            <td class="col-dot"><span class="status-dot ${t.status < 400 ? "ok" : "error"}"></span></td>
            <td class="col-url" title="${escapeHtml(t.url)}">${escapeHtml(pathname(t.url))}</td>
            <td class="col-status ${t.status < 400 ? "ok" : "error"}">${t.status}</td>
            <td class="col-method">${escapeHtml(t.method)}</td>
            <td class="col-age">${timeAgo(t.timestamp)}</td>
            <td class="col-link"><a href="${traceUrl(t.traceId)}" target="_blank" rel="noopener">trace &rarr;</a></td>
          </tr>`
        )
        .join("")}</table>`;
    }

    // Render detail pane — skip if already showing this trace
    if (hasSelection) {
      const selected = traces.find((t) => t.traceId === selectedTraceId);
      if (selected) {
        if (renderedDetailTraceId !== selectedTraceId) {
          renderDetailPane(selected);
          renderedDetailTraceId = selectedTraceId;
        }
      } else {
        // Selected trace no longer visible (filtered out)
        selectedTraceId = null;
        renderedDetailTraceId = null;
        body.classList.remove("has-selection");
        detailPane.innerHTML = "";
        render();
        return;
      }
    } else {
      if (renderedDetailTraceId !== null) {
        detailPane.innerHTML = "";
        renderedDetailTraceId = null;
      }
    }

    // Click handlers
    traceList.querySelectorAll<HTMLElement>(".trace-row").forEach((row) => {
      row.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).closest("a")) return;
        const id = row.dataset.traceId!;
        selectedTraceId = selectedTraceId === id ? null : id;
        render();
      });
    });
  }

  subscribe(render);
  render();

  document.body.appendChild(host);
}

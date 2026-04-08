# Preact Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite the toolbar from a 2200-line imperative monolith into a Preact component tree, fixing duplication, performance, and quality issues.

**Architecture:** Preact components rendered into a Shadow DOM. Store module remains the source of truth exposed via hooks. CSS extracted to a real file imported via Vite `?inline`.

**Tech Stack:** Preact 10, Vite 8 (IIFE library), TypeScript 6

---

### Task 1: Configure JSX and project setup

**Files:**
- Modify: `tsconfig.json`
- Modify: `vite.config.ts`

**Step 1: Add JSX config to tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "declaration": false,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "jsxImportSource": "preact"
  },
  "include": ["src"]
}
```

**Step 2: Verify build still works**

Run: `npx vite build`
Expected: Build succeeds (no TSX files yet, so JSX config is inert)

**Step 3: Commit**

```bash
git add tsconfig.json
git commit -m "chore: configure JSX for Preact components"
```

---

### Task 2: Create `src/utils.ts` with shared utilities

**Files:**
- Create: `src/utils.ts`

These functions are currently scattered across `ui.ts` and `intercept.ts`. Consolidate them here.

**Step 1: Create utils.ts**

```ts
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function safeParseUrl(url: string): URL | null {
  try {
    return new URL(url, window.location.origin);
  } catch {
    return null;
  }
}

export function pathname(url: string): string {
  return safeParseUrl(url)?.pathname ?? url;
}

export function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatJson(raw: string | undefined): string {
  if (!raw) return "";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export function tryParseJson(raw: string | undefined): { parsed: unknown; isJson: boolean } {
  if (!raw) return { parsed: undefined, isJson: false };
  try {
    return { parsed: JSON.parse(raw), isJson: true };
  } catch {
    return { parsed: raw, isJson: false };
  }
}

export function copyToClipboard(el: HTMLElement, text: string): void {
  navigator.clipboard.writeText(text).then(() => {
    el.classList.add("copied");
    setTimeout(() => el.classList.remove("copied"), 1500);
  });
}

export function isLocalUrl(url: string): boolean {
  const h = safeParseUrl(url)?.hostname;
  return h === "localhost" || h === "127.0.0.1";
}
```

**Step 2: Verify build**

Run: `npx vite build`
Expected: Build succeeds (file is created but not yet imported)

**Step 3: Commit**

```bash
git add src/utils.ts
git commit -m "refactor: extract shared utilities to utils.ts"
```

---

### Task 3: Fix `src/store.ts` bugs and add debounced persistence

**Files:**
- Modify: `src/store.ts`

Fixes: mutable settings return, double loadSettings call, debounced persistence, notify helper.

**Step 1: Rewrite store.ts**

```ts
export interface TraceEntry {
  method: string;
  url: string;
  status: number;
  traceId: string;
  timestamp: number;
  requestBody?: string;
  responseBody?: string;
  queryParams?: Record<string, string>;
  cookies?: Record<string, string>;
  pageHref: string;
}

const STORAGE_KEY = "encore-toolbar-traces";
const SETTINGS_KEY = "encore-toolbar-settings";

export interface Settings {
  maxTraces: number;
  showLogTime: boolean;
  persistTraces: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  maxTraces: 25,
  showLogTime: false,
  persistTraces: false,
};

let settings: Settings = loadSettings();

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function getSettings(): Settings {
  return { ...settings };
}

export function updateSettings(partial: Partial<Settings>): void {
  settings = { ...settings, ...partial };
  saveSettings();

  if (entries.length > settings.maxTraces) {
    entries.length = settings.maxTraces;
  }

  if (settings.persistTraces) {
    persistEntries();
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }

  notifyListeners();
}

type Listener = () => void;

let entries: TraceEntry[] = loadEntries(settings);
const listeners: Set<Listener> = new Set();

function loadEntries(s: Settings): TraceEntry[] {
  if (!s.persistTraces) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as TraceEntry[];
      return parsed.slice(0, s.maxTraces);
    }
  } catch {}
  return [];
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function persistEntries(): void {
  if (!settings.persistTraces) return;
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, 500);
}

function notifyListeners(): void {
  listeners.forEach((fn) => fn());
}

export function addTrace(entry: TraceEntry): void {
  entries.unshift(entry);
  if (entries.length > settings.maxTraces) {
    entries.length = settings.maxTraces;
  }
  persistEntries();
  notifyListeners();
}

export function getTraces(): readonly TraceEntry[] {
  return entries;
}

export function updateTraceBody(
  traceId: string,
  responseBody: string | undefined,
): void {
  const entry = entries.find((e) => e.traceId === traceId);
  if (entry) {
    entry.responseBody = responseBody;
    persistEntries();
    notifyListeners();
  }
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
```

**Step 2: Verify build**

Run: `npx vite build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/store.ts
git commit -m "fix: debounce persistence, return settings copy, fix double loadSettings"
```

---

### Task 4: Add TTL cache to `src/daemon.ts`

**Files:**
- Modify: `src/daemon.ts`

Add a 5-second TTL cache on `listApps()`.

**Step 1: Add cache to daemon.ts**

Add this after the existing `listApps` function, replacing it:

```ts
let appsCache: { apps: DaemonApp[]; ts: number } | null = null;
const CACHE_TTL = 5000;

export function listApps(): Promise<DaemonApp[]> {
  if (appsCache && Date.now() - appsCache.ts < CACHE_TTL) {
    return Promise.resolve(appsCache.apps);
  }
  return daemonRpc("list-apps").then((apps: DaemonApp[]) => {
    appsCache = { apps, ts: Date.now() };
    return apps;
  });
}
```

**Step 2: Verify build**

Run: `npx vite build`

**Step 3: Commit**

```bash
git add src/daemon.ts
git commit -m "perf: add TTL cache to listApps"
```

---

### Task 5: Clean up `src/intercept.ts`

**Files:**
- Modify: `src/intercept.ts`

Extract `buildTraceEntry()` helper and use WeakMap for XHR metadata.

**Step 1: Rewrite intercept.ts**

```ts
import { addTrace, updateTraceBody, type TraceEntry } from "./store";

const TRACE_HEADER = "x-encore-trace-id";
const MAX_BODY_SIZE = 16_384;

function truncateBody(body: string | undefined): string | undefined {
  if (!body) return body;
  return body.length > MAX_BODY_SIZE
    ? body.slice(0, MAX_BODY_SIZE) + "...(truncated)"
    : body;
}

function parseQueryParams(url: string): Record<string, string> | undefined {
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.search.length <= 1) return undefined;
    const params: Record<string, string> = {};
    parsed.searchParams.forEach((v, k) => { params[k] = v; });
    return Object.keys(params).length > 0 ? params : undefined;
  } catch {
    return undefined;
  }
}

function resolveUrl(url: string): string {
  try {
    return new URL(url, window.location.origin).href;
  } catch {
    return url;
  }
}

function parseCookies(): Record<string, string> | undefined {
  if (!document.cookie) return undefined;
  const cookies: Record<string, string> = {};
  document.cookie.split(";").forEach((c) => {
    const [key, ...rest] = c.split("=");
    const k = key.trim();
    if (k) cookies[k] = rest.join("=").trim();
  });
  return Object.keys(cookies).length > 0 ? cookies : undefined;
}

function buildTraceEntry(opts: {
  method: string;
  url: string;
  status: number;
  traceId: string;
  requestBody?: string;
  responseBody?: string;
}): TraceEntry {
  return {
    method: opts.method,
    url: opts.url,
    status: opts.status,
    traceId: opts.traceId,
    timestamp: Date.now(),
    requestBody: truncateBody(opts.requestBody),
    responseBody: truncateBody(opts.responseBody),
    queryParams: parseQueryParams(opts.url),
    cookies: parseCookies(),
    pageHref: window.location.href,
  };
}

export function patchFetch(): void {
  const originalFetch = window.fetch;

  window.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    try {
      const method = (
        init?.method ?? (input instanceof Request ? input.method : "GET")
      ).toUpperCase();
      const url = resolveUrl(
        input instanceof Request
          ? input.url
          : input instanceof URL
            ? input.href
            : input
      );

      let requestBody: string | undefined;
      if (init?.body != null) {
        requestBody = typeof init.body === "string" ? init.body : undefined;
      } else if (input instanceof Request) {
        requestBody = await input.clone().text().catch(() => undefined);
      }

      const response = await originalFetch.call(window, input, init);

      const traceId = response.headers.get(TRACE_HEADER);
      if (traceId) {
        addTrace(buildTraceEntry({ method, url, status: response.status, traceId, requestBody }));

        response
          .clone()
          .text()
          .then((body) => updateTraceBody(traceId, truncateBody(body)))
          .catch(() => {});
      }

      return response;
    } catch (err) {
      throw err;
    }
  };
}

const xhrMeta = new WeakMap<XMLHttpRequest, { method: string; url: string }>();

export function patchXHR(): void {
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    ...rest: any[]
  ) {
    xhrMeta.set(this, { method: method.toUpperCase(), url: resolveUrl(url.toString()) });
    return originalOpen.apply(this, [method, url, ...rest] as any);
  };

  XMLHttpRequest.prototype.send = function (...args: any[]) {
    const requestBody = typeof args[0] === "string" ? args[0] : undefined;
    this.addEventListener("loadend", () => {
      try {
        const traceId = this.getResponseHeader(TRACE_HEADER);
        if (traceId) {
          const meta = xhrMeta.get(this);
          addTrace(buildTraceEntry({
            method: meta?.method ?? "GET",
            url: meta?.url ?? "",
            status: this.status,
            traceId,
            requestBody,
            responseBody: this.responseText || undefined,
          }));
        }
      } catch {
        // Never let toolbar errors propagate to the host
      }
    });
    return originalSend.apply(this, args as any);
  };
}
```

**Step 2: Verify build**

Run: `npx vite build`

**Step 3: Commit**

```bash
git add src/intercept.ts
git commit -m "refactor: extract buildTraceEntry, use WeakMap for XHR metadata"
```

---

### Task 6: Extract CSS to `src/styles.css`

**Files:**
- Create: `src/styles.css`

Extract the CSS from `ui.ts:getStyles()` into a real CSS file. Deduplicate the three input selectors into a shared `.mono-input` class.

**Step 1: Create styles.css**

Copy the full CSS string from `ui.ts` `getStyles()` (lines 49-1167) into `src/styles.css` as real CSS. Apply these deduplication changes:

1. Add a shared `.mono-input` class and remove duplicated properties from `.app-id-input`, `.path-input`, and `.setting-row input[type="number"]`:

```css
.mono-input {
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

.mono-input:focus {
  border-color: hsla(0,0%,100%,0.3);
}

.mono-input::placeholder {
  color: #555;
}
```

Then `.app-id-input` keeps only its overrides:

```css
.app-id-input {
  width: 100%;
  box-sizing: border-box;
}

.app-id-input::placeholder {
  color: #ee5151;
}

.app-id-input.filled::placeholder {
  color: #555;
}
```

`.path-input` keeps only:

```css
.path-input {
  flex: 1;
  min-width: 100px;
}

.path-input.invalid {
  border-color: #ee5151;
}
```

`.setting-row input[type="number"]` keeps only:

```css
.setting-row input[type="number"] {
  width: 50px;
  padding: 3px 6px;
  text-align: center;
  -moz-appearance: textfield;
}
```

2. Add a shared `.dropdown-menu` class and remove duplicated properties from `.app-id-dropdown` and `.method-menu`:

```css
.dropdown-menu {
  display: none;
  position: absolute;
  background: #111;
  border: 1px solid hsla(0,0%,100%,0.15);
  border-radius: 8px;
  padding: 4px 0;
  z-index: 10;
  box-shadow: 0 8px 30px rgba(0,0,0,0.3);
}

.dropdown-menu.open {
  display: block;
}
```

Then `.app-id-dropdown` keeps only its overrides:

```css
.app-id-dropdown {
  top: calc(100% + 4px);
  right: 0;
  min-width: 100%;
  max-height: 200px;
  overflow-y: auto;
}
```

`.method-menu` keeps only:

```css
.method-menu {
  top: calc(100% + 4px);
  left: 0;
  min-width: 100px;
}
```

3. Keep the `:host` reset, all component styles, and the existing log/detail/prompt styles intact.

The full file is the existing CSS from `getStyles()` with the deduplication changes above applied. Do NOT change any visual behavior -- only consolidate duplicate declarations.

**Step 2: Verify the CSS file is valid**

Run: `npx vite build` (Vite will validate CSS syntax when it is imported later)

**Step 3: Commit**

```bash
git add src/styles.css
git commit -m "refactor: extract CSS to styles.css, dedupe input and dropdown styles"
```

---

### Task 7: Create `src/hooks.ts`

**Files:**
- Create: `src/hooks.ts`

Preact hooks wrapping the store's subscribe pattern.

**Step 1: Create hooks.ts**

```tsx
import { useState, useEffect } from "preact/hooks";
import { getTraces, subscribe, getSettings, updateSettings as storeUpdateSettings, type TraceEntry, type Settings } from "./store";

export function useTraces(): readonly TraceEntry[] {
  const [traces, setTraces] = useState(getTraces);

  useEffect(() => {
    const unsub = subscribe(() => setTraces(getTraces()));
    return unsub;
  }, []);

  return traces;
}

export function useSettings(): [Settings, (partial: Partial<Settings>) => void] {
  const [settings, setSettings] = useState(getSettings);

  useEffect(() => {
    const unsub = subscribe(() => setSettings(getSettings()));
    return unsub;
  }, []);

  return [settings, storeUpdateSettings];
}
```

**Step 2: Verify build**

Run: `npx vite build`

**Step 3: Commit**

```bash
git add src/hooks.ts
git commit -m "feat: add useTraces and useSettings hooks"
```

---

### Task 8: Create shared components

**Files:**
- Create: `src/components/shared/CollapsibleSection.tsx`
- Create: `src/components/shared/ToggleSwitch.tsx`
- Create: `src/components/shared/Dropdown.tsx`
- Create: `src/components/shared/icons.ts`

**Step 1: Create icons.ts**

Centralize repeated SVG markup. These are used as raw HTML in Preact's `dangerouslySetInnerHTML` or as JSX.

```tsx
import { JSX } from "preact";

export function ChevronIcon(): JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export function CopyIcon({ size = 10 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

export function CloseIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

export function GearIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function CheckIcon(): JSX.Element {
  return (
    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="3">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export function InfoIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
      <path d="M12 9h.01" />
      <path d="M11 12h1v4h1" />
    </svg>
  );
}

export const ENCORE_LOGO = `<svg width="18" height="20" viewBox="0 0 60 67" fill="#eaeaea" xmlns="http://www.w3.org/2000/svg"><path d="M60 51.2335V66.1119H0V21.2179C9.50495 19.2126 18.9439 16.625 28.1188 13.4553C39.0759 9.70332 49.703 5.23979 60 0V16.5603C51.2871 20.7004 42.2442 24.323 33.0693 27.4927C22.7063 31.0506 12.0792 33.8969 1.32013 36.0963V36.2257C21.1881 34.4144 40.7261 31.2447 60 26.8458V42.0477C40.7261 46.3172 21.1221 49.3575 1.32013 51.1041V51.2335H60Z"/></svg>`;
```

**Step 2: Create CollapsibleSection.tsx**

```tsx
import { JSX } from "preact";
import { useState, useRef } from "preact/hooks";
import { ChevronIcon, CopyIcon } from "./icons";

interface Props {
  label: string;
  defaultOpen?: boolean;
  copyText?: string;
  children: JSX.Element | JSX.Element[] | string | null;
  contentClass?: string;
}

export function CollapsibleSection({ label, defaultOpen = false, copyText, children, contentClass }: Props): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  const copyBtnRef = useRef<HTMLButtonElement>(null);

  function handleCopy(e: MouseEvent): void {
    e.stopPropagation();
    if (!copyText) return;
    navigator.clipboard.writeText(copyText).then(() => {
      copyBtnRef.current?.classList.add("copied");
      setTimeout(() => copyBtnRef.current?.classList.remove("copied"), 1500);
    });
  }

  return (
    <div class="detail-section">
      <span class={`detail-label collapsible-label${open ? " open" : ""}`} onClick={() => setOpen(!open)}>
        <ChevronIcon />
        {label}
        {copyText != null && (
          <button ref={copyBtnRef} class="section-copy" title="Copy" onClick={handleCopy}>
            <CopyIcon />
          </button>
        )}
      </span>
      <div class={`${contentClass ?? "collapsible-content"}${open ? " open" : ""}`}>
        {children}
      </div>
    </div>
  );
}
```

**Step 3: Create ToggleSwitch.tsx**

```tsx
import { JSX } from "preact";

interface Props {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function ToggleSwitch({ label, checked, onChange }: Props): JSX.Element {
  return (
    <div class="setting-row">
      <span class={`toggle-switch${checked ? " on" : ""}`} onClick={() => onChange(!checked)} />
      {label}
    </div>
  );
}
```

**Step 4: Create Dropdown.tsx**

```tsx
import { JSX } from "preact";
import { useState, useEffect, useRef } from "preact/hooks";

interface Props {
  trigger: JSX.Element;
  children: (close: () => void) => JSX.Element;
  className?: string;
}

export function Dropdown({ trigger, children, className }: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    // Use the shadow root or document as the listener target
    const root = ref.current?.getRootNode() as ShadowRoot | Document;
    root.addEventListener("click", handleClick as EventListener);
    return () => root.removeEventListener("click", handleClick as EventListener);
  }, [open]);

  return (
    <div ref={ref} class={className ?? "method-dropdown"} style={{ position: "relative" }}>
      <div onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        {trigger}
      </div>
      {open && children(() => setOpen(false))}
    </div>
  );
}
```

**Step 5: Verify build**

Run: `npx vite build`

**Step 6: Commit**

```bash
git add src/components/
git commit -m "feat: add shared components (CollapsibleSection, ToggleSwitch, Dropdown, icons)"
```

---

### Task 9: Create leaf components -- Settings, Placement, Prompts, LogViewer, Filters

**Files:**
- Create: `src/components/Settings.tsx`
- Create: `src/components/Placement.tsx`
- Create: `src/components/Prompts.tsx`
- Create: `src/components/LogViewer.tsx`
- Create: `src/components/Filters.tsx`

**Step 1: Create Settings.tsx**

```tsx
import { JSX } from "preact";
import { useSettings } from "../hooks";
import { ToggleSwitch } from "./shared/ToggleSwitch";

export function Settings(): JSX.Element {
  const [settings, update] = useSettings();

  function handleMaxTraces(e: Event): void {
    const input = e.target as HTMLInputElement;
    const val = Math.max(5, Math.min(200, parseInt(input.value, 10) || 25));
    input.value = String(val);
    update({ maxTraces: val });
  }

  return (
    <div class="trace-settings open" style={{ display: "flex" }}>
      <div class="setting-row">
        <input
          type="number"
          class="mono-input"
          min="5"
          max="200"
          value={settings.maxTraces}
          onChange={handleMaxTraces}
        />
        Max traces to keep
      </div>
      <ToggleSwitch
        label="Show event time in logs"
        checked={settings.showLogTime}
        onChange={(v) => update({ showLogTime: v })}
      />
      <ToggleSwitch
        label="Keep traces across reload"
        checked={settings.persistTraces}
        onChange={(v) => update({ persistTraces: v })}
      />
    </div>
  );
}
```

**Step 2: Create Placement.tsx**

```tsx
import { JSX } from "preact";

export type Position = "bottom-right" | "bottom-left" | "top-right" | "top-left" | "side-right" | "side-left";

const FLOATING_POSITIONS: { key: Position; label: string }[] = [
  { key: "top-left", label: "Top left" },
  { key: "top-right", label: "Top right" },
  { key: "bottom-left", label: "Bottom left" },
  { key: "bottom-right", label: "Bottom right" },
];

const FIXED_POSITIONS: { key: Position; label: string }[] = [
  { key: "side-left", label: "Left side" },
  { key: "side-right", label: "Right side" },
];

interface Props {
  position: Position;
  onPositionChange: (pos: Position) => void;
}

function PositionGrid({ items, current, onChange }: { items: typeof FLOATING_POSITIONS; current: Position; onChange: (p: Position) => void }): JSX.Element {
  return (
    <div class={`position-grid${items.length === 2 ? " fixed" : ""}`}>
      {items.map((p) => (
        <button
          key={p.key}
          class={`position-option${current === p.key ? " active" : ""}`}
          data-position={p.key}
          onClick={() => onChange(p.key)}
        >
          <span class="position-dot" />
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function Placement({ position, onPositionChange }: Props): JSX.Element {
  return (
    <div class="settings-page">
      <div class="settings-section">
        <div class="settings-label">Floating</div>
        <PositionGrid items={FLOATING_POSITIONS} current={position} onChange={onPositionChange} />
      </div>
      <div class="settings-section">
        <div class="settings-label">Fixed</div>
        <PositionGrid items={FIXED_POSITIONS} current={position} onChange={onPositionChange} />
      </div>
    </div>
  );
}
```

**Step 3: Create Prompts.tsx**

```tsx
import { JSX } from "preact";
import { useState, useRef } from "preact/hooks";
import { ToggleSwitch } from "./shared/ToggleSwitch";
import { CopyIcon } from "./shared/icons";
import { formatJson } from "../utils";
import type { TraceEntry } from "../store";

interface Props {
  trace: TraceEntry;
}

export function Prompts({ trace }: Props): JSX.Element {
  const [useMcp, setUseMcp] = useState(true);
  const [includeHref, setIncludeHref] = useState(true);
  const copyBtnRef = useRef<HTMLButtonElement>(null);

  function hrefSuffix(): string {
    return includeHref ? ` The request was made from the frontend on href ${trace.pageHref}` : "";
  }

  function getPromptText(): string {
    if (useMcp) {
      return `Debug the trace ${trace.traceId} using the Encore MCP.${hrefSuffix()}`;
    }
    const reqBody = trace.requestBody ? `\n${formatJson(trace.requestBody) || trace.requestBody}` : "";
    const resBody = formatJson(trace.responseBody) || trace.responseBody || "(empty)";
    const hrefLine = includeHref ? `\n\n${hrefSuffix().trim()}` : "";
    return `Debug why the request:\n${trace.method} ${trace.url}${reqBody}\n\nGot the response:\n${resBody}${hrefLine}`;
  }

  function handleCopy(): void {
    navigator.clipboard.writeText(getPromptText()).then(() => {
      copyBtnRef.current?.classList.add("copied");
      setTimeout(() => copyBtnRef.current?.classList.remove("copied"), 1500);
    });
  }

  return (
    <div class="prompt-block">
      <div class="prompt-toggle">
        <span class={`toggle-switch${useMcp ? " on" : ""}`} onClick={() => setUseMcp(!useMcp)} />
        Use Encore MCP
      </div>
      <div class="prompt-toggle">
        <span class={`toggle-switch${includeHref ? " on" : ""}`} onClick={() => setIncludeHref(!includeHref)} />
        Include frontend href
      </div>
      <div class="prompt-box">
        <button ref={copyBtnRef} class="copy-btn" title="Copy to clipboard" onClick={handleCopy}>
          <CopyIcon size={12} />
        </button>
        <span>{getPromptText()}</span>
      </div>
    </div>
  );
}
```

**Step 4: Create LogViewer.tsx**

```tsx
import { JSX } from "preact";
import { useState, useEffect } from "preact/hooks";
import { getTraceLogs, type LogEntry } from "../daemon";
import { escapeHtml } from "../utils";

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

  if (!appId) {
    return <div class="log-empty">Set the App ID above to fetch backend logs</div>;
  }

  if (!state || state.state === "loading") {
    return <div class="log-loading">Loading logs...</div>;
  }

  if (state.state === "error") {
    return <div class="log-error">Failed to load logs: {escapeHtml(state.error.message)}</div>;
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
```

**Step 5: Create Filters.tsx**

```tsx
import { JSX } from "preact";
import { useState, useCallback } from "preact/hooks";
import { Dropdown } from "./shared/Dropdown";
import { CheckIcon } from "./shared/icons";
import type { TraceEntry } from "../store";

const ALL_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export interface FilterState {
  selectedMethods: Set<string>;
  pathRegex: RegExp | null;
  errorsOnly: boolean;
}

export function filterTraces(traces: readonly TraceEntry[], f: FilterState): TraceEntry[] {
  return traces.filter((t) => {
    if (f.errorsOnly && t.status < 400) return false;
    if (!f.selectedMethods.has(t.method)) return false;
    if (f.pathRegex && !f.pathRegex.test(t.url)) return false;
    return true;
  });
}

interface Props {
  onChange: (filter: FilterState) => void;
}

export function Filters({ onChange }: Props): JSX.Element {
  const [selectedMethods, setSelectedMethods] = useState(() => new Set(ALL_METHODS));
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [pathValue, setPathValue] = useState("");
  const [pathValid, setPathValid] = useState(true);
  const [pathRegex, setPathRegex] = useState<RegExp | null>(null);

  const emit = useCallback((methods: Set<string>, regex: RegExp | null, errors: boolean) => {
    onChange({ selectedMethods: methods, pathRegex: regex, errorsOnly: errors });
  }, [onChange]);

  function toggleMethod(m: string): void {
    const next = new Set(selectedMethods);
    if (next.has(m)) {
      if (next.size > 1) next.delete(m);
    } else {
      next.add(m);
    }
    setSelectedMethods(next);
    emit(next, pathRegex, errorsOnly);
  }

  function handlePathInput(e: Event): void {
    const val = (e.target as HTMLInputElement).value.trim();
    setPathValue(val);
    if (!val) {
      setPathRegex(null);
      setPathValid(true);
      emit(selectedMethods, null, errorsOnly);
    } else {
      try {
        const re = new RegExp(val, "i");
        setPathRegex(re);
        setPathValid(true);
        emit(selectedMethods, re, errorsOnly);
      } catch {
        setPathRegex(null);
        setPathValid(false);
      }
    }
  }

  function toggleErrors(): void {
    const next = !errorsOnly;
    setErrorsOnly(next);
    emit(selectedMethods, pathRegex, next);
  }

  const hasMethodFilter = selectedMethods.size < ALL_METHODS.length;

  return (
    <div class="filters">
      <input
        class={`path-input mono-input${pathValid ? "" : " invalid"}`}
        type="text"
        placeholder="Filter path (regex)"
        value={pathValue}
        onInput={handlePathInput}
      />
      <Dropdown
        trigger={<button class={`filter-toggle${hasMethodFilter ? " active" : ""}`}>Methods</button>}
      >
        {() => (
          <div class="method-menu dropdown-menu open">
            {ALL_METHODS.map((m) => (
              <div
                key={m}
                class={`method-option${selectedMethods.has(m) ? " selected" : ""}`}
                onClick={() => toggleMethod(m)}
              >
                <span class="method-check">
                  {selectedMethods.has(m) && <CheckIcon />}
                </span>
                {m}
              </div>
            ))}
          </div>
        )}
      </Dropdown>
      <button class={`filter-toggle${errorsOnly ? " active" : ""}`} onClick={toggleErrors}>
        Errors only
      </button>
    </div>
  );
}
```

**Step 6: Verify build**

Run: `npx vite build`

**Step 7: Commit**

```bash
git add src/components/
git commit -m "feat: add leaf components (Settings, Placement, Prompts, LogViewer, Filters)"
```

---

### Task 10: Create composition components -- DetailPane, TraceList, AppIdInput

**Files:**
- Create: `src/components/DetailPane.tsx`
- Create: `src/components/TraceList.tsx`
- Create: `src/components/AppIdInput.tsx`

**Step 1: Create AppIdInput.tsx**

```tsx
import { JSX } from "preact";
import { useState, useEffect, useRef } from "preact/hooks";
import { listApps, type DaemonApp } from "../daemon";
import { escapeHtml } from "../utils";

interface Props {
  initialValue?: string;
  onChange: (appId: string) => void;
}

export function AppIdInput({ initialValue, onChange }: Props): JSX.Element {
  const [value, setValue] = useState(initialValue ?? "");
  const [apps, setApps] = useState<DaemonApp[]>([]);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  function fetchApps(): void {
    listApps()
      .then((a) => setApps(a))
      .catch(() => setApps([]));
  }

  useEffect(() => { fetchApps(); }, []);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent): void {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    const root = wrapperRef.current?.getRootNode() as ShadowRoot | Document;
    root.addEventListener("click", handleClick as EventListener);
    return () => root.removeEventListener("click", handleClick as EventListener);
  }, [open]);

  const query = value.trim().toLowerCase();
  const filtered = apps.filter(
    (a) => a.name.toLowerCase().includes(query) || a.id.toLowerCase().includes(query)
  );

  function selectApp(id: string): void {
    setValue(id);
    onChange(id);
    setOpen(false);
  }

  function handleInput(e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    setValue(v);
    onChange(v.trim());
  }

  const filled = value.trim().length > 0;

  return (
    <div ref={wrapperRef} class="app-id-wrapper">
      <input
        class={`app-id-input mono-input${filled ? " filled" : ""}`}
        type="text"
        placeholder="Encore App ID"
        value={value}
        onInput={handleInput}
        onFocus={() => { fetchApps(); setTimeout(() => setOpen(true), 100); }}
      />
      {open && filtered.length > 0 && (
        <div class="app-id-dropdown dropdown-menu open">
          <div class="app-id-hint">Fill in the Encore App ID to make linking work better</div>
          {filtered.map((a) => (
            <div key={a.id} class="app-id-option" onClick={() => selectApp(a.id)}>
              <span class={`app-dot ${a.offline ? "offline" : "online"}`} />
              {a.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Create TraceList.tsx**

```tsx
import { JSX } from "preact";
import { escapeHtml, pathname, timeAgo } from "../utils";
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
```

**Step 3: Create DetailPane.tsx**

```tsx
import { JSX } from "preact";
import { useState } from "preact/hooks";
import { CollapsibleSection } from "./shared/CollapsibleSection";
import { CloseIcon } from "./shared/icons";
import { Prompts } from "./Prompts";
import { LogViewer } from "./LogViewer";
import { JsonViewer } from "./JsonViewer";
import { escapeHtml, timeAgo, formatJson } from "../utils";
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
```

**Step 4: Create JsonViewer.tsx**

This replaces `json-viewer.ts`, adapting it as a Preact component.

Create `src/components/JsonViewer.tsx`:

```tsx
import { JSX } from "preact";
import { useRef, useEffect } from "preact/hooks";
import { h, render as preactRender } from "preact";
import { JSONTree } from "react-json-tree";
import { tryParseJson } from "../utils";

const theme = {
  scheme: "encore",
  author: "encore",
  base00: "transparent",
  base01: "#111",
  base02: "#222",
  base03: "#555",
  base04: "#666",
  base05: "#999",
  base06: "#ccc",
  base07: "#eaeaea",
  base08: "#ee5151",
  base09: "#f5a623",
  base0A: "#f5a623",
  base0B: "#50e3c2",
  base0C: "#50e3c2",
  base0D: "#eaeaea",
  base0E: "#999",
  base0F: "#ee5151",
};

interface DataProps {
  data: unknown;
  raw?: never;
}

interface RawProps {
  raw: string | undefined;
  data?: never;
}

type Props = DataProps | RawProps;

export function JsonViewer(props: Props): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  const data = "data" in props && props.data !== undefined ? props.data : undefined;
  const raw = "raw" in props ? props.raw : undefined;

  useEffect(() => {
    if (!ref.current) return;

    if (data !== undefined) {
      const tree = h(JSONTree, {
        data,
        theme,
        invertTheme: false,
        hideRoot: true,
        shouldExpandNodeInitially: (_keyPath: readonly (string | number)[], _data: unknown, level: number) => level < 2,
      });
      preactRender(tree, ref.current);
    } else if (raw !== undefined) {
      const { parsed, isJson } = tryParseJson(raw);
      if (isJson) {
        const tree = h(JSONTree, {
          data: parsed,
          theme,
          invertTheme: false,
          hideRoot: true,
          shouldExpandNodeInitially: (_keyPath: readonly (string | number)[], _data: unknown, level: number) => level < 2,
        });
        preactRender(tree, ref.current);
      } else {
        ref.current.textContent = raw ?? "empty";
      }
    } else {
      ref.current.textContent = "empty";
    }

    return () => {
      if (ref.current) preactRender(null, ref.current);
    };
  }, [data, raw]);

  return <div ref={ref} />;
}
```

**Step 5: Verify build**

Run: `npx vite build`

**Step 6: Commit**

```bash
git add src/components/
git commit -m "feat: add composition components (DetailPane, TraceList, AppIdInput, JsonViewer)"
```

---

### Task 11: Create root `Toolbar.tsx` component

**Files:**
- Create: `src/components/Toolbar.tsx`

This is the root component that owns: panel open/close, position management, active tab, app ID state, selected trace, drag resize. It replaces the old `createWidget()`.

**Step 1: Create Toolbar.tsx**

```tsx
import { JSX } from "preact";
import { useState, useRef, useEffect, useMemo, useCallback } from "preact/hooks";
import { useTraces } from "../hooks";
import { useSettings } from "../hooks";
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

    const onMouseMove = (e: MouseEvent) => {
      let newWidth = position === "side-right"
        ? window.innerWidth - e.clientX
        : e.clientX;
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

  const hasSelection = selectedTraceId != null;
  const selectedTrace = hasSelection ? filteredTraces.find((t) => t.traceId === selectedTraceId) : undefined;

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

    const onMouseMove = (e: MouseEvent) => {
      if (!bodyRef.current || !traceListRef.current) return;
      const rect = bodyRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
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
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
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
```

**Step 2: Verify build**

Run: `npx vite build`

**Step 3: Commit**

```bash
git add src/components/Toolbar.tsx
git commit -m "feat: add root Toolbar component"
```

---

### Task 12: Wire up `main.ts` and delete old files

**Files:**
- Modify: `src/main.ts`
- Delete: `src/ui.ts`
- Delete: `src/json-viewer.ts`

**Step 1: Rewrite main.ts**

```ts
import { patchFetch, patchXHR } from "./intercept";
import { render, h } from "preact";
import { Toolbar } from "./components/Toolbar";
import cssText from "./styles.css?inline";

// Capture script params synchronously before any async work
const scriptSrc = document.currentScript?.getAttribute("src") ?? "";
let scriptParams: URLSearchParams;
try {
  scriptParams = new URL(scriptSrc, window.location.origin).searchParams;
} catch {
  scriptParams = new URLSearchParams();
}

patchFetch();
patchXHR();

function initWidget(): void {
  const opts = {
    appId: scriptParams.get("appId") || scriptParams.get("appID") || undefined,
    envName: scriptParams.get("envName") || scriptParams.get("env") || undefined,
  };

  function mount(): void {
    const host = document.createElement("div");
    host.id = "encore-toolbar";
    const shadow = host.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    style.textContent = cssText;
    shadow.appendChild(style);

    const container = document.createElement("div");
    shadow.appendChild(container);

    render(h(Toolbar, opts), container);
    document.body.appendChild(host);
  }

  if (document.body) {
    mount();
  } else {
    document.addEventListener("DOMContentLoaded", mount);
  }
}

initWidget();
```

**Step 2: Delete old files**

```bash
rm src/ui.ts src/json-viewer.ts
```

**Step 3: Verify build**

Run: `npx vite build`
Expected: Build succeeds with new component tree

**Step 4: Verify dev server**

Run: `npx vite dev` and test in browser with the encore test app. Verify:
- Toggle button appears
- Panel opens/closes
- Traces captured and displayed
- Filters work (method, path, errors)
- Detail pane shows request/response data
- JSON viewer works
- Collapsible sections work
- Settings (max traces, persist, show log time) work
- Placement positions work (all 6)
- Sidebar mode with body push works
- Panel resize works
- App ID autocomplete works
- Backend logs load
- Prompts tab works (MCP toggle, copy)

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: complete Preact migration, delete old imperative UI"
```

---

### Task 13: Final cleanup and build verification

**Files:**
- Possibly modify: any component files needing type fixes or minor adjustments

**Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Fix any type errors.

**Step 2: Run production build**

```bash
npx vite build
```

Verify the output in `dist/encore-toolbar.js` exists and is a single IIFE bundle.

**Step 3: Check bundle size**

```bash
ls -lh dist/encore-toolbar.js
```

Compare with previous bundle size to ensure no significant regression.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore: fix type errors and finalize Preact refactor"
```

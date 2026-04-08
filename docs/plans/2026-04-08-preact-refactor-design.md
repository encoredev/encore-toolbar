# Preact Refactor Design

## Goal

Refactor the toolbar from a 2200-line imperative monolith into a Preact component tree. Fix duplication, performance issues, and structural quality problems identified in the codebase analysis.

## Decisions

- **UI framework**: Preact components (already bundled as a dependency)
- **CSS**: Extract to `styles.css`, import via Vite `?inline`, inject into Shadow DOM
- **Daemon**: Keep one-shot WebSocket, add TTL caching for `listApps()`
- **State**: Store module remains source of truth, exposed via hooks (`useTraces`, `useSettings`)

## File Structure

```
src/
  main.ts              -- entry point (unchanged shape)
  intercept.ts         -- fetch/XHR patching (extract buildTraceEntry, WeakMap for XHR)
  store.ts             -- trace store + settings (fix bugs, debounce persistence)
  daemon.ts            -- RPC client + listApps TTL cache
  styles.css           -- extracted CSS with deduped selectors, shared .mono-input class
  utils.ts             -- escapeHtml, safeParseUrl, copyToClipboard, formatJson
  hooks.ts             -- useTraces(), useSettings() wrapping store.subscribe()
  components/
    Toolbar.tsx         -- root: shadow DOM host, position management, panel open/close
    TraceList.tsx       -- trace table, row selection
    Filters.tsx         -- method dropdown, path regex, errors-only toggle
    DetailPane.tsx      -- request/response detail, JSON viewers
    Prompts.tsx         -- MCP/manual prompt generation + copy
    LogViewer.tsx       -- log fetching, caching (LRU), rendering
    Settings.tsx        -- trace settings (max traces, persist, show log time)
    Placement.tsx       -- position grid (floating + fixed)
    AppIdInput.tsx      -- app ID input with daemon dropdown autocomplete
    shared/
      CollapsibleSection.tsx  -- label + chevron + copy button + collapsible content
      ToggleSwitch.tsx        -- toggle row (label + switch)
      Dropdown.tsx            -- open/close dropdown with click-outside
```

## What Gets Fixed

### Duplication
- Trace entry construction: `buildTraceEntry()` helper in intercept.ts
- JSON formatting: single `formatJson()` in utils.ts
- URL parsing: `safeParseUrl()` in utils.ts
- Collapsible sections: `CollapsibleSection` component (was 6 inline copies)
- CSS input styles: shared `.mono-input` class
- Settings toggles: `ToggleSwitch` component
- Copy-to-clipboard: `copyToClipboard()` in utils.ts
- Dropdown pattern: `Dropdown` component
- Position data: single POSITIONS array, derive floating/fixed by filtering

### Performance
- No render when panel closed: conditional Preact rendering
- Debounced localStorage persistence
- listApps() TTL cache (5s)
- updateTraceBody no longer triggers full re-render (Preact diffing)
- logCache LRU cap (50 entries)

### Quality
- God function eliminated: ~10 focused components
- Mutable settings: getSettings() returns copy
- Double loadSettings: loadEntries uses module-level settings
- XHR any casts: WeakMap
- Stringly-typed logCache: discriminated union
- innerHTML XSS risk: eliminated by Preact's automatic escaping
- Event listener management: handled by Preact lifecycle

## Component Responsibilities

**Toolbar.tsx**: Creates shadow root, manages panel open/close state, position state (reads/writes localStorage), applies body push for sidebar mode, renders panel resize handle. Owns the top-level layout: title bar, tabs, conditional page rendering.

**TraceList.tsx**: Receives filtered traces and selectedTraceId. Renders the trace table (compact when selected, full when not). Emits onSelect callback.

**Filters.tsx**: Owns filter state (selectedMethods, pathRegex, errorsOnly). Exposes filtered traces via callback or context. Uses Dropdown for method menu.

**DetailPane.tsx**: Receives a TraceEntry. Renders tabs (Request, Prompts). Request tab uses CollapsibleSection for URL, query params, cookies, request body, response body. Delegates to LogViewer and Prompts.

**Prompts.tsx**: Receives TraceEntry + appId + envName. Owns useMcp/includeHref toggle state. Generates prompt text. Copy button.

**LogViewer.tsx**: Receives traceId + appId. Manages own fetch lifecycle and LRU cache (module-level Map). Renders log entries with level/time/message/fields.

**Settings.tsx**: Uses useSettings hook. Renders max traces input + toggle switches via ToggleSwitch.

**Placement.tsx**: Receives currentPosition + onPositionChange. Renders floating/fixed grids.

**AppIdInput.tsx**: Manages daemon app list (with cached listApps). Input with dropdown autocomplete. Emits onChange.

## Hooks

**useTraces()**: Subscribes to store, returns current traces. Re-renders component on change.

**useSettings()**: Subscribes to settings changes, returns current settings + updateSettings.

## Migration Strategy

This is a rewrite, not incremental migration. The codebase is small enough (2700 lines) that converting file-by-file is practical. Order:
1. Foundation: utils.ts, styles.css, store.ts fixes, daemon.ts caching, intercept.ts cleanup
2. Hooks: hooks.ts
3. Shared components: CollapsibleSection, ToggleSwitch, Dropdown
4. Leaf components: LogViewer, Prompts, Placement, Settings, Filters
5. Composition: DetailPane, TraceList, AppIdInput
6. Root: Toolbar.tsx
7. Wire up: main.ts creates Toolbar into shadow DOM
8. Delete old ui.ts

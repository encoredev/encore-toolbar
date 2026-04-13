# Trace Link Daemon Fallback Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When a local request lacks both a healthz `app_slug` and a manually-entered App ID, resolve the slug via the Encore daemon (`list-apps` + per-app `status.addr`, disambiguating by port) so the trace link still works.

**Architecture:** Extend `daemon.ts` with a `getAppStatus` RPC wrapper. Add a new `resolveLocalAppSlug` helper in `appinfo.ts` that mirrors the existing sync-check / async-kick-off / repaint pattern. `Toolbar.getTraceUrl` consults it as the third slug source (after healthz and manual App ID) for local URLs only.

**Tech Stack:** TypeScript, Preact, Vite. No test runner in this repo — verification is by running `npm run build` (type-check + bundle) and manual checks in the dev harness (`index.html`). Design doc: `docs/plans/2026-04-13-trace-link-daemon-fallback-design.md`.

---

## Pre-flight: Understand existing patterns

Read these before starting:

- `src/appinfo.ts` — `AppInfo` cache, `getAppInfo` (sync-with-"pending"), `resolveAppInfo` (async).
- `src/daemon.ts` — `daemonRpc`, `listApps`, `DaemonApp` shape, 5-second cache.
- `src/components/Toolbar.tsx:135-148` — current `getTraceUrl` precedence.
- `src/utils.ts` — `isLocalUrl`, `safeParseUrl`.
- Design doc — `docs/plans/2026-04-13-trace-link-daemon-fallback-design.md`.

Daemon RPC facts (verified by probe):
- `list-apps` → `[{ id, name, app_root, offline }]` (no port info).
- `status` with `{ app_id }` param → `{ running: boolean, addr?: string }` when running. `addr` is the listen address (e.g., `"127.0.0.1:4000"` or `":4000"`).

---

### Task 1: Add `getAppStatus` RPC wrapper in `daemon.ts`

**Files:**
- Modify: `src/daemon.ts` (after `listApps`, before the `// --- Trace logs ---` divider)

**Step 1: Add the interface and function**

In `src/daemon.ts`, add after the `listApps` function:

```ts
export interface AppStatus {
  running: boolean;
  addr?: string;
}

export function getAppStatus(appId: string): Promise<AppStatus> {
  return daemonRpc("status", { app_id: appId }).then((r: AppStatus) => r);
}
```

**Step 2: Type-check**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors.

**Step 3: Commit**

```bash
git add src/daemon.ts
git commit -m "feat: add getAppStatus daemon RPC wrapper"
```

---

### Task 2: Add port-parsing helper in `utils.ts`

**Files:**
- Modify: `src/utils.ts` (append)

**Rationale:** Both the request URL's port and the daemon's `addr` string need to be parsed. A single helper keeps the logic DRY and handles the edge cases (empty host, bare `:port`, non-numeric, missing port).

**Step 1: Add helpers**

Append to `src/utils.ts`:

```ts
/** Parse the port from a URL string. Returns null if the URL is invalid or has no explicit/default port. */
export function portFromUrl(url: string): number | null {
  const u = safeParseUrl(url);
  if (!u) return null;
  if (u.port) {
    const n = parseInt(u.port, 10);
    return Number.isFinite(n) ? n : null;
  }
  // Default ports per protocol
  if (u.protocol === "http:") return 80;
  if (u.protocol === "https:") return 443;
  return null;
}

/** Parse the port from a daemon `addr` string (e.g. "127.0.0.1:4000", ":4000", "[::1]:4000"). */
export function portFromAddr(addr: string): number | null {
  const i = addr.lastIndexOf(":");
  if (i < 0) return null;
  const n = parseInt(addr.slice(i + 1), 10);
  return Number.isFinite(n) ? n : null;
}
```

**Step 2: Type-check**

Run: `npm run build`
Expected: build succeeds.

**Step 3: Commit**

```bash
git add src/utils.ts
git commit -m "feat: add portFromUrl and portFromAddr helpers"
```

---

### Task 3: Add `resolveLocalAppSlug` in `appinfo.ts`

**Files:**
- Modify: `src/appinfo.ts`

**Step 1: Add imports and a new cache**

At the top of `src/appinfo.ts`, update the imports:

```ts
import { safeParseUrl, portFromUrl, portFromAddr } from "./utils";
import { listApps, getAppStatus } from "./daemon";
```

Below the existing `cache` / `pending` maps, add:

```ts
// Daemon-based local slug fallback. Keyed by origin. Values:
//   string  → resolved slug
//   null    → looked up, no match (cached for session)
const localSlugCache = new Map<string, string | null>();
const localSlugPending = new Map<string, Promise<string | null>>();
```

**Step 2: Add the async resolution function**

Add below the caches:

```ts
async function resolveSlugViaDaemon(origin: string): Promise<string | null> {
  const port = portFromUrl(origin);
  if (port === null) return null;

  let apps;
  try {
    apps = await listApps();
  } catch {
    return null;
  }

  const running = apps.filter((a) => !a.offline);
  if (running.length === 0) return null;
  if (running.length === 1) return running[0].id;

  // Multiple running apps: match by port via status.addr
  const statuses = await Promise.all(
    running.map((a) =>
      getAppStatus(a.id)
        .then((s) => ({ id: a.id, addr: s.addr }))
        .catch(() => ({ id: a.id, addr: undefined as string | undefined })),
    ),
  );

  const matches = statuses.filter(
    (s) => s.addr && portFromAddr(s.addr) === port,
  );
  if (matches.length === 1) return matches[0].id;
  return null;
}
```

**Step 3: Add the sync-check public API**

Add at the bottom of `src/appinfo.ts`:

```ts
export function resolveLocalAppSlug(requestUrl: string): string | null | "pending" {
  const origin = baseUrl(requestUrl);
  if (!origin) return null;

  if (localSlugCache.has(origin)) return localSlugCache.get(origin)!;

  if (!localSlugPending.has(origin)) {
    const p = resolveSlugViaDaemon(origin).then((slug) => {
      localSlugCache.set(origin, slug);
      localSlugPending.delete(origin);
      return slug;
    });
    localSlugPending.set(origin, p);
  }

  return "pending";
}

export function awaitLocalAppSlug(requestUrl: string): Promise<string | null> {
  const origin = baseUrl(requestUrl);
  if (!origin) return Promise.resolve(null);
  if (localSlugCache.has(origin)) return Promise.resolve(localSlugCache.get(origin)!);
  if (localSlugPending.has(origin)) return localSlugPending.get(origin)!;
  const p = resolveSlugViaDaemon(origin).then((slug) => {
    localSlugCache.set(origin, slug);
    localSlugPending.delete(origin);
    return slug;
  });
  localSlugPending.set(origin, p);
  return p;
}
```

**Step 4: Type-check**

Run: `npm run build`
Expected: build succeeds.

**Step 5: Commit**

```bash
git add src/appinfo.ts
git commit -m "feat: add resolveLocalAppSlug daemon fallback"
```

---

### Task 4: Wire the fallback into `getTraceUrl`

**Files:**
- Modify: `src/components/Toolbar.tsx` (around lines 13 and 135-148)

**Step 1: Update import**

At the top of `Toolbar.tsx`, replace the `appinfo` import:

```ts
import { getAppInfo, resolveAppInfo, resolveLocalAppSlug, awaitLocalAppSlug } from "../appinfo";
```

**Step 2: Update `getTraceUrl` with the new precedence**

Replace the existing `getTraceUrl` callback:

```ts
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
```

Note: the remote branch now checks `!env` explicitly (previously `!slug || !env` guarded both). Local doesn't need `env` since it's hardcoded `"local"`.

**Step 3: Type-check**

Run: `npm run build`
Expected: build succeeds.

**Step 4: Commit**

```bash
git add src/components/Toolbar.tsx
git commit -m "feat: use daemon fallback for local trace slugs"
```

---

### Task 5: Manual verification in dev harness

No automated tests exist in this repo. Verify by running the dev server and
exercising the scenarios below. Document the outcome in the commit message if
anything needed adjustment.

**Step 1: Start the dev harness**

Run: `npm run dev`
Expected: Vite dev server comes up, `index.html` loads the toolbar.

**Step 2: Start the bundled Encore test app**

In a separate terminal:

```bash
cd encore-toolback-test && encore run
```

Expected: One local Encore app running, listening on some port (e.g. `:4000`).

**Step 3: Scenario A — healthz provides slug (no regression)**

In the dev harness, trigger a request to the running local app. Open the
toolbar, click the trace.

Expected: trace link works and uses the healthz-derived slug.

**Step 4: Scenario B — healthz unavailable, daemon single-running fallback**

Temporarily patch `appinfo.ts:fetchAppInfo` to return `null` (or point the
request at a local origin that does not serve healthz). Ensure the manual App
ID field is empty.

Expected: trace link is built using the slug reported by the daemon for the
one running app. Link opens `http://localhost:9400/<slug>/envs/local/traces/<traceId>`.

**Step 5: Scenario C — multi-running disambiguation by port**

If you can run two Encore apps on different ports simultaneously, verify that
a request to port A resolves to app A's slug, and a request to port B resolves
to app B's slug. If two apps can't easily be run, note this as untested.

**Step 6: Scenario D — no running apps**

Stop all local Encore apps. Clear manual App ID. Trigger a local request that
doesn't return healthz.

Expected: the "Trace link could not be created" tooltip appears (null return).

**Step 7: Revert any temporary patches**

Undo any code changes made for testing (e.g., the forced `null` in
`fetchAppInfo`). Confirm `git status` shows only the new production files.

**Step 8: Final type check & build**

Run: `npm run build`
Expected: clean build.

---

## Summary of changes

- `src/daemon.ts` — `getAppStatus` + `AppStatus` interface.
- `src/utils.ts` — `portFromUrl`, `portFromAddr`.
- `src/appinfo.ts` — daemon-backed `resolveLocalAppSlug` / `awaitLocalAppSlug`
  with origin-keyed session cache.
- `src/components/Toolbar.tsx` — new slug precedence (`healthz → manual →
  daemon`), only consults daemon for local URLs.

## Out of scope

- Remote URL daemon fallback.
- Auto-populating the manual App ID input.
- TTL-based cache invalidation for `localSlugCache`.
- A new test suite (repo has none; adding vitest would be a separate task).

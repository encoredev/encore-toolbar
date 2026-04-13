# Trace Link Daemon Fallback — Design

## Summary

Add a third fallback for constructing local trace links when the Encore App ID is
unavailable. Today the slug is sourced from `/__encore/healthz` with a manual
"App ID" settings field as backup. This design adds a daemon-based fallback for
local requests: when healthz has no slug and the manual field is empty, query
the Encore daemon's running-app list and (if needed) per-app `status.addr` to
disambiguate by port.

## Trigger Conditions

All must hold:

1. Request URL is local (`isLocalUrl(requestUrl)` — `localhost` or `127.0.0.1`).
2. `/__encore/healthz` did not return an `app_slug`.
3. Manual "App ID" field is empty.

## Resolution Logic

1. `listApps()` (already 5s-cached in `daemon.ts`).
2. Filter to `!offline` apps → candidates.
3. If 0 candidates → no link.
4. If 1 candidate → use its `id` as slug.
5. If 2+ candidates → call `status({ app_id })` for each, parse port from
   `addr`, match against the request URL's port:
   - Exactly 1 port match → use that slug.
   - 0 or 2+ matches → no link.

Env is hardcoded `"local"` for local URLs (existing behaviour), so the daemon
fallback only needs to supply the slug.

## Slug Precedence

In `getTraceUrl`:

```
healthz.appSlug  →  manual appId  →  daemon fallback (local only)
```

Manual takes priority over daemon to preserve the user's explicit override.
Healthz remains authoritative.

## Code Layout

- **`daemon.ts`**
  - Add `getAppStatus(appId): Promise<{ running: boolean; addr?: string }>`
    wrapping the existing `status` RPC.
- **`appinfo.ts`**
  - Add `resolveLocalAppSlug(requestUrl): string | null | "pending"` mirroring
    the existing `getAppInfo` pattern — synchronous cache check, `"pending"`
    kicks off async work, caller re-renders when ready.
  - Origin-keyed cache (same shape as `AppInfo` cache). Negative results
    (`null`) are cached for the session.
- **`Toolbar.tsx`**
  - Extend `getTraceUrl` to consult `resolveLocalAppSlug` as the third option
    when local + no healthz slug + no manual appId.

## Caching

- Key by `origin` (e.g., `http://localhost:4000`).
- Store positive results (`string`) and negative results (`null`) for the
  session. Pending promises are tracked so concurrent traces coalesce into a
  single daemon roundtrip.
- No TTL. A newly-started local app after a cached negative requires a page
  reload. Accepted trade-off: simpler cache, no re-query storms, and the
  user can always fill in the manual App ID field to break out.

## Edge Cases

- **Daemon unreachable** → cache `null` for the origin; UX matches today.
- **Running app has no `addr`** → treat as "can't disambiguate", skip that
  candidate. If no candidates remain with a port, fallback fails.
- **Port parse failure** from `addr` → treat as unmatched candidate.
- **Non-standard request URLs** (no port, or URL parse failure) → skip
  fallback, return `null`.

## Non-Goals

- Remote (non-local) URL fallback. Remote links still require either healthz
  or manual App ID + env name.
- Auto-populating the manual App ID field. The fallback is silent; user
  experience is that the link simply works.
- TTL-based cache invalidation. Session-lifetime is sufficient.

import { safeParseUrl, portFromUrl, portFromAddr } from "./utils";
import { listApps, getAppStatus } from "./daemon";

export interface AppInfo {
  appSlug: string;
  envName: string;
}

const cache = new Map<string, AppInfo | null>();
const pending = new Map<string, Promise<AppInfo | null>>();

// Daemon-based local slug fallback. Keyed by origin. Values:
//   string  → resolved slug
//   null    → looked up, no match (cached for session)
const localSlugCache = new Map<string, string | null>();
const localSlugPending = new Map<string, Promise<string | null>>();

function baseUrl(url: string): string | null {
  const parsed = safeParseUrl(url);
  return parsed ? parsed.origin : null;
}

async function fetchAppInfo(origin: string): Promise<AppInfo | null> {
  try {
    const res = await fetch(`${origin}/__encore/healthz`);
    if (!res.ok) return null;
    const data = await res.json();
    const slug = data?.details?.app_slug;
    const env = data?.details?.env_name;
    if (typeof slug === "string" && slug && typeof env === "string" && env) {
      return { appSlug: slug, envName: env };
    }
    return null;
  } catch {
    return null;
  }
}

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

export function getAppInfo(requestUrl: string): AppInfo | null | "pending" {
  const origin = baseUrl(requestUrl);
  if (!origin) return null;

  if (cache.has(origin)) return cache.get(origin)!;

  if (!pending.has(origin)) {
    const p = fetchAppInfo(origin).then((info) => {
      cache.set(origin, info);
      pending.delete(origin);
      return info;
    });
    pending.set(origin, p);
  }

  return "pending";
}

export function resolveAppInfo(requestUrl: string): Promise<AppInfo | null> {
  const origin = baseUrl(requestUrl);
  if (!origin) return Promise.resolve(null);

  if (cache.has(origin)) return Promise.resolve(cache.get(origin)!);

  if (pending.has(origin)) return pending.get(origin)!;

  const p = fetchAppInfo(origin).then((info) => {
    cache.set(origin, info);
    pending.delete(origin);
    return info;
  });
  pending.set(origin, p);
  return p;
}

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

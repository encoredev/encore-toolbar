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

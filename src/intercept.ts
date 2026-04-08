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
        const entry: TraceEntry = {
          method,
          url,
          status: response.status,
          traceId,
          timestamp: Date.now(),
          requestBody: truncateBody(requestBody),
          queryParams: parseQueryParams(url),
          cookies: parseCookies(),
          pageHref: window.location.href,
        };
        addTrace(entry);

        // Read response body asynchronously — don't block the caller
        response
          .clone()
          .text()
          .then((body) => updateTraceBody(traceId, truncateBody(body)))
          .catch(() => {});
      }

      return response;
    } catch (err) {
      // Never swallow errors from the original fetch — re-throw as-is
      throw err;
    }
  };
}

export function patchXHR(): void {
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    ...rest: any[]
  ) {
    (this as any).__encoreMethod = method.toUpperCase();
    (this as any).__encoreUrl = resolveUrl(url.toString());
    return originalOpen.apply(this, [method, url, ...rest] as any);
  };

  XMLHttpRequest.prototype.send = function (...args: any[]) {
    const requestBody = typeof args[0] === "string" ? args[0] : undefined;
    this.addEventListener("loadend", () => {
      try {
        const traceId = this.getResponseHeader(TRACE_HEADER);
        if (traceId) {
          const xhrUrl = (this as any).__encoreUrl ?? "";
          addTrace({
            method: (this as any).__encoreMethod ?? "GET",
            url: xhrUrl,
            status: this.status,
            traceId,
            timestamp: Date.now(),
            requestBody: truncateBody(requestBody),
            responseBody: truncateBody(this.responseText || undefined),
            queryParams: parseQueryParams(xhrUrl),
            cookies: parseCookies(),
          });
        }
      } catch {
        // Never let toolbar errors propagate to the host
      }
    });
    return originalSend.apply(this, args as any);
  };
}

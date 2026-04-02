import { addTrace } from "./store";

const TRACE_HEADER = "x-encore-trace-id";

export function patchFetch(): void {
  const originalFetch = window.fetch;

  window.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const url =
      input instanceof Request
        ? input.url
        : input instanceof URL
          ? input.href
          : input;

    const response = await originalFetch.call(window, input, init);

    const traceId = response.headers.get(TRACE_HEADER);
    if (traceId) {
      addTrace({ method, url, traceId, timestamp: Date.now() });
    }

    return response;
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
    (this as any).__encoreUrl = url.toString();
    return originalOpen.apply(this, [method, url, ...rest] as any);
  };

  XMLHttpRequest.prototype.send = function (...args: any[]) {
    this.addEventListener("loadend", () => {
      const traceId = this.getResponseHeader(TRACE_HEADER);
      if (traceId) {
        addTrace({
          method: (this as any).__encoreMethod ?? "GET",
          url: (this as any).__encoreUrl ?? "",
          traceId,
          timestamp: Date.now(),
        });
      }
    });
    return originalSend.apply(this, args as any);
  };
}

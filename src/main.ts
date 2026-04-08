import { patchFetch, patchXHR } from "./intercept";
import { createWidget } from "./ui";

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
  const opts = { appId: scriptParams.get("appId") || scriptParams.get("appID") || undefined };
  if (document.body) {
    createWidget(opts);
  } else {
    document.addEventListener("DOMContentLoaded", () => createWidget(opts));
  }
}

initWidget();

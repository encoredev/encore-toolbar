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

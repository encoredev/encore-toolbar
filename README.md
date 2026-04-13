# Encore Toolbar

A lightweight, drop-in script that adds a floating developer panel to any frontend that talks to an [Encore](https://encore.dev) backend. It intercepts every `fetch()` and `XMLHttpRequest`, captures the `x-encore-trace-id` response header, and lets you jump straight from a request to its trace in the [Development Dashboard](https://encore.dev/docs/ts/observability/dev-dash) or [Encore Cloud](https://app.encore.cloud).

<video src="https://encore.dev/assets/videos/encore-toolbar.mp4" controls muted loop></video>

## Install

Add a single `<script>` tag to your HTML. The toolbar auto-initializes and starts capturing requests.

```html
<script src="https://encore.dev/encore-toolbar.js"></script>
```

The toolbar detects your App ID and environment automatically by calling `/__encore/healthz` on each request's origin. If auto-detection doesn't work — for example, if a proxy sits between your frontend and backend and doesn't expose `/__encore/healthz` — pass them explicitly:

```html
<script src="https://encore.dev/encore-toolbar.js?appId=my-app&envName=staging"></script>
```

| Parameter | Description |
| --------- | ----------- |
| `appId` | Your Encore app slug (the one in your `app.encore.cloud` URL). |
| `envName` | The environment name, e.g. `staging` or `production`. |

You can also set or change these values later from the toolbar's **Settings** panel.

> The script patches `window.fetch` and `XMLHttpRequest` at parse time. Load it **before** your application code and **without** `async` or `defer`. Some HTTP libraries (like Axios) capture a reference to `fetch` at initialization, so placing the script tag as early as possible in `<head>` is important.

## How it works

When your frontend hits an Encore backend, the backend returns an `x-encore-trace-id` header. The toolbar reads this header and records the request along with its trace ID. Only requests that include the header appear in the toolbar.

For each captured request the toolbar shows:

- **Method and URL** — the HTTP method and full URL.
- **Status code** — the response status.
- **Request and response bodies** — captured automatically.
- **Query parameters and cookies** — parsed from the URL and `document.cookie`.
- **Trace link** — a direct link to the trace in the Development Dashboard (local) or Encore Cloud (deployed).
- **Backend logs** — when running locally, the toolbar connects to the local Encore daemon and streams backend log output for the selected trace.

## Troubleshooting

### Requests are not being intercepted

The toolbar only captures requests that return an `x-encore-trace-id` response header.

1. **Verify the header is present.** Open the Network tab, pick a request to your backend, and check the response headers. If `x-encore-trace-id` is missing, the request isn't going through Encore's request handling (it might be hitting a non-Encore server or a proxy that strips headers).
2. **Make sure the script loads before your app.** If application code runs before the script is parsed, those early requests aren't captured. Move the `<script>` tag above your bundle.
3. **Check for script errors.** A network failure (e.g. CSP blocking) or a console error will prevent initialization.

### Trace linking is not working

"Trace link could not be created" means the toolbar lacks enough information. It needs both an App ID and an environment name, auto-detected from `/__encore/healthz`.

1. **Pass parameters explicitly** on the script tag:
   ```html
   <script src="https://encore.dev/encore-toolbar.js?appId=my-app&envName=staging"></script>
   ```
   To avoid hardcoding the environment, add a backend endpoint that redirects to the toolbar with the correct params:
   ```ts
   import { api } from "encore.dev/api";
   import { appMeta } from "encore.dev";

   export const toolbar = api.raw(
     { method: "GET", expose: true, path: "/encore-toolbar.js" },
     async (req, resp) => {
       const appId = appMeta().appId;
       const envName = appMeta().environment.name;
       const url = `https://encore.dev/encore-toolbar.js?appId=${encodeURIComponent(appId)}&envName=${encodeURIComponent(envName)}`;
       resp.writeHead(302, { Location: url });
       resp.end();
     },
   );
   ```
   Then point your script tag at your own backend:
   ```html
   <script src="https://your-api.com/encore-toolbar.js"></script>
   ```
2. **Check that healthz is reachable.** If a proxy or API gateway hides `/__encore/healthz`, either forward that path to the backend or set `appId` and `envName` explicitly.
3. **Set values in the toolbar.** Open **Settings** and fill in the App ID and Environment fields manually.

### Backend logs are not loading

Backend log streaming only works locally. The toolbar connects to the local Encore daemon over WebSocket at `localhost:9400` to fetch logs per trace.

1. **Make sure your app is running** — `encore run` must be active.
2. **Check the environment.** Log streaming is only available for the `local` environment. For deployed environments, use the trace link to view logs in [Encore Cloud](https://app.encore.cloud).
3. **Verify the App ID is set.** If `/__encore/healthz` isn't reachable, set the App ID via the script tag or from the toolbar Settings.

## Development

This repo builds the toolbar bundle.

```bash
npm install
npm run dev    # local dev harness
npm run build  # produces dist/encore-toolbar.js (IIFE, no dependencies)
```

For the dev harness to actually capture traces, start the bundled sample Encore backend in a second terminal:

```bash
cd encore-toolback-test
encore run
```

The bundle is a single self-executing script intended to be served at `https://encore.dev/encore-toolbar.js`. The entire UI lives inside a Shadow DOM so host-page styles cannot leak in.

import { JSX } from "preact";
import { useState, useEffect, useRef } from "preact/hooks";
import { useClickOutside } from "../hooks";
import { listApps, type DaemonApp } from "../daemon";

interface Props {
  initialAppId?: string;
  initialEnvName?: string;
  onAppIdChange: (appId: string) => void;
  onEnvNameChange: (envName: string) => void;
}

export function AppIdInput({ initialAppId, initialEnvName, onAppIdChange, onEnvNameChange }: Props): JSX.Element {
  const [value, setValue] = useState(initialAppId ?? "");
  const [envName, setEnvName] = useState(initialEnvName ?? "");
  const [apps, setApps] = useState<DaemonApp[]>([]);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  function fetchApps(): void {
    listApps()
      .then((a) => setApps(a))
      .catch(() => setApps([]));
  }

  useEffect(() => { fetchApps(); }, []);

  useClickOutside(wrapperRef, open, () => setOpen(false));

  const query = value.trim().toLowerCase();
  const filtered = apps.filter(
    (a) => a.name.toLowerCase().includes(query) || a.id.toLowerCase().includes(query)
  );

  function selectApp(id: string): void {
    setValue(id);
    onAppIdChange(id);
    setOpen(false);
  }

  function handleAppIdInput(e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    setValue(v);
    onAppIdChange(v.trim());
  }

  function handleEnvNameInput(e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    setEnvName(v);
    onEnvNameChange(v.trim());
  }

  return (
    <div ref={wrapperRef} class="app-id-wrapper">
      <div class="app-id-hint">
        If you have problems with trace linking, fill in the Encore App ID (found in the URL on app.encore.cloud) and the environment name.{" "}
        <a href="https://encore.dev/docs/ts/frontend/encore-toolbar" target="_blank" rel="noopener">Learn more</a>
      </div>
      <div class="app-id-row">
        <div class="app-id-field">
          <div class="setting-row">App ID</div>
          <input
            class="app-id-input mono-input"
            type="text"
            value={value}
            onInput={handleAppIdInput}
            onFocus={() => { fetchApps(); setTimeout(() => setOpen(true), 100); }}
            onKeyDown={(e) => { if ((e as KeyboardEvent).key === "Escape") setOpen(false); }}
          />
          {open && filtered.length > 0 && (
            <div class="app-id-dropdown dropdown-menu open">
              {filtered.map((a) => (
                <div key={a.id} class="app-id-option" onClick={() => selectApp(a.id)}>
                  <span class={`app-dot ${a.offline ? "offline" : "online"}`} />
                  {a.name}
                </div>
              ))}
            </div>
          )}
        </div>
        <div class="app-id-field">
          <div class="setting-row">Environment name</div>
          <input
            class="mono-input"
            type="text"
            value={envName}
            onInput={handleEnvNameInput}
            style={{ width: "100%", boxSizing: "border-box" }}
          />
        </div>
      </div>
    </div>
  );
}

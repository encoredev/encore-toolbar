import { JSX } from "preact";
import { useState, useEffect, useRef } from "preact/hooks";
import { listApps, type DaemonApp } from "../daemon";

interface Props {
  initialValue?: string;
  onChange: (appId: string) => void;
}

export function AppIdInput({ initialValue, onChange }: Props): JSX.Element {
  const [value, setValue] = useState(initialValue ?? "");
  const [apps, setApps] = useState<DaemonApp[]>([]);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  function fetchApps(): void {
    listApps()
      .then((a) => setApps(a))
      .catch(() => setApps([]));
  }

  useEffect(() => { fetchApps(); }, []);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent): void {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    const root = wrapperRef.current?.getRootNode() as ShadowRoot | Document;
    root.addEventListener("click", handleClick as EventListener);
    return () => root.removeEventListener("click", handleClick as EventListener);
  }, [open]);

  const query = value.trim().toLowerCase();
  const filtered = apps.filter(
    (a) => a.name.toLowerCase().includes(query) || a.id.toLowerCase().includes(query)
  );

  function selectApp(id: string): void {
    setValue(id);
    onChange(id);
    setOpen(false);
  }

  function handleInput(e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    setValue(v);
    onChange(v.trim());
  }

  const filled = value.trim().length > 0;

  return (
    <div ref={wrapperRef} class="app-id-wrapper">
      <input
        class={`app-id-input mono-input${filled ? " filled" : ""}`}
        type="text"
        placeholder="Encore App ID"
        value={value}
        onInput={handleInput}
        onFocus={() => { fetchApps(); setTimeout(() => setOpen(true), 100); }}
      />
      {open && filtered.length > 0 && (
        <div class="app-id-dropdown dropdown-menu open">
          <div class="app-id-hint">Fill in the Encore App ID to make linking work better</div>
          {filtered.map((a) => (
            <div key={a.id} class="app-id-option" onClick={() => selectApp(a.id)}>
              <span class={`app-dot ${a.offline ? "offline" : "online"}`} />
              {a.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

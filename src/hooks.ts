import { useState, useEffect, useRef } from "preact/hooks";
import { getTraces, subscribe, getSettings, updateSettings as storeUpdateSettings, type TraceEntry, type Settings } from "./store";

export function useClickOutside(
  ref: { current: HTMLElement | null },
  active: boolean,
  onClose: () => void
): void {
  const callbackRef = useRef(onClose);
  callbackRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    function handleClick(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callbackRef.current();
      }
    }
    const root = ref.current?.getRootNode() as ShadowRoot | Document;
    root.addEventListener("click", handleClick as EventListener);
    return () => root.removeEventListener("click", handleClick as EventListener);
  }, [active]);
}

export function useTraces(): readonly TraceEntry[] {
  const [traces, setTraces] = useState(getTraces);

  useEffect(() => {
    const unsub = subscribe(() => setTraces(getTraces()));
    return unsub;
  }, []);

  return traces;
}

export function useSettings(): [Settings, (partial: Partial<Settings>) => void] {
  const [settings, setSettings] = useState(getSettings);

  useEffect(() => {
    const unsub = subscribe(() => setSettings(getSettings()));
    return unsub;
  }, []);

  return [settings, storeUpdateSettings];
}

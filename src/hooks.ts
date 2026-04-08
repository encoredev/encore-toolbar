import { useState, useEffect } from "preact/hooks";
import { getTraces, subscribe, getSettings, updateSettings as storeUpdateSettings, type TraceEntry, type Settings } from "./store";

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

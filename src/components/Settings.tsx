import { JSX } from "preact";
import { useSettings } from "../hooks";
import { ToggleSwitch } from "./shared/ToggleSwitch";

export function Settings(): JSX.Element {
  const [settings, update] = useSettings();

  function handleMaxTraces(e: Event): void {
    const input = e.target as HTMLInputElement;
    const val = Math.max(5, Math.min(200, parseInt(input.value, 10) || 25));
    input.value = String(val);
    update({ maxTraces: val });
  }

  return (
    <div class="trace-settings open" style={{ display: "flex" }}>
      <div class="setting-row">
        <input
          type="number"
          class="mono-input"
          min="5"
          max="200"
          value={settings.maxTraces}
          onChange={handleMaxTraces}
        />
        Max traces to keep
      </div>
      <ToggleSwitch
        label="Show event time in logs"
        checked={settings.showLogTime}
        onChange={(v) => update({ showLogTime: v })}
      />
      <ToggleSwitch
        label="Keep traces across reload"
        checked={settings.persistTraces}
        onChange={(v) => update({ persistTraces: v })}
      />
    </div>
  );
}

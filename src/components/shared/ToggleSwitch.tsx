import { JSX } from "preact";

interface Props {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function ToggleSwitch({ label, checked, onChange }: Props): JSX.Element {
  return (
    <div class="setting-row">
      <span class={`toggle-switch${checked ? " on" : ""}`} onClick={() => onChange(!checked)} />
      {label}
    </div>
  );
}

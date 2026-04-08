import { JSX } from "preact";

export type Position = "bottom-right" | "bottom-left" | "top-right" | "top-left" | "side-right" | "side-left";

const FLOATING_POSITIONS: { key: Position; label: string }[] = [
  { key: "top-left", label: "Top left" },
  { key: "top-right", label: "Top right" },
  { key: "bottom-left", label: "Bottom left" },
  { key: "bottom-right", label: "Bottom right" },
];

const FIXED_POSITIONS: { key: Position; label: string }[] = [
  { key: "side-left", label: "Left side" },
  { key: "side-right", label: "Right side" },
];

interface Props {
  position: Position;
  onPositionChange: (pos: Position) => void;
}

function PositionGrid({ items, current, onChange }: { items: typeof FLOATING_POSITIONS; current: Position; onChange: (p: Position) => void }): JSX.Element {
  return (
    <div class={`position-grid${items.length === 2 ? " fixed" : ""}`}>
      {items.map((p) => (
        <button
          key={p.key}
          class={`position-option${current === p.key ? " active" : ""}`}
          data-position={p.key}
          onClick={() => onChange(p.key)}
        >
          <span class="position-dot" />
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function Placement({ position, onPositionChange }: Props): JSX.Element {
  return (
    <div class="settings-page">
      <div class="settings-section">
        <div class="settings-label">Floating</div>
        <PositionGrid items={FLOATING_POSITIONS} current={position} onChange={onPositionChange} />
      </div>
      <div class="settings-section">
        <div class="settings-label">Fixed</div>
        <PositionGrid items={FIXED_POSITIONS} current={position} onChange={onPositionChange} />
      </div>
    </div>
  );
}

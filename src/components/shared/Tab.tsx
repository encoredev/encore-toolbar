import { JSX } from "preact";

interface Props {
  active: boolean;
  onClick: () => void;
  children: preact.ComponentChildren;
}

export function Tab({ active, onClick, children }: Props): JSX.Element {
  return (
    <button class={`tab${active ? " active" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

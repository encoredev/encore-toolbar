import { JSX } from "preact";
import { useState, useRef } from "preact/hooks";
import { useClickOutside } from "../../hooks";

interface Props {
  trigger: JSX.Element;
  children: (close: () => void) => JSX.Element;
  className?: string;
}

export function Dropdown({ trigger, children, className }: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, open, () => setOpen(false));

  return (
    <div ref={ref} class={className ?? "method-dropdown"} style={{ position: "relative" }}>
      <div onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        {trigger}
      </div>
      {open && children(() => setOpen(false))}
    </div>
  );
}

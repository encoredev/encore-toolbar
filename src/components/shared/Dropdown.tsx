import { JSX } from "preact";
import { useState, useEffect, useRef } from "preact/hooks";

interface Props {
  trigger: JSX.Element;
  children: (close: () => void) => JSX.Element;
  className?: string;
}

export function Dropdown({ trigger, children, className }: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    const root = ref.current?.getRootNode() as ShadowRoot | Document;
    root.addEventListener("click", handleClick as EventListener);
    return () => root.removeEventListener("click", handleClick as EventListener);
  }, [open]);

  return (
    <div ref={ref} class={className ?? "method-dropdown"} style={{ position: "relative" }}>
      <div onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        {trigger}
      </div>
      {open && children(() => setOpen(false))}
    </div>
  );
}

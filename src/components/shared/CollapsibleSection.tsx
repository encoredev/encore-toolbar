import { JSX } from "preact";
import { useState, useRef } from "preact/hooks";
import { ChevronIcon, CopyIcon } from "./icons";

interface Props {
  label: string;
  defaultOpen?: boolean;
  copyText?: string;
  children: preact.ComponentChildren;
  contentClass?: string;
}

export function CollapsibleSection({ label, defaultOpen = false, copyText, children, contentClass }: Props): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  const copyBtnRef = useRef<HTMLButtonElement>(null);

  function handleCopy(e: MouseEvent): void {
    e.stopPropagation();
    if (!copyText) return;
    navigator.clipboard.writeText(copyText).then(() => {
      copyBtnRef.current?.classList.add("copied");
      setTimeout(() => copyBtnRef.current?.classList.remove("copied"), 1500);
    });
  }

  return (
    <div class="detail-section">
      <span class={`detail-label collapsible-label${open ? " open" : ""}`} onClick={() => setOpen(!open)}>
        <ChevronIcon />
        {label}
        {copyText != null && (
          <button ref={copyBtnRef} class="section-copy" title="Copy" onClick={handleCopy}>
            <CopyIcon />
          </button>
        )}
      </span>
      <div class={`${contentClass ?? "collapsible-content"}${open ? " open" : ""}`}>
        {children}
      </div>
    </div>
  );
}

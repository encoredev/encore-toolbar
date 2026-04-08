import { JSX } from "preact";
import { useRef, useEffect } from "preact/hooks";
import { h, render as preactRender } from "preact";
import { JSONTree } from "react-json-tree";
import { tryParseJson } from "../utils";

const theme = {
  scheme: "encore",
  author: "encore",
  base00: "transparent",
  base01: "#111",
  base02: "#222",
  base03: "#555",
  base04: "#666",
  base05: "#999",
  base06: "#ccc",
  base07: "#eaeaea",
  base08: "#ee5151",
  base09: "#f5a623",
  base0A: "#f5a623",
  base0B: "#50e3c2",
  base0C: "#50e3c2",
  base0D: "#eaeaea",
  base0E: "#999",
  base0F: "#ee5151",
};

function renderTree(container: HTMLElement, data: unknown): void {
  const tree = h(JSONTree, {
    data,
    theme,
    invertTheme: false,
    hideRoot: true,
    shouldExpandNodeInitially: (_keyPath: readonly (string | number)[], _data: unknown, level: number) => level < 2,
  });
  preactRender(tree, container);
}

interface DataProps {
  data: unknown;
  raw?: never;
}

interface RawProps {
  raw: string | undefined;
  data?: never;
}

type Props = DataProps | RawProps;

export function JsonViewer(props: Props): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  const data = "data" in props && props.data !== undefined ? props.data : undefined;
  const raw = "raw" in props ? props.raw : undefined;

  useEffect(() => {
    if (!ref.current) return;

    if (data !== undefined) {
      renderTree(ref.current, data);
    } else if (raw !== undefined) {
      const { parsed, isJson } = tryParseJson(raw);
      if (isJson) {
        renderTree(ref.current, parsed);
      } else {
        ref.current.textContent = raw ?? "empty";
      }
    } else {
      ref.current.textContent = "empty";
    }

    return () => {
      if (ref.current) preactRender(null, ref.current);
    };
  }, [data, raw]);

  return <div ref={ref} />;
}

import { h, render as preactRender } from "preact";
import { JSONTree } from "react-json-tree";

const theme = {
  scheme: "encore",
  author: "encore",
  base00: "transparent",  // background
  base01: "#111",
  base02: "#222",
  base03: "#555",          // comments, line numbers
  base04: "#666",
  base05: "#999",
  base06: "#ccc",
  base07: "#eaeaea",       // text
  base08: "#ee5151",       // errors, null, undefined
  base09: "#f5a623",       // numbers, booleans
  base0A: "#f5a623",       // keys (objects)
  base0B: "#50e3c2",       // strings
  base0C: "#50e3c2",       // regex, escape chars
  base0D: "#eaeaea",       // labels
  base0E: "#999",          // constructors
  base0F: "#ee5151",       // deprecated
};

export function renderJson(container: HTMLElement, data: unknown): void {
  const tree = h(JSONTree, {
    data,
    theme,
    invertTheme: false,
    hideRoot: true,
    shouldExpandNodeInitially: (_keyPath: readonly (string | number)[], _data: unknown, level: number) => level < 2,
  });
  preactRender(tree, container);
}

export function unmountJson(container: HTMLElement): void {
  preactRender(null, container);
}

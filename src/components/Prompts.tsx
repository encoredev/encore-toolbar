import { JSX } from "preact";
import { useState, useRef } from "preact/hooks";
import { CopyIcon } from "./shared/icons";
import { formatJson } from "../utils";
import type { TraceEntry } from "../store";

interface Props {
  trace: TraceEntry;
}

export function Prompts({ trace }: Props): JSX.Element {
  const [useMcp, setUseMcp] = useState(true);
  const [includeHref, setIncludeHref] = useState(true);
  const copyBtnRef = useRef<HTMLButtonElement>(null);

  function hrefSuffix(): string {
    return includeHref ? ` The request was made from the frontend on href ${trace.pageHref}` : "";
  }

  function getPromptText(): string {
    if (useMcp) {
      return `Debug the trace ${trace.traceId} using the Encore MCP.${hrefSuffix()}`;
    }
    const reqBody = trace.requestBody ? `\n${formatJson(trace.requestBody) || trace.requestBody}` : "";
    const resBody = formatJson(trace.responseBody) || trace.responseBody || "(empty)";
    const hrefLine = includeHref ? `\n\n${hrefSuffix().trim()}` : "";
    return `Debug why the request:\n${trace.method} ${trace.url}${reqBody}\n\nGot the response:\n${resBody}${hrefLine}`;
  }

  function handleCopy(): void {
    navigator.clipboard.writeText(getPromptText()).then(() => {
      copyBtnRef.current?.classList.add("copied");
      setTimeout(() => copyBtnRef.current?.classList.remove("copied"), 1500);
    });
  }

  return (
    <div class="prompt-block">
      <div class="prompt-toggle">
        <span class={`toggle-switch${useMcp ? " on" : ""}`} onClick={() => setUseMcp(!useMcp)} />
        Use Encore MCP
      </div>
      <div class="prompt-toggle">
        <span class={`toggle-switch${includeHref ? " on" : ""}`} onClick={() => setIncludeHref(!includeHref)} />
        Include frontend href
      </div>
      <div class="prompt-box">
        <button ref={copyBtnRef} class="copy-btn" title="Copy to clipboard" onClick={handleCopy}>
          <CopyIcon size={12} />
        </button>
        <span>{getPromptText()}</span>
      </div>
    </div>
  );
}

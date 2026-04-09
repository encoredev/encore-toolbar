import { JSX } from "preact";
import { useState, useCallback } from "preact/hooks";
import { Dropdown } from "./shared/Dropdown";
import { CheckIcon } from "./shared/icons";
import { isSuccess } from "../utils";
import type { TraceEntry } from "../store";

const ALL_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export interface FilterState {
  selectedMethods: Set<string>;
  pathRegex: RegExp | null;
  errorsOnly: boolean;
}

export const DEFAULT_FILTER: FilterState = {
  selectedMethods: new Set(ALL_METHODS),
  pathRegex: null,
  errorsOnly: false,
};

export function filterTraces(traces: readonly TraceEntry[], f: FilterState): TraceEntry[] {
  return traces.filter((t) => {
    if (f.errorsOnly && isSuccess(t.status)) return false;
    if (!f.selectedMethods.has(t.method)) return false;
    if (f.pathRegex && !f.pathRegex.test(t.url)) return false;
    return true;
  });
}

interface Props {
  onChange: (filter: FilterState) => void;
}

export function Filters({ onChange }: Props): JSX.Element {
  const [selectedMethods, setSelectedMethods] = useState(() => new Set(ALL_METHODS));
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [pathValue, setPathValue] = useState("");
  const [pathValid, setPathValid] = useState(true);
  const [pathRegex, setPathRegex] = useState<RegExp | null>(null);

  const emit = useCallback((methods: Set<string>, regex: RegExp | null, errors: boolean) => {
    onChange({ selectedMethods: methods, pathRegex: regex, errorsOnly: errors });
  }, [onChange]);

  function toggleMethod(m: string): void {
    const next = new Set(selectedMethods);
    if (next.has(m)) {
      if (next.size > 1) next.delete(m);
    } else {
      next.add(m);
    }
    setSelectedMethods(next);
    emit(next, pathRegex, errorsOnly);
  }

  function handlePathInput(e: Event): void {
    const val = (e.target as HTMLInputElement).value.trim();
    setPathValue(val);
    if (!val) {
      setPathRegex(null);
      setPathValid(true);
      emit(selectedMethods, null, errorsOnly);
    } else {
      try {
        const re = new RegExp(val, "i");
        setPathRegex(re);
        setPathValid(true);
        emit(selectedMethods, re, errorsOnly);
      } catch {
        setPathRegex(null);
        setPathValid(false);
      }
    }
  }

  function toggleErrors(): void {
    const next = !errorsOnly;
    setErrorsOnly(next);
    emit(selectedMethods, pathRegex, next);
  }

  const hasMethodFilter = selectedMethods.size < ALL_METHODS.length;

  return (
    <div class="filters">
      <input
        class={`path-input mono-input${pathValid ? "" : " invalid"}`}
        type="text"
        placeholder="Filter path (regex)"
        value={pathValue}
        onInput={handlePathInput}
      />
      <Dropdown
        trigger={<button class={`filter-toggle${hasMethodFilter ? " active" : ""}`}>Methods</button>}
      >
        {() => (
          <div class="method-menu dropdown-menu open">
            {ALL_METHODS.map((m) => (
              <div
                key={m}
                class={`method-option${selectedMethods.has(m) ? " selected" : ""}`}
                onClick={() => toggleMethod(m)}
              >
                <span class="method-check">
                  {selectedMethods.has(m) && <CheckIcon />}
                </span>
                {m}
              </div>
            ))}
          </div>
        )}
      </Dropdown>
      <button class={`filter-toggle${errorsOnly ? " active" : ""}`} onClick={toggleErrors}>
        Errors only
      </button>
    </div>
  );
}

"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SuggestInputProps = {
  value: string;
  onChange: (value: string) => void;
  fetchSuggestions: (q: string) => Promise<string[]>;
  placeholder?: string;
  id?: string;
  className?: string;
  /** Minimum characters before fetching (default 1). */
  minChars?: number;
  /** Debounce delay in ms (default 200). */
  debounceMs?: number;
};

export function SuggestInput({
  value,
  onChange,
  fetchSuggestions,
  placeholder,
  id,
  className,
  minChars = 1,
  debounceMs = 200,
}: SuggestInputProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef(false);
  const suppressRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const [pending, startTransition] = useTransition();
  const reqRef = useRef(0);

  const load = useCallback(
    (q: string) => {
      if (suppressRef.current) return;
      const term = q.trim();
      if (term.length < minChars) {
        setItems([]);
        setOpen(false);
        setActive(-1);
        return;
      }
      const req = ++reqRef.current;
      startTransition(async () => {
        try {
          const next = await fetchSuggestions(term);
          if (req !== reqRef.current || suppressRef.current) return;
          setItems(next);
          setOpen(focusedRef.current && next.length > 0);
          setActive(-1);
        } catch {
          if (req !== reqRef.current) return;
          setItems([]);
          setOpen(false);
        }
      });
    },
    [fetchSuggestions, minChars],
  );

  useEffect(() => {
    if (!focusedRef.current || suppressRef.current) return;
    const t = window.setTimeout(() => load(value), debounceMs);
    return () => window.clearTimeout(t);
  }, [value, debounceMs, load]);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        focusedRef.current = false;
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function pick(item: string) {
    suppressRef.current = true;
    onChange(item);
    setOpen(false);
    setItems([]);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(items[active]!);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          active >= 0 ? `${listId}-option-${active}` : undefined
        }
        onChange={(e) => {
          suppressRef.current = false;
          onChange(e.target.value);
        }}
        onFocus={() => {
          focusedRef.current = true;
          if (!suppressRef.current) load(value);
        }}
        onBlur={() => {
          focusedRef.current = false;
        }}
        onKeyDown={onKeyDown}
      />
      {open && items.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {items.map((item, i) => (
            <li
              key={item}
              id={`${listId}-option-${i}`}
              role="option"
              aria-selected={i === active}
              className={cn(
                "cursor-pointer rounded-sm px-2 py-1.5 text-sm",
                i === active
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent hover:text-accent-foreground",
              )}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(item);
              }}
            >
              {item}
            </li>
          ))}
          {pending && (
            <li className="px-2 py-1 text-xs text-muted-foreground">
              Searching…
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

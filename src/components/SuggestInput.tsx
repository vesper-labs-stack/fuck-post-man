import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Suggestion } from "../utils/headerSuggestions";

interface SuggestInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: Suggestion[];
  placeholder?: string;
  className?: string;
  label?: string;
}

function mark(text: string, q: string): ReactNode {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <span className="font-semibold text-accent">{text.slice(i, i + q.length)}</span>
      {text.slice(i + q.length)}
    </>
  );
}

/** Free-text input with an optional suggestion list: pick or keep typing. */
export default function SuggestInput({
  value,
  onChange,
  suggestions,
  placeholder,
  className = "",
  label,
}: SuggestInputProps) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [above, setAbove] = useState(false);
  const composing = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const q = value.trim().toLowerCase();
  const list = useMemo(() => {
    if (!q) return suggestions.slice(0, 40);
    const starts: Suggestion[] = [];
    const contains: Suggestion[] = [];
    for (const s of suggestions) {
      const lv = s.value.toLowerCase();
      if (lv.startsWith(q)) starts.push(s);
      else if (lv.includes(q)) contains.push(s);
    }
    return [...starts, ...contains].slice(0, 40);
  }, [q, suggestions]);

  const show = open && list.length > 0;

  useEffect(() => {
    setHi(0);
  }, [q, open]);

  useEffect(() => {
    listRef.current?.children[hi]?.scrollIntoView({ block: "nearest" });
  }, [hi, show]);

  const place = () => {
    const r = inputRef.current?.getBoundingClientRect();
    if (r) setAbove(window.innerHeight - r.bottom < 280 && r.top > 280);
  };

  const pick = (s: Suggestion) => {
    onChange(s.value);
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className={`relative min-w-0 ${className}`}>
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={show}
        aria-autocomplete="list"
        aria-label={label}
        className="w-full bg-transparent font-mono text-[12px] text-label outline-none placeholder:text-label3"
        placeholder={placeholder}
        value={value}
        spellCheck={false}
        autoComplete="off"
        onFocus={() => {
          place();
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          onChange(e.target.value);
          place();
          setOpen(true);
        }}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={() => {
          composing.current = false;
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (composing.current && (e.key === "Enter" || e.key === "Escape")) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!show) {
              place();
              setOpen(true);
            } else setHi((h) => (h + 1) % list.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (show) setHi((h) => (h - 1 + list.length) % list.length);
          } else if (e.key === "Enter") {
            if (show && list[hi]) {
              e.preventDefault();
              pick(list[hi]);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          } else if (e.key === "Tab") {
            setOpen(false);
          }
        }}
      />
      {show && (
        <div
          role="listbox"
          aria-label={label}
          className={`absolute left-0 z-40 w-max min-w-full max-w-[380px] overflow-hidden rounded-xl border border-[var(--hairline)] bg-surface shadow-ios-lg animate-menu-in ${
            above ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]"
          }`}
        >
          <div ref={listRef} className="scroll-ios max-h-60 overflow-y-auto py-1">
            {list.map((s, i) => (
              <div
                key={s.value}
                role="option"
                aria-selected={i === hi}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHi(i)}
                onClick={() => pick(s)}
                className={`cursor-pointer px-2.5 py-1.5 ${i === hi ? "bg-fill" : ""}`}
              >
                <p className="truncate font-mono text-[12px] text-label">{mark(s.value, q)}</p>
                {s.description && (
                  <p className="truncate text-[10px] text-label3">{s.description}</p>
                )}
              </div>
            ))}
          </div>
          <p className="border-t border-[var(--hairline)] px-2.5 py-1 text-[10px] text-label3">
            ↑↓ 选择 · Enter 填入 · Esc 关闭 · 可继续输入自定义值
          </p>
        </div>
      )}
    </div>
  );
}
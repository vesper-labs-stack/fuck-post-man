import { useEffect, useRef, useState } from "react";

export interface PointerDragState {
  id: string;
  label: string;
  x: number;
  y: number;
}

interface Options {
  onMove: (x: number, y: number, id: string) => void;
  onDrop: (x: number, y: number, id: string) => void;
  onEnd: () => void;
}

const THRESHOLD = 5;

export function usePointerDrag(options: Options) {
  const [drag, setDrag] = useState<PointerDragState | null>(null);
  const dragRef = useRef<PointerDragState | null>(null);
  const pendingRef = useRef<{
    id: string;
    label: string;
    x0: number;
    y0: number;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const finish = (x: number, y: number, dropped: boolean) => {
      const current = dragRef.current;
      pendingRef.current = null;
      dragRef.current = null;
      setDrag(null);
      document.body.classList.remove("dragging-pointer");
      if (current) {
        suppressClickRef.current = true;
        setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
        if (dropped) optionsRef.current.onDrop(x, y, current.id);
      }
      optionsRef.current.onEnd();
    };
    const onMove = (e: PointerEvent) => {
      const pending = pendingRef.current;
      if (pending && !dragRef.current) {
        if (Math.hypot(e.clientX - pending.x0, e.clientY - pending.y0) < THRESHOLD)
          return;
        dragRef.current = {
          id: pending.id,
          label: pending.label,
          x: e.clientX,
          y: e.clientY,
        };
        document.body.classList.add("dragging-pointer");
      }
      const current = dragRef.current;
      if (!current) return;
      e.preventDefault();
      dragRef.current = { ...current, x: e.clientX, y: e.clientY };
      setDrag(dragRef.current);
      optionsRef.current.onMove(e.clientX, e.clientY, current.id);
    };
    const onUp = (e: PointerEvent) => finish(e.clientX, e.clientY, true);
    const onCancel = () => finish(0, 0, false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      document.body.classList.remove("dragging-pointer");
    };
  }, []);

  const begin = (e: React.PointerEvent, id: string, label: string) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, input, select, a")) return;
    pendingRef.current = { id, label, x0: e.clientX, y0: e.clientY };
  };

  const clickSuppressed = () => suppressClickRef.current;

  return { drag, begin, clickSuppressed };
}

export function hitTest(x: number, y: number, attr: string) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const target = el.closest(`[${attr}]`);
  if (!target) return null;
  return { id: target.getAttribute(attr)!, rect: target.getBoundingClientRect() };
}
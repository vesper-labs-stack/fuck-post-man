import { useEffect } from "react";
import Icon, { type IconName } from "./Icon";
import { useAppStore } from "../store/useAppStore";

/** iOS-style contextual menu rendered at the pointer, frosted + spring-in. */
export default function ContextMenu() {
  const menu = useAppStore((s) => s.contextMenu);
  const close = useAppStore((s) => s.closeContextMenu);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu, close]);

  if (!menu) return null;

  const width = 224;
  const height = menu.items.length * 34 + 10;
  const x = Math.max(8, Math.min(menu.x, window.innerWidth - width - 8));
  const y = Math.max(8, Math.min(menu.y, window.innerHeight - height - 8));

  return (
    <div
      className="fixed inset-0 z-50"
      onMouseDown={close}
      onContextMenu={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <div
        className="material absolute animate-menu-in overflow-hidden rounded-xl border border-separator/40 shadow-ios-lg"
        style={{ left: x, top: y, width }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {menu.items.map((item, i) => (
          <button
            key={i}
            disabled={item.disabled}
            className={`flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[13px] transition disabled:opacity-40 ${
              item.danger
                ? "text-red hover:bg-red/10"
                : "text-label hover:bg-accent hover:text-white"
            }`}
            onClick={() => {
              close();
              item.onSelect();
            }}
          >
            {item.icon && (
              <Icon name={item.icon as IconName} size={15} className="shrink-0" />
            )}
            <span className="flex-1 truncate">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
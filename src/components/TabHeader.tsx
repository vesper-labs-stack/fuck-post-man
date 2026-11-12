import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";
import { useAppStore } from "../store/useAppStore";
import { usePointerDrag, hitTest } from "../hooks/usePointerDrag";
import { methodBadge, methodColor } from "../utils/helpers";

type DropPos = { id: string; side: "left" | "right" } | null;

export default function TabHeader() {
  const tabs = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const closeTab = useAppStore((s) => s.closeTab);
  const addTab = useAppStore((s) => s.addTab);
  const renameTab = useAppStore((s) => s.renameTab);
  const moveTab = useAppStore((s) => s.moveTab);
  const openSaveSheet = useAppStore((s) => s.openSaveSheet);
  const openContextMenu = useAppStore((s) => s.openContextMenu);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [dropPos, setDropPos] = useState<DropPos>(null);
  const [dropEnd, setDropEnd] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuQuery, setMenuQuery] = useState("");
  const menuWrapRef = useRef<HTMLDivElement>(null);

  const menuTabs = useMemo(() => {
    const q = menuQuery.trim().toLowerCase();
    if (!q) return tabs;
    return tabs.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.request.url.toLowerCase().includes(q) ||
        t.request.method.toLowerCase().includes(q),
    );
  }, [tabs, menuQuery]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!menuWrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const activateFromMenu = (id: string) => {
    setActiveTab(id);
    setMenuOpen(false);
    setMenuQuery("");
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-tab-id="${id}"]`)
        ?.scrollIntoView({ inline: "nearest", block: "nearest" });
    });
  };

  const computeTarget = (x: number, y: number, dragId: string) => {
    const hit = hitTest(x, y, "data-tab-id");
    if (hit && hit.id !== dragId) {
      const side = x < hit.rect.left + hit.rect.width / 2 ? "left" : "right";
      return { pos: { id: hit.id, side } as DropPos, end: false };
    }
    const root = document.querySelector("[data-tabs-root]");
    if (root) {
      const r = root.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)
        return { pos: null as DropPos, end: true };
    }
    return { pos: null as DropPos, end: false };
  };

  const { drag, begin, clickSuppressed } = usePointerDrag({
    onMove: (x, y, id) => {
      const t = computeTarget(x, y, id);
      setDropPos(t.pos);
      setDropEnd(t.end);
    },
    onDrop: (x, y, id) => {
      const t = computeTarget(x, y, id);
      let beforeId: string | null = null;
      if (t.pos) {
        if (t.pos.side === "left") {
          beforeId = t.pos.id;
        } else {
          const index = tabs.findIndex((tab) => tab.id === t.pos!.id);
          beforeId = tabs[index + 1]?.id ?? null;
        }
      }
      moveTab(id, beforeId);
    },
    onEnd: () => {
      setDropPos(null);
      setDropEnd(false);
    },
  });

  const dragTab = drag ? tabs.find((t) => t.id === drag.id) : undefined;

  return (
    <div className="flex shrink-0 items-center gap-1 px-3 pt-3">
      <div
        className="scroll-ios flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
        data-tabs-root=""
      >
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          const dropLeft = dropPos?.id === tab.id && dropPos.side === "left";
          const dropRight = dropPos?.id === tab.id && dropPos.side === "right";
          return (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              onPointerDown={(e) => begin(e, tab.id, tab.name)}
              className={`group flex min-w-[120px] max-w-[220px] shrink-0 cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-[12px] transition ${
                active
                  ? "bg-surface text-label shadow-pill"
                  : "text-label2 hover:bg-fill"
              } ${drag?.id === tab.id ? "opacity-40" : ""}`}
              style={{
                boxShadow: dropLeft
                  ? "inset 2px 0 0 0 rgb(var(--accent))"
                  : dropRight
                    ? "inset -2px 0 0 0 rgb(var(--accent))"
                    : undefined,
              }}
              onClick={() => {
                if (clickSuppressed()) return;
                setActiveTab(tab.id);
              }}
              onDoubleClick={() => setEditingId(tab.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                openContextMenu(e.clientX, e.clientY, [
                  { label: "重命名", icon: "pencil", onSelect: () => setEditingId(tab.id) },
                  { label: "保存请求", icon: "bookmark", onSelect: () => openSaveSheet(tab.id) },
                  { label: "关闭页签", icon: "xmark", danger: true, onSelect: () => closeTab(tab.id) },
                ]);
              }}
              title={tab.name}
            >
              <span className={`text-[9px] font-bold ${methodColor(tab.request.method)}`}>
                {tab.request.method}
              </span>
              {editingId === tab.id ? (
                <input
                  autoFocus
                  className="field-ios h-5 flex-1 py-0 text-[12px]"
                  defaultValue={tab.name}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    renameTab(tab.id, e.target.value.trim() || tab.name);
                    setEditingId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
              ) : (
                <span className="flex-1 truncate font-medium">{tab.name}</span>
              )}
              {tab.collectionNodeId && (
                <Icon name="bookmark" size={11} className="shrink-0 text-accent" />
              )}
              <button
                className="icon-btn h-5 w-5 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                title="关闭页签"
              >
                <Icon name="xmark" size={11} />
              </button>
            </div>
          );
        })}
        {dropEnd && (
          <div className="h-5 w-0.5 shrink-0 rounded-full bg-accent" />
        )}
      </div>
      <div className="relative shrink-0" ref={menuWrapRef}>
        <button
          className={`icon-btn ${menuOpen ? "bg-fill text-label" : ""}`}
          onClick={() => {
            setMenuQuery("");
            setMenuOpen((o) => !o);
          }}
          title="全部页签（搜索 / 切换）"
        >
          <Icon name="chevron-down" size={16} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-[340px] overflow-hidden rounded-2xl border border-[var(--hairline)] bg-surface shadow-ios-lg animate-menu-in">
            <div className="border-b border-[var(--hairline)] p-2">
              <div className="relative">
                <Icon
                  name="search"
                  size={13}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-label3"
                />
                <input
                  autoFocus
                  className="field-ios h-8 pl-8 text-[12px]"
                  placeholder="搜索页签：名称 / URL / 方法"
                  value={menuQuery}
                  onChange={(e) => setMenuQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && menuTabs[0]) activateFromMenu(menuTabs[0].id);
                  }}
                />
              </div>
            </div>
            <div className="scroll-ios max-h-[50vh] space-y-0.5 overflow-y-auto p-1.5">
              {menuTabs.map((tab) => (
                <div
                  key={tab.id}
                  onClick={() => activateFromMenu(tab.id)}
                  className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 ${
                    tab.id === activeTabId ? "bg-accent/10" : "hover:bg-fill"
                  }`}
                >
                  <span
                    className={`w-[46px] shrink-0 rounded-md px-1 py-0.5 text-center text-[9px] font-bold ${methodBadge(tab.request.method)}`}
                  >
                    {tab.request.method}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium text-label">
                      {tab.name}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-label3">
                      {tab.request.url || "（无 URL）"}
                    </span>
                  </span>
                  {tab.id === activeTabId && (
                    <Icon name="checkmark" size={13} className="shrink-0 text-accent" />
                  )}
                  <button
                    className="icon-btn h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    title="关闭页签"
                  >
                    <Icon name="xmark" size={11} />
                  </button>
                </div>
              ))}
              {menuTabs.length === 0 && (
                <p className="py-6 text-center text-[12px] text-label2">未找到匹配的页签</p>
              )}
            </div>
            <p className="border-t border-[var(--hairline)] px-3 py-1.5 text-[10px] text-label3">
              {tabs.length} 个页签 · 点击切换 · Enter 打开首项 · Esc 关闭
            </p>
          </div>
        )}
      </div>
      <button className="icon-btn shrink-0" onClick={addTab} title="新建页签">
        <Icon name="plus" size={16} />
      </button>

      {drag &&
        createPortal(
          <div
            className="material pointer-events-none fixed z-[100] flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-medium text-label shadow-ios-lg"
            style={{ left: drag.x + 14, top: drag.y + 12 }}
          >
            <span className={`text-[9px] font-bold ${methodColor(dragTab?.request.method ?? "GET")}`}>
              {dragTab?.request.method ?? "GET"}
            </span>
            {drag.label}
          </div>,
          document.body,
        )}
    </div>
  );
}
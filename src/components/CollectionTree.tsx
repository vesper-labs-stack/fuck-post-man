import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";
import { useAppStore } from "../store/useAppStore";
import { usePointerDrag, hitTest } from "../hooks/usePointerDrag";
import type { CollectionNode, ContextMenuItem } from "../types";
import { childrenOf, descendantIds } from "../utils/collections";
import { createEmptyRequest } from "../utils/factory";
import { methodBadge } from "../utils/helpers";

interface CollectionTreeProps {
  query: string;
}

type DropTarget = { id: string; kind: "into" | "before" | "after" } | "root" | null;

export default function CollectionTree({ query }: CollectionTreeProps) {
  const nodes = useAppStore((s) => s.collectionNodes);
  const openTab = useAppStore((s) => s.openTab);
  const addFolder = useAppStore((s) => s.addFolder);
  const addRequestNode = useAppStore((s) => s.addRequestNode);
  const renameNode = useAppStore((s) => s.renameNode);
  const deleteNode = useAppStore((s) => s.deleteNode);
  const duplicateRequestNode = useAppStore((s) => s.duplicateRequestNode);
  const moveNode = useAppStore((s) => s.moveNode);
  const toggleExpanded = useAppStore((s) => s.toggleExpanded);
  const openContextMenu = useAppStore((s) => s.openContextMenu);
  const openRunner = useAppStore((s) => s.openRunner);
  const renamingId = useAppStore((s) => s.renamingNodeId);
  const requestRename = useAppStore((s) => s.requestRename);

  const [renameValue, setRenameValue] = useState("");
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);
  const [confirmDelete, setConfirmDelete] = useState<CollectionNode | null>(
    null,
  );

  const q = query.trim().toLowerCase();

  // When searching, reveal matches plus their ancestor folders.
  const visible = useMemo(() => {
    if (!q) return null;
    const set = new Set<string>();
    for (const n of nodes) {
      if (n.name.toLowerCase().includes(q)) {
        set.add(n.id);
        let cur = n;
        while (cur.parentId) {
          set.add(cur.parentId);
          cur = nodes.find((x) => x.id === cur.parentId)!;
        }
      }
    }
    return set;
  }, [q, nodes]);

  const startRename = (node: CollectionNode) => {
    requestRename(node.id);
  };

  useEffect(() => {
    if (renamingId) {
      const node = nodes.find((n) => n.id === renamingId);
      setRenameValue(node?.name ?? "");
    }
  }, [renamingId, nodes]);

  const commitRename = () => {
    if (renamingId) {
      const name = renameValue.trim();
      if (name) renameNode(renamingId, name);
    }
    requestRename(null);
  };

  const newFolder = (parentId: string | null) => {
    requestRename(addFolder(parentId, "New Folder"));
  };

  const newRequest = (parentId: string | null) => {
    const request = createEmptyRequest();
    const id = addRequestNode(parentId, "New Request", request);
    openTab("New Request", request, id);
    requestRename(id);
  };

  const computeTarget = (x: number, y: number, dragId: string): DropTarget => {
    const hit = hitTest(x, y, "data-node-id");
    if (hit && hit.id !== dragId) {
      const node = nodes.find((n) => n.id === hit.id);
      if (node) {
        const ratio = (y - hit.rect.top) / hit.rect.height;
        const kind =
          node.type === "folder"
            ? ratio < 0.3
              ? "before"
              : "into"
            : ratio < 0.5
              ? "before"
              : "after";
        return { id: node.id, kind };
      }
    }
    const root = document.querySelector("[data-root-drop]");
    if (root) {
      const r = root.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)
        return "root";
    }
    return null;
  };

  const commitDrop = (id: string, target: DropTarget) => {
    if (!target) return;
    if (target === "root") {
      moveNode(id, null, null);
      return;
    }
    const node = nodes.find((n) => n.id === target.id);
    if (!node || node.id === id) return;
    if (target.kind === "into" && node.type === "folder") {
      moveNode(id, node.id, null);
      if (!node.expanded) toggleExpanded(node.id);
    } else if (target.kind === "after") {
      const siblings = childrenOf(nodes, node.parentId);
      const next = siblings[siblings.findIndex((n) => n.id === node.id) + 1];
      moveNode(id, node.parentId, next?.id ?? null);
    } else {
      moveNode(id, node.parentId, node.id);
    }
  };

  const { drag, begin, clickSuppressed } = usePointerDrag({
    onMove: (x, y, id) => setDropTarget(computeTarget(x, y, id)),
    onDrop: (x, y, id) => commitDrop(id, computeTarget(x, y, id)),
    onEnd: () => setDropTarget(null),
  });

  const menuFor = (node: CollectionNode): ContextMenuItem[] => {
    if (node.type === "folder") {
      return [
        { label: "运行集合", icon: "play", onSelect: () => openRunner(node.id) },
        { label: "新建请求", icon: "doc-plus", onSelect: () => newRequest(node.id) },
        { label: "新建文件夹", icon: "folder-plus", onSelect: () => newFolder(node.id) },
        { label: "重命名", icon: "pencil", onSelect: () => startRename(node) },
        { label: "删除", icon: "trash", danger: true, onSelect: () => setConfirmDelete(node) },
      ];
    }
    return [
      {
        label: "打开",
        icon: "doc",
        onSelect: () => node.request && openTab(node.name, node.request, node.id),
      },
      { label: "重命名", icon: "pencil", onSelect: () => startRename(node) },
      { label: "创建副本", icon: "copy", onSelect: () => duplicateRequestNode(node.id) },
      { label: "删除", icon: "trash", danger: true, onSelect: () => setConfirmDelete(node) },
    ];
  };

  const openMenu = (e: React.MouseEvent, node: CollectionNode) => {
    e.preventDefault();
    e.stopPropagation();
    openContextMenu(e.clientX, e.clientY, menuFor(node));
  };

  const renderNode = (node: CollectionNode, depth: number) => {
    if (visible && !visible.has(node.id)) return null;
    const isFolder = node.type === "folder";
    const expanded = q ? true : !!node.expanded;
    const kids = childrenOf(nodes, node.id);
    const droppingInto =
      dropTarget && dropTarget !== "root" && dropTarget.id === node.id && dropTarget.kind === "into";
    const droppingBefore =
      dropTarget && dropTarget !== "root" && dropTarget.id === node.id && dropTarget.kind === "before";
    const droppingAfter =
      dropTarget && dropTarget !== "root" && dropTarget.id === node.id && dropTarget.kind === "after";

    return (
      <div key={node.id}>
        <div
          data-node-id={node.id}
          onPointerDown={(e) => begin(e, node.id, node.name)}
          onContextMenu={(e) => openMenu(e, node)}
          onClick={() => {
            if (clickSuppressed()) return;
            if (isFolder) toggleExpanded(node.id);
            else if (node.request) openTab(node.name, node.request, node.id);
          }}
          onDoubleClick={() => startRename(node)}
          className={`row-ios group cursor-pointer ${
            droppingInto ? "bg-accent/15 ring-2 ring-accent/50" : ""
          } ${drag?.id === node.id ? "opacity-40" : ""}`}
          style={{
            paddingLeft: depth * 14 + 8,
            boxShadow: droppingBefore
              ? "inset 0 2px 0 0 rgb(var(--accent))"
              : droppingAfter
                ? "inset 0 -2px 0 0 rgb(var(--accent))"
                : undefined,
          }}
        >
          {isFolder ? (
            <>
              <Icon
                name="chevron-right"
                size={12}
                className={`shrink-0 text-label3 transition-transform duration-200 ${
                  expanded ? "rotate-90" : ""
                }`}
              />
              <Icon name="folder" size={16} className="shrink-0 text-accent" />
            </>
          ) : (
            <span
              className={`w-[46px] shrink-0 rounded-md px-1 py-0.5 text-center text-[9px] font-bold ${methodBadge(
                node.request?.method ?? "GET",
              )}`}
            >
              {node.request?.method ?? "GET"}
            </span>
          )}

          {renamingId === node.id ? (
            <input
              autoFocus
              className="field-ios h-6 flex-1 py-0 text-[13px]"
              value={renameValue}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") requestRename(null);
              }}
            />
          ) : (
            <span className="flex-1 truncate text-[13px] text-label">
              {node.name}
            </span>
          )}

          {isFolder && (
            <span className="rounded-full bg-fill px-1.5 text-[10px] text-label2">
              {kids.length}
            </span>
          )}
          <button
            className="icon-btn h-6 w-6 opacity-0 group-hover:opacity-100"
            onClick={(e) => openMenu(e, node)}
            title="更多操作"
          >
            <Icon name="ellipsis" size={14} />
          </button>
        </div>

        {isFolder && expanded && (
          <div>{kids.map((k) => renderNode(k, depth + 1))}</div>
        )}
      </div>
    );
  };

  const roots = childrenOf(nodes, null);
  const dragNode = drag ? nodes.find((n) => n.id === drag.id) : undefined;

  return (
    <div className="flex-1" data-root-drop="">
      {roots.length === 0 && (
        <div className="px-3 py-8 text-center">
          <Icon name="folder" size={28} className="mx-auto mb-2 text-label3" />
          <p className="text-xs text-label2">还没有集合</p>
          <p className="mt-1 text-[11px] text-label3">
            右键或点击下方按钮创建文件夹 / 请求
          </p>
        </div>
      )}
      {roots.map((n) => renderNode(n, 0))}
      {dropTarget === "root" && (
        <div className="mx-2 mt-1 h-0.5 rounded-full bg-accent" />
      )}

      {drag &&
        createPortal(
          <div
            className="material pointer-events-none fixed z-[100] flex items-center gap-2 rounded-xl px-3 py-1.5 text-[12px] font-medium text-label shadow-ios-lg"
            style={{ left: drag.x + 14, top: drag.y + 12 }}
          >
            <Icon
              name={dragNode?.type === "folder" ? "folder" : "doc"}
              size={14}
              className={dragNode?.type === "folder" ? "text-accent" : "text-label2"}
            />
            {drag.label}
          </div>,
          document.body,
        )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 animate-fade-in"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="material w-[300px] animate-sheet-in overflow-hidden rounded-2xl shadow-ios-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pb-4 pt-5 text-center">
              <p className="text-[15px] font-semibold text-label">
                删除“{confirmDelete.name}”？
              </p>
              <p className="mt-1 text-[12px] text-label2">
                {confirmDelete.type === "folder"
                  ? `包含 ${descendantIds(nodes, confirmDelete.id).size} 个子项，删除后不可恢复。`
                  : "删除后不可恢复。"}
              </p>
            </div>
            <div className="grid grid-cols-2 border-t border-separator/40">
              <button
                className="py-2.5 text-[14px] text-accent transition hover:bg-fill"
                onClick={() => setConfirmDelete(null)}
              >
                取消
              </button>
              <button
                className="border-l border-separator/40 py-2.5 text-[14px] font-semibold text-red transition hover:bg-red/10"
                onClick={() => {
                  deleteNode(confirmDelete.id);
                  setConfirmDelete(null);
                }}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
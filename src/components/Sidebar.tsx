import { useState } from "react";
import CollectionTree from "./CollectionTree";
import Icon from "./Icon";
import { useAppStore } from "../store/useAppStore";
import { sanitizeExport, saveReport } from "../services/apiService";
import { createEmptyRequest } from "../utils/factory";
import { formatTime, methodBadge, statusColor } from "../utils/helpers";

export default function Sidebar() {
  const sidebarTab = useAppStore((s) => s.sidebarTab);
  const setSidebarTab = useAppStore((s) => s.setSidebarTab);
  const history = useAppStore((s) => s.history);
  const openTab = useAppStore((s) => s.openTab);
  const addTab = useAppStore((s) => s.addTab);
  const addFolder = useAppStore((s) => s.addFolder);
  const addRequestNode = useAppStore((s) => s.addRequestNode);
  const clearHistory = useAppStore((s) => s.clearHistory);
  const openSaveSheet = useAppStore((s) => s.openSaveSheet);
  const openContextMenu = useAppStore((s) => s.openContextMenu);
  const requestRename = useAppStore((s) => s.requestRename);
  const activeTabId = useAppStore((s) => s.activeTabId);

  const [query, setQuery] = useState("");
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const filteredHistory = history.filter((h) => {
    if (!q) return true;
    return (
      h.url.toLowerCase().includes(q) ||
      h.method.toLowerCase().includes(q) ||
      h.request.body.toLowerCase().includes(q) ||
      h.request.headers.some(
        (kv) =>
          kv.key.toLowerCase().includes(q) ||
          kv.value.toLowerCase().includes(q),
      )
    );
  });

  const newRootRequest = () => {
    const request = createEmptyRequest();
    const id = addRequestNode(null, "New Request", request);
    openTab("New Request", request, id);
    requestRename(id);
  };

  const newRootFolder = () => {
    requestRename(addFolder(null, "New Folder"));
  };

  const exportCollection = async () => {
    const state = useAppStore.getState();
    const doc = {
      app: "fuckpostman",
      kind: "collection",
      version: 1,
      exportedAt: new Date().toISOString(),
      nodes: state.collectionNodes,
    };
    try {
      const names = state.secrets.map((s) => s.name);
      const masked = await sanitizeExport(JSON.stringify(doc, null, 2), names);
      const path = await saveReport("fuckpostman-collection.json", masked);
      setExportMsg(path ? "已导出（机密已脱敏）" : null);
    } catch (e) {
      setExportMsg(e instanceof Error ? e.message : String(e));
    }
    window.setTimeout(() => setExportMsg(null), 2500);
  };

  return (
    <aside className="material flex w-[280px] shrink-0 flex-col border-r border-[var(--hairline)]">
      <div className="flex items-center justify-between px-3 pt-3">
        <div className="seg">
          {(["collections", "history"] as const).map((tab) => (
            <button
              key={tab}
              className={`seg-item ${
                sidebarTab === tab ? "seg-item-active" : "hover:text-label"
              }`}
              onClick={() => setSidebarTab(tab)}
            >
              {tab === "collections" ? "Collections" : "History"}
            </button>
          ))}
        </div>
        <button className="icon-btn" onClick={addTab} title="新建请求页签">
          <Icon name="plus" size={16} />
        </button>
      </div>

      <div className="px-3 pt-3">
        <div className="relative">
          <Icon
            name="search"
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-label3"
          />
          <input
            className="field-ios rounded-full pl-8 text-[13px]"
            placeholder="搜索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-1 px-3 py-2">
        {sidebarTab === "collections" ? (
          <>
            <button
              className="icon-btn"
              title="新建文件夹"
              onClick={newRootFolder}
            >
              <Icon name="folder-plus" size={16} />
            </button>
            <button
              className="icon-btn"
              title="新建请求"
              onClick={newRootRequest}
            >
              <Icon name="doc-plus" size={16} />
            </button>
            <button
              className="icon-btn"
              title="保存当前请求"
              onClick={() => openSaveSheet(activeTabId)}
            >
              <Icon name="bookmark" size={16} />
            </button>
            <button
              className="icon-btn"
              title="导出 Collection（机密自动脱敏）"
              onClick={() => void exportCollection()}
            >
              <Icon name="download" size={16} />
            </button>
            {exportMsg ? (
              <span
                className={`ml-auto truncate text-[11px] font-medium ${
                  exportMsg.startsWith("已导出") ? "text-green" : "text-red"
                }`}
                title={exportMsg}
              >
                {exportMsg}
              </span>
            ) : (
              <span className="ml-auto text-[11px] text-label3">
                右键管理 · 拖拽归类
              </span>
            )}
          </>
        ) : (
          <>
            <button
              className="btn-plain text-[12px] text-red hover:bg-red/10"
              onClick={clearHistory}
              disabled={history.length === 0}
            >
              <Icon name="trash" size={14} />
              清空历史
            </button>
            <span className="ml-auto text-[11px] text-label3">
              {history.length} 条
            </span>
          </>
        )}
      </div>

      <div
        className="scroll-ios min-h-0 flex-1 overflow-y-auto px-2 pb-3"
        onContextMenu={(e) => {
          if (sidebarTab !== "collections") return;
          e.preventDefault();
          openContextMenu(e.clientX, e.clientY, [
            { label: "新建文件夹", icon: "folder-plus", onSelect: newRootFolder },
            { label: "新建请求", icon: "doc-plus", onSelect: newRootRequest },
          ]);
        }}
      >
        {sidebarTab === "collections" ? (
          <CollectionTree query={query} />
        ) : (
          <div className="space-y-0.5">
            {filteredHistory.length === 0 && (
              <div className="px-3 py-8 text-center">
                <Icon name="clock" size={28} className="mx-auto mb-2 text-label3" />
                <p className="text-xs text-label2">
                  {history.length === 0 ? "暂无历史记录" : "未找到匹配的历史"}
                </p>
              </div>
            )}
            {filteredHistory.map((entry) => (
              <button
                key={entry.id}
                className="row-ios w-full text-left"
                onClick={() => openTab(entry.url || "History", entry.request)}
              >
                <span
                  className={`w-[46px] shrink-0 rounded-md px-1 py-0.5 text-center text-[9px] font-bold ${methodBadge(
                    entry.method,
                  )}`}
                >
                  {entry.method}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[11px] text-label">
                    {entry.url}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-[10px]">
                    <span className={entry.status ? statusColor(entry.status) : "text-red"}>
                      {entry.status ?? "ERR"}
                    </span>
                    <span className="text-label3">{formatTime(entry.timestamp)}</span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
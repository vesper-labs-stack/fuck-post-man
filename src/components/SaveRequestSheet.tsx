import { useState } from "react";
import Icon from "./Icon";
import { useAppStore } from "../store/useAppStore";
import { folderList } from "../utils/collections";

/** iOS-style sheet: name the request and choose a destination folder. */
export default function SaveRequestSheet() {
  const tabId = useAppStore((s) => s.saveSheetTabId);
  const tabs = useAppStore((s) => s.tabs);
  const nodes = useAppStore((s) => s.collectionNodes);
  const saveRequestFromTab = useAppStore((s) => s.saveRequestFromTab);
  const closeSaveSheet = useAppStore((s) => s.closeSaveSheet);

  const tab = tabs.find((t) => t.id === tabId);
  const linked = tab?.collectionNodeId
    ? nodes.find((n) => n.id === tab.collectionNodeId)
    : undefined;

  const [name, setName] = useState(tab?.name ?? "Untitled Request");
  const [parentId, setParentId] = useState<string | null>(
    linked?.parentId ?? null,
  );

  if (!tab) return null;

  const folders = folderList(nodes);
  const isUpdate = !!linked;

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    saveRequestFromTab(tab.id, trimmed, parentId);
    closeSaveSheet();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in"
      onClick={closeSaveSheet}
    >
      <div
        className="w-[400px] animate-sheet-in overflow-hidden rounded-2xl bg-surface shadow-ios-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4">
          <h2 className="text-[15px] font-semibold text-label">
            {isUpdate ? "更新已保存的请求" : "保存请求"}
          </h2>
          <button className="icon-btn" onClick={closeSaveSheet} title="关闭">
            <Icon name="xmark" size={14} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-label2">
              名称
            </label>
            <input
              autoFocus
              className="field-ios"
              value={name}
              placeholder="例如：获取用户列表"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-label2">
              保存到文件夹
            </label>
            <div className="relative">
              <select
                className="field-ios appearance-none pr-8"
                value={parentId ?? ""}
                onChange={(e) => setParentId(e.target.value || null)}
              >
                <option value="">根目录（无文件夹）</option>
                {folders.map(({ node, depth }) => (
                  <option key={node.id} value={node.id}>
                    {" ".repeat(depth)}{depth > 0 ? "└ " : ""}{node.name}
                  </option>
                ))}
              </select>
              <Icon
                name="chevron-up-down"
                size={14}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-label2"
              />
            </div>
          </div>
          <p className="text-[11px] text-label3">
            保存后可在左侧 Collections 中管理、重命名或拖拽归类。
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-separator/40 px-5 py-3">
          <button className="btn-secondary justify-center" onClick={closeSaveSheet}>
            取消
          </button>
          <button className="btn-primary justify-center" onClick={submit}>
            <Icon name="bookmark" size={14} />
            {isUpdate ? "更新" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
import { useRef, useState } from "react";
import Icon from "./Icon";
import RequestBar from "./RequestBar";
import RequestSection from "./RequestSection";
import ResponseSection from "./ResponseSection";
import TabHeader from "./TabHeader";
import { useActiveTab, useAppStore } from "../store/useAppStore";

export default function MainArea() {
  const tab = useActiveTab();
  const addTab = useAppStore((s) => s.addTab);
  const splitRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(45);
  const [dragging, setDragging] = useState(false);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const container = splitRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    setDragging(true);
    const onMove = (ev: MouseEvent) => {
      const pct = ((ev.clientY - rect.top) / rect.height) * 100;
      setRatio(Math.min(80, Math.max(20, pct)));
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <TabHeader />
      {tab ? (
        <div key={tab.id} className="flex min-h-0 flex-1 flex-col">
          <RequestBar tab={tab} />
          <div ref={splitRef} className="flex min-h-0 flex-1 flex-col">
            <div
              style={{ height: `${ratio}%` }}
              className="flex min-h-0 flex-col"
            >
              <RequestSection tab={tab} />
            </div>
            <div
              className="group flex h-3 shrink-0 cursor-row-resize items-center justify-center"
              onMouseDown={startDrag}
              title="拖拽调整请求 / 响应区域高度"
            >
              <div
                className={`h-1 w-10 rounded-full transition-colors ${
                  dragging ? "bg-accent" : "bg-fill2 group-hover:bg-accent/50"
                }`}
              />
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              <ResponseSection tab={tab} />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 animate-fade-in flex-col items-center justify-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-gradient-to-br from-accent to-indigo text-white shadow-ios-lg">
            <Icon name="bolt" size={36} strokeWidth={1.6} />
          </div>
          <div className="text-center">
            <p className="text-[17px] font-semibold">开始调试 API</p>
            <p className="mt-1 text-[13px] text-label2">
              新建页签，或从 Collections 打开一个已保存的请求
            </p>
          </div>
          <button className="btn-primary" onClick={addTab}>
            <Icon name="plus" size={14} />
            新建请求
          </button>
        </div>
      )}
    </main>
  );
}
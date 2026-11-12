import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Icon from "./Icon";
import { useAppStore } from "../store/useAppStore";

interface TopBarProps {
  onManageEnvironment: () => void;
}

const appWindow = getCurrentWindow();

export default function TopBar({ onManageEnvironment }: TopBarProps) {
  const environments = useAppStore((s) => s.environments);
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId);
  const setActiveEnvironment = useAppStore((s) => s.setActiveEnvironment);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const openRunner = useAppStore((s) => s.openRunner);
  const openLoadTest = useAppStore((s) => s.openLoadTest);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    appWindow.isMaximized().then(setMaximized);
    appWindow
      .onResized(() => {
        appWindow.isMaximized().then(setMaximized);
      })
      .then((fn) => {
        unlisten = fn;
      });
    return () => unlisten?.();
  }, []);

  return (
    <header
      data-tauri-drag-region
      className="material bar-border flex h-[52px] shrink-0 items-center justify-between pl-4 pr-2"
    >
      <div data-tauri-drag-region className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-gradient-to-br from-teal to-accent shadow-pill">
          <Icon name="bolt" size={15} className="text-white" strokeWidth={2.2} />
        </div>
        <span data-tauri-drag-region className="text-[15px] font-semibold tracking-tight text-label">
          fuckpostman
        </span>
        <span className="rounded-full bg-fill px-2 py-0.5 text-[10px] font-medium text-label2">
          API Studio
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          className="btn-secondary flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium"
          onClick={() => openRunner()}
          title="批量运行集合（Runner）"
        >
          <Icon name="play" size={13} />
          Runner
        </button>
        <button
          className="btn-secondary flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium"
          onClick={() => openLoadTest()}
          title="对当前请求进行压力测试（Load Test）"
        >
          <Icon name="bolt" size={13} />
          压测
        </button>
        <div className="relative">
          <Icon
            name="globe"
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-label2"
          />
          <select
            className="field-ios h-8 appearance-none rounded-full pl-8 pr-8 text-[12px] font-medium"
            value={activeEnvironmentId ?? ""}
            onChange={(e) => setActiveEnvironment(e.target.value || null)}
            title="选择环境"
          >
            <option value="">无环境</option>
            {environments.map((env) => (
              <option key={env.id} value={env.id}>
                {env.name}
              </option>
            ))}
          </select>
          <Icon
            name="chevron-up-down"
            size={12}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-label2"
          />
        </div>
        <button
          className="icon-btn h-8 w-8"
          onClick={onManageEnvironment}
          title="管理环境变量"
        >
          <Icon name="sliders" size={16} />
        </button>
        <button
          className="icon-btn h-8 w-8"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={theme === "dark" ? "切换到浅色" : "切换到深色"}
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
        </button>

        <div className="ml-2 flex items-center gap-0.5">
          <button
            className="icon-btn h-8 w-8"
            onClick={() => appWindow.minimize()}
            title="最小化"
          >
            <Icon name="minus" size={14} />
          </button>
          <button
            className="icon-btn h-8 w-8"
            onClick={() => appWindow.toggleMaximize()}
            title={maximized ? "还原" : "最大化"}
          >
            <Icon name="square" size={12} />
          </button>
          <button
            className="icon-btn h-8 w-8 hover:bg-red hover:text-white"
            onClick={() => appWindow.close()}
            title="关闭"
          >
            <Icon name="xmark" size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}
import { useEffect, useState } from "react";
import ContextMenu from "./components/ContextMenu";
import EnvironmentManager from "./components/EnvironmentManager";
import LoadTestSheet from "./components/LoadTestSheet";
import MainArea from "./components/MainArea";
import RunnerSheet from "./components/RunnerSheet";
import SaveRequestSheet from "./components/SaveRequestSheet";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import { useAppStore } from "./store/useAppStore";

export default function App() {
  const [envManagerOpen, setEnvManagerOpen] = useState(false);
  const theme = useAppStore((s) => s.theme);
  const saveSheetTabId = useAppStore((s) => s.saveSheetTabId);
  const runnerOpen = useAppStore((s) => s.runnerOpen);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg text-label">
      <TopBar onManageEnvironment={() => setEnvManagerOpen(true)} />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <MainArea />
      </div>
      {envManagerOpen && (
        <EnvironmentManager onClose={() => setEnvManagerOpen(false)} />
      )}
      {saveSheetTabId && <SaveRequestSheet />}
      {runnerOpen && <RunnerSheet />}
      <LoadTestSheet />
      <ContextMenu />
    </div>
  );
}
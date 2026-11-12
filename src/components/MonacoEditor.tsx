import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useAppStore } from "../store/useAppStore";

interface MonacoEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: string;
  readOnly?: boolean;
  height?: string;
  onMount?: (editor: editor.IStandaloneCodeEditor) => void;
}

/** Monaco wrapper themed to match the iOS light/dark appearance. */
export default function MonacoEditor({
  value,
  onChange,
  language = "json",
  readOnly = false,
  height = "100%",
  onMount,
}: MonacoEditorProps) {
  const theme = useAppStore((s) => s.theme);

  return (
    <Editor
      height={height}
      language={language}
      theme={theme === "dark" ? "ios-dark" : "ios-light"}
      value={value}
      onChange={(next) => onChange?.(next ?? "")}
      onMount={onMount}
      loading={
        <div className="flex h-full items-center justify-center text-sm text-label2">
          加载编辑器…
        </div>
      }
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: "SF Mono, ui-monospace, Cascadia Code, Consolas, monospace",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: "on",
        tabSize: 2,
        renderLineHighlight: "none",
        folding: true,
        showFoldingControls: "always",
        foldingHighlight: true,
        matchBrackets: "always",
        bracketPairColorization: { enabled: true },
        guides: {
          bracketPairs: true,
          highlightActiveBracketPair: true,
          indentation: true,
        },
        find: { seedSearchStringFromSelection: "selection" },
        stickyScroll: { enabled: false },
        padding: { top: 10, bottom: 10 },
        scrollbar: {
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8,
          useShadows: false,
        },
      }}
    />
  );
}
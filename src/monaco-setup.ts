// Bundle Monaco locally so the editor works fully offline inside the Tauri
// webview, and register iOS-flavoured light/dark themes.
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";

(self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment =
  {
    getWorker(_workerId: string, label: string): Worker {
      if (label === "json") return new jsonWorker();
      return new editorWorker();
    },
  };

monaco.editor.defineTheme("ios-light", {
  base: "vs",
  inherit: true,
  rules: [
    { token: "string.key.json", foreground: "007AFF" },
    { token: "string.value.json", foreground: "FF3B30" },
    { token: "string", foreground: "FF3B30" },
    { token: "number", foreground: "AF52DE" },
    { token: "keyword", foreground: "FF2D55" },
    { token: "comment", foreground: "8E8E93" },
  ],
  colors: {
    "editor.background": "#FFFFFF",
    "editor.foreground": "#1C1C1E",
    "editorLineNumber.foreground": "#C7C7CC",
    "editorLineNumber.activeForeground": "#8E8E93",
    "editor.selectionBackground": "#B4D8FD",
    "editor.lineHighlightBackground": "#F2F2F7",
    "editorIndentGuide.background": "#E5E5EA",
    "editorWidget.background": "#FFFFFF",
    "scrollbarSlider.background": "#C7C7CC80",
    "scrollbarSlider.hoverBackground": "#AEAEB2AA",
  },
});

monaco.editor.defineTheme("ios-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "string.key.json", foreground: "0A84FF" },
    { token: "string.value.json", foreground: "FF453A" },
    { token: "string", foreground: "FF453A" },
    { token: "number", foreground: "BF5AF2" },
    { token: "keyword", foreground: "FF375F" },
    { token: "comment", foreground: "8E8E93" },
  ],
  colors: {
    "editor.background": "#1C1C1E",
    "editor.foreground": "#EBEBF5",
    "editorLineNumber.foreground": "#48484A",
    "editorLineNumber.activeForeground": "#8E8E93",
    "editor.selectionBackground": "#0A84FF40",
    "editor.lineHighlightBackground": "#2C2C2E",
    "editorIndentGuide.background": "#3A3A3C",
    "editorWidget.background": "#2C2C2E",
    "scrollbarSlider.background": "#48484A80",
    "scrollbarSlider.hoverBackground": "#5A5A5EAA",
  },
});

loader.config({ monaco });

monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
  validate: true,
  allowComments: false,
  trailingCommas: "error",
  schemaValidation: "error",
  enableSchemaRequest: false,
});
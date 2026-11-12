import { useEffect, useMemo, useRef, useState } from "react";
import type { editor } from "monaco-editor";
import Icon from "./Icon";
import MonacoEditor from "./MonacoEditor";
import type { RequestTab } from "../types";
import { formatBytes, formatMs, statusBadge } from "../utils/helpers";

interface ResponseSectionProps {
  tab: RequestTab;
}

type ResponseTab = "pretty" | "raw" | "headers";

export default function ResponseSection({ tab }: ResponseSectionProps) {
  const [respTab, setRespTab] = useState<ResponseTab>("pretty");
  const [copied, setCopied] = useState(false);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const liveRef = useRef<HTMLPreElement | null>(null);
  const stickRef = useRef(true);
  const { response } = tab;
  const data = response.data;

  // Follow the stream unless the user has scrolled up to read earlier text.
  useEffect(() => {
    if (!response.streamText) stickRef.current = true;
    const el = liveRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [response.streamText]);

  const pretty = useMemo(() => {
    if (!data) return { text: "", language: "plaintext" };
    const contentType = (data.headers["content-type"] ?? "").toLowerCase();
    const trimmed = data.body.trim();
    const looksJson =
      contentType.includes("json") ||
      trimmed.startsWith("{") ||
      trimmed.startsWith("[");
    if (looksJson) {
      try {
        return {
          text: JSON.stringify(JSON.parse(data.body), null, 2),
          language: "json",
        };
      } catch {
        /* fall through to raw text */
      }
    }
    return { text: data.body, language: "plaintext" };
  }, [data]);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="card mx-3 mb-3 flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--hairline)] px-3 py-2">
        <span className="text-[12px] font-semibold text-label2">Response</span>
        {data && (
          <>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusBadge(
                data.status_code,
              )}`}
            >
              {data.status_code} {data.status_text}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-label2">
              <Icon name="clock" size={12} />
              {formatMs(data.time_elapsed_ms)}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-label2">
              <Icon name="doc" size={12} />
              {formatBytes(data.size_bytes)}
            </span>
          </>
        )}
        {response.streaming ? (
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-accent">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            流式接收中
          </span>
        ) : (
          response.loading && (
            <span className="text-[11px] font-medium text-accent">请求中…</span>
          )
        )}
        {response.error && (
          <span className="rounded-full bg-red/15 px-2.5 py-0.5 text-[11px] font-bold text-red">
            请求失败
          </span>
        )}

        {data && !response.streaming && (
          <div className="seg ml-auto">
            {(["pretty", "raw", "headers"] as const).map((t) => (
              <button
                key={t}
                className={`seg-item capitalize ${
                  respTab === t ? "seg-item-active" : "hover:text-label"
                }`}
                onClick={() => setRespTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {data && response.assertionResults && response.assertionResults.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-[var(--hairline)] px-3 py-2">
          <span className="text-[11px] font-semibold text-label2">断言</span>
          {response.assertionResults.map((r) => (
            <span
              key={r.id}
              title={r.detail}
              className={`flex max-w-[280px] items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                r.passed ? "bg-green/15 text-green" : "bg-red/15 text-red"
              }`}
            >
              <Icon name={r.passed ? "checkmark" : "xmark"} size={11} />
              <span className="truncate">
                {r.label} {r.detail}
              </span>
            </span>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1">
        {response.streaming && (
          <div className="flex h-full flex-col">
            <div className="flex shrink-0 items-center gap-1 border-b border-[var(--hairline)] px-3 py-1.5">
              <span className="text-[11px] text-label2">
                {response.streamText.length} 字符 · 实时接收
              </span>
              <button
                className="btn-plain ml-auto text-[12px]"
                onClick={() => void copyText(response.streamText)}
              >
                <Icon name={copied ? "checkmark" : "copy"} size={12} />
                {copied ? "已复制" : "复制"}
              </button>
            </div>
            <pre
              ref={liveRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                stickRef.current =
                  el.scrollHeight - el.scrollTop - el.clientHeight < 40;
              }}
              className="scroll-ios min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-all p-4 font-mono text-[12px] text-label"
            >
              {response.streamText}
              <span className="animate-pulse text-accent">▍</span>
            </pre>
          </div>
        )}

        {response.error && (
          <div className="scroll-ios h-full overflow-y-auto p-4">
            <div className="rounded-xl bg-red/10 p-4">
              <p className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-red">
                <Icon name="xmark" size={14} />
                错误
              </p>
              <p className="whitespace-pre-wrap font-mono text-[12px] text-label">
                {response.error}
              </p>
            </div>
          </div>
        )}

        {!response.error && !response.streaming && !data && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-label2">
            <Icon name="paperplane" size={28} className="text-label3" />
            <p className="text-[13px]">
              {response.loading ? "正在等待响应…" : "点击 Send 发送请求以查看响应"}
            </p>
          </div>
        )}

        {!response.error && !response.streaming && data && respTab === "pretty" && (
          <div className="flex h-full flex-col">
            <div className="flex shrink-0 items-center gap-1 border-b border-[var(--hairline)] px-3 py-1.5">
              <button
                className="btn-plain text-[12px]"
                onClick={() => editorRef.current?.getAction("actions.find")?.run()}
                title="在响应中搜索（Ctrl+F）"
              >
                <Icon name="search" size={12} />
                搜索
              </button>
              <button
                className="btn-plain text-[12px]"
                onClick={() => editorRef.current?.getAction("editor.foldAll")?.run()}
                title="折叠所有 JSON 层级"
              >
                <Icon name="chevron-right" size={12} />
                折叠全部
              </button>
              <button
                className="btn-plain text-[12px]"
                onClick={() => editorRef.current?.getAction("editor.unfoldAll")?.run()}
                title="展开所有 JSON 层级"
              >
                <Icon name="chevron-down" size={12} />
                展开全部
              </button>
              <button
                className="btn-plain ml-auto text-[12px]"
                onClick={() => void copyText(pretty.text)}
              >
                <Icon name={copied ? "checkmark" : "copy"} size={12} />
                {copied ? "已复制" : "复制"}
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <MonacoEditor
                language={pretty.language}
                value={pretty.text}
                readOnly
                onMount={(e) => {
                  editorRef.current = e;
                }}
              />
            </div>
          </div>
        )}

        {!response.error && !response.streaming && data && respTab === "raw" && (
          <pre className="scroll-ios h-full overflow-auto whitespace-pre-wrap break-all p-4 font-mono text-[12px] text-label">
            {data.body}
          </pre>
        )}

        {!response.error && !response.streaming && data && respTab === "headers" && (
          <div className="scroll-ios h-full overflow-y-auto p-3">
            <div className="overflow-hidden rounded-lg bg-fill2">
              {Object.entries(data.headers).map(([key, value], i) => (
                <div
                  key={key}
                  className={`flex gap-3 px-3 py-2 text-[12px] ${
                    i > 0 ? "border-t border-[var(--hairline)]" : ""
                  }`}
                >
                  <span className="w-40 shrink-0 font-mono font-medium text-indigo">
                    {key}
                  </span>
                  <span className="min-w-0 flex-1 break-all font-mono text-label">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
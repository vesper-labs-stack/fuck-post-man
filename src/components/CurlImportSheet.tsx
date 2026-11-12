import { useMemo, useState } from "react";
import Icon from "./Icon";
import { useAppStore } from "../store/useAppStore";
import { parseCurl, type ParsedCurl } from "../utils/curl";
import { methodBadge } from "../utils/helpers";

interface CurlImportSheetProps {
  tabId: string;
  onClose: () => void;
}

const SAMPLE = `curl -X POST "https://jsonplaceholder.typicode.com/posts?source=terminal&dry=0" \\
  -H "Content-Type: application/json" \\
  -H "X-Client: fuckpostman" \\
  -d '{"title":"hello from curl","body":"imported request","userId":1}'`;

const BODY_LABEL: Record<string, string> = {
  none: "无 Body",
  json: "JSON",
  raw: "Raw",
  "form-data": "form-data",
  "x-www-form-urlencoded": "urlencoded",
};

/** iOS-style sheet: paste a terminal curl command, preview the parse, import. */
export default function CurlImportSheet({ tabId, onClose }: CurlImportSheetProps) {
  const updateRequest = useAppStore((s) => s.updateRequest);
  const setResponse = useAppStore((s) => s.setResponse);
  const [text, setText] = useState("");

  const result = useMemo<{ parsed?: ParsedCurl; error?: string }>(() => {
    if (!text.trim()) return {};
    try {
      return { parsed: parseCurl(text) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, [text]);

  const submit = () => {
    const p = result.parsed;
    if (!p) return;
    updateRequest(tabId, {
      method: p.method,
      url: p.url,
      params: p.params,
      headers: p.headers,
      auth: p.auth,
      bodyType: p.bodyType,
      body: p.body,
      bodyForm: p.bodyForm,
    });
    setResponse(tabId, {
      data: null,
      error: null,
      loading: false,
      assertionResults: null,
      streaming: false,
      streamText: "",
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-[560px] max-w-[92vw] animate-sheet-in overflow-hidden rounded-2xl bg-surface shadow-ios-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-label">
            <Icon name="terminal" size={16} className="text-accent" />
            Import cURL
          </h2>
          <button className="icon-btn" onClick={onClose} title="关闭">
            <Icon name="xmark" size={14} />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium uppercase tracking-wide text-label2">
              粘贴终端中的 cURL 命令
            </label>
            <button
              className="btn-plain text-[11px]"
              onClick={() => setText(SAMPLE)}
            >
              填入示例
            </button>
          </div>

          <textarea
            autoFocus
            className="field-ios h-40 resize-none font-mono text-[12px] leading-relaxed"
            placeholder={`curl -X POST "https://api.example.com/users?debug=1" \\
  -H "Authorization: Bearer <token>" \\
  -d '{"name":"Ada"}'`}
            value={text}
            spellCheck={false}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submit();
            }}
          />

          {result.parsed && (
            <div className="space-y-2 rounded-xl bg-fill2 p-3">
              <div className="flex items-center gap-2">
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${methodBadge(result.parsed.method)}`}
                >
                  {result.parsed.method}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-label">
                  {result.parsed.url}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-fill px-2 py-0.5 text-[11px] font-medium text-label2">
                  Headers ×{result.parsed.headers.length}
                </span>
                <span className="rounded-full bg-fill px-2 py-0.5 text-[11px] font-medium text-label2">
                  Params ×{result.parsed.params.length}
                </span>
                <span className="rounded-full bg-fill px-2 py-0.5 text-[11px] font-medium text-label2">
                  Body：{BODY_LABEL[result.parsed.bodyType]}
                </span>
                {result.parsed.auth.type !== "none" && (
                  <span className="rounded-full bg-fill px-2 py-0.5 text-[11px] font-medium text-label2">
                    Auth：Basic
                  </span>
                )}
              </div>
              {result.parsed.bodyType !== "none" && result.parsed.body && (
                <pre className="scroll-ios max-h-24 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface p-2 font-mono text-[11px] text-label">
                  {result.parsed.body}
                </pre>
              )}
            </div>
          )}

          {result.error && (
            <p className="flex items-center gap-1.5 rounded-xl bg-red/10 px-3 py-2 text-[12px] font-medium text-red">
              <Icon name="xmark" size={13} />
              {result.error}
            </p>
          )}

          {!result.parsed && !result.error && (
            <p className="text-[11px] text-label3">
              支持 -X / -H / -d / --data-urlencode / --json / -G / -u / -F
              等常见选项，解析后自动回填 Method、URL、Params、Headers 与 Body。
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-separator/40 px-5 py-3">
          <button className="btn-secondary justify-center" onClick={onClose}>
            取消
          </button>
          <button
            className="btn-primary justify-center"
            onClick={submit}
            disabled={!result.parsed}
          >
            <Icon name="checkmark" size={14} />
            解析并导入
          </button>
        </div>
      </div>
    </div>
  );
}
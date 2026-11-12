import { useState } from "react";
import { useSendRequest } from "../hooks/useSendRequest";
import { useAppStore } from "../store/useAppStore";
import { HTTP_METHODS, type HttpMethod, type RequestTab } from "../types";
import { methodColor } from "../utils/helpers";
import CurlImportSheet from "./CurlImportSheet";
import Icon from "./Icon";

interface RequestBarProps {
  tab: RequestTab;
}

export default function RequestBar({ tab }: RequestBarProps) {
  const updateRequest = useAppStore((s) => s.updateRequest);
  const openSaveSheet = useAppStore((s) => s.openSaveSheet);
  const send = useSendRequest();
  const [curlOpen, setCurlOpen] = useState(false);
  const { request, response } = tab;

  const handleSend = () => {
    if (!response.loading) void send(tab);
  };

  return (
    <>
    <div className="card mx-3 mt-3 flex shrink-0 items-center gap-2 p-2 animate-rise-in">
      <div className="relative shrink-0">
        <select
          className={`field-ios h-9 w-[104px] appearance-none pr-7 text-[13px] font-bold ${methodColor(
            request.method,
          )}`}
          value={request.method}
          onChange={(e) =>
            updateRequest(tab.id, { method: e.target.value as HttpMethod })
          }
        >
          {HTTP_METHODS.map((method) => (
            <option key={method} value={method} className="bg-surface text-label">
              {method}
            </option>
          ))}
        </select>
        <Icon
          name="chevron-up-down"
          size={12}
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-label2"
        />
      </div>

      <input
        className="field-ios h-9 flex-1 font-mono text-[13px]"
        placeholder="{{baseUrl}}/api/v1/users"
        value={request.url}
        spellCheck={false}
        onChange={(e) => updateRequest(tab.id, { url: e.target.value })}
        onKeyDown={(e) => e.key === "Enter" && handleSend()}
      />

      <button
        className="btn-secondary h-9 shrink-0"
        onClick={() => setCurlOpen(true)}
        title="从 cURL 命令导入请求"
      >
        <Icon name="terminal" size={15} />
        cURL
      </button>

      <button
        className="btn-secondary h-9 shrink-0"
        onClick={() => openSaveSheet(tab.id)}
        title="保存请求到集合"
      >
        <Icon name="bookmark" size={15} />
        保存
      </button>

      <button
        className="btn-primary h-9 w-[104px] shrink-0"
        onClick={handleSend}
        disabled={response.loading}
      >
        {response.loading ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            发送中
          </>
        ) : (
          <>
            <Icon name="paperplane" size={15} />
            Send
          </>
        )}
      </button>
    </div>

    {curlOpen && (
      <CurlImportSheet tabId={tab.id} onClose={() => setCurlOpen(false)} />
    )}
    </>
  );
}
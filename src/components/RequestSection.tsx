import { useMemo, useState } from "react";
import Icon from "./Icon";
import KeyValueEditor from "./KeyValueEditor";
import MonacoEditor from "./MonacoEditor";
import TestsEditor from "./TestsEditor";
import { useAppStore } from "../store/useAppStore";
import type { AuthType, BodyType, RequestTab } from "../types";
import { buildHeaderSuggestions } from "../utils/headerSuggestions";

interface RequestSectionProps {
  tab: RequestTab;
}

type SubTab = "params" | "headers" | "auth" | "body" | "tests";

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: "params", label: "Params" },
  { id: "headers", label: "Headers" },
  { id: "auth", label: "Auth" },
  { id: "body", label: "Body" },
  { id: "tests", label: "Tests" },
];

const BODY_TYPES: BodyType[] = [
  "none",
  "json",
  "form-data",
  "x-www-form-urlencoded",
  "raw",
];

export default function RequestSection({ tab }: RequestSectionProps) {
  const updateRequest = useAppStore((s) => s.updateRequest);
  const history = useAppStore((s) => s.history);
  const nodes = useAppStore((s) => s.collectionNodes);
  const [subTab, setSubTab] = useState<SubTab>("params");
  const { request } = tab;
  const headerSuggest = useMemo(
    () => buildHeaderSuggestions(history, nodes),
    [history, nodes],
  );
  const assertionResults = tab.response.assertionResults;
  const assertionsPassed =
    assertionResults?.filter((r) => r.passed).length ?? 0;

  const beautifyJson = () => {
    try {
      updateRequest(tab.id, {
        body: JSON.stringify(JSON.parse(request.body), null, 2),
      });
    } catch {
      /* leave invalid JSON untouched */
    }
  };

  const dot = (on: boolean) =>
    on ? <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-accent" /> : null;

  return (
    <div className="card mx-3 mt-3 flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--hairline)] px-3 py-2">
        <div className="seg">
          {SUB_TABS.map((t) => (
            <button
              key={t.id}
              className={`seg-item ${
                subTab === t.id ? "seg-item-active" : "hover:text-label"
              }`}
              onClick={() => setSubTab(t.id)}
            >
              {t.label}
              {t.id === "params" && dot(request.params.some((p) => p.enabled && p.key))}
              {t.id === "headers" && dot(request.headers.some((h) => h.enabled && h.key))}
              {t.id === "auth" && dot(request.auth.type !== "none")}
              {t.id === "body" && dot(request.bodyType !== "none")}
              {t.id === "tests" &&
                ((request.assertions ?? []).length > 0 ? (
                  assertionResults && assertionResults.length > 0 ? (
                    <span
                      className={`ml-1 rounded-full px-1.5 py-px text-[9px] font-bold ${
                        assertionsPassed === assertionResults.length
                          ? "bg-green/15 text-green"
                          : "bg-red/15 text-red"
                      }`}
                    >
                      {assertionsPassed}/{assertionResults.length}
                    </span>
                  ) : (
                    dot(true)
                  )
                ) : null)}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {subTab === "params" && (
          <KeyValueEditor
            rows={request.params}
            onChange={(params) => updateRequest(tab.id, { params })}
            keyPlaceholder="参数名"
            valuePlaceholder="参数值"
          />
        )}

        {subTab === "headers" && (
          <KeyValueEditor
            rows={request.headers}
            onChange={(headers) => updateRequest(tab.id, { headers })}
            keyPlaceholder="Header 名"
            valuePlaceholder="Header 值"
            suggest={headerSuggest}
          />
        )}

        {subTab === "auth" && (
          <div className="scroll-ios h-full overflow-y-auto p-4">
            <div className="mx-auto max-w-xl space-y-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-label2">
                  认证类型
                </label>
                <div className="seg">
                  {(["none", "bearer", "basic"] as AuthType[]).map((t) => (
                    <button
                      key={t}
                      className={`seg-item ${
                        request.auth.type === t ? "seg-item-active" : "hover:text-label"
                      }`}
                      onClick={() =>
                        updateRequest(tab.id, { auth: { ...request.auth, type: t } })
                      }
                    >
                      {t === "none" ? "No Auth" : t === "bearer" ? "Bearer" : "Basic"}
                    </button>
                  ))}
                </div>
              </div>

              {request.auth.type === "bearer" && (
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-label2">
                    Token
                  </label>
                  <input
                    className="field-ios font-mono"
                    placeholder="{{token}} 或具体 token"
                    value={request.auth.bearerToken}
                    onChange={(e) =>
                      updateRequest(tab.id, {
                        auth: { ...request.auth, bearerToken: e.target.value },
                      })
                    }
                  />
                  <p className="mt-2 flex items-center gap-1 text-[11px] text-label3">
                    <Icon name="lock" size={12} />
                    发送时自动添加 Authorization: Bearer &lt;token&gt;
                  </p>
                </div>
              )}

              {request.auth.type === "basic" && (
                <>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-label2">
                      用户名
                    </label>
                    <input
                      className="field-ios font-mono"
                      value={request.auth.basicUsername}
                      onChange={(e) =>
                        updateRequest(tab.id, {
                          auth: { ...request.auth, basicUsername: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-label2">
                      密码
                    </label>
                    <input
                      type="password"
                      className="field-ios font-mono"
                      value={request.auth.basicPassword}
                      onChange={(e) =>
                        updateRequest(tab.id, {
                          auth: { ...request.auth, basicPassword: e.target.value },
                        })
                      }
                    />
                  </div>
                  <p className="flex items-center gap-1 text-[11px] text-label3">
                    <Icon name="lock" size={12} />
                    发送时自动添加 Authorization: Basic &lt;base64&gt;
                  </p>
                </>
              )}

              {request.auth.type === "none" && (
                <p className="text-[13px] text-label2">该请求不携带认证信息。</p>
              )}
            </div>
          </div>
        )}

        {subTab === "body" && (
          <div className="flex h-full flex-col">
            <div className="flex shrink-0 items-center gap-2 border-b border-[var(--hairline)] px-3 py-2">
              <div className="relative">
                <select
                  className="field-ios h-7 appearance-none rounded-full pr-7 text-[12px] font-medium"
                  value={request.bodyType}
                  onChange={(e) =>
                    updateRequest(tab.id, { bodyType: e.target.value as BodyType })
                  }
                >
                  {BODY_TYPES.map((bt) => (
                    <option key={bt} value={bt}>
                      {bt}
                    </option>
                  ))}
                </select>
                <Icon
                  name="chevron-up-down"
                  size={12}
                  className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-label2"
                />
              </div>
              {request.bodyType === "json" && (
                <button className="btn-plain text-[12px]" onClick={beautifyJson}>
                  美化 JSON
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1">
              {request.bodyType === "none" && (
                <div className="flex h-full items-center justify-center text-[13px] text-label2">
                  该请求没有请求体
                </div>
              )}
              {request.bodyType === "json" && (
                <MonacoEditor
                  language="json"
                  value={request.body}
                  onChange={(body) => updateRequest(tab.id, { body })}
                />
              )}
              {request.bodyType === "raw" && (
                <MonacoEditor
                  language="plaintext"
                  value={request.body}
                  onChange={(body) => updateRequest(tab.id, { body })}
                />
              )}
              {(request.bodyType === "form-data" ||
                request.bodyType === "x-www-form-urlencoded") && (
                <KeyValueEditor
                  rows={request.bodyForm}
                  onChange={(bodyForm) => updateRequest(tab.id, { bodyForm })}
                  keyPlaceholder="字段名"
                  valuePlaceholder="字段值"
                />
              )}
            </div>
          </div>
        )}

        {subTab === "tests" && <TestsEditor tab={tab} />}
      </div>
    </div>
  );
}
import Icon from "./Icon";
import Switch from "./Switch";
import { useAppStore } from "../store/useAppStore";
import type {
  Assertion,
  AssertionTarget,
  RequestTab,
} from "../types";
import { ASSERTION_OPS } from "../utils/assertions";
import { createAssertion } from "../utils/factory";

const TARGETS: { value: AssertionTarget; label: string }[] = [
  { value: "status", label: "状态码" },
  { value: "time", label: "响应时间" },
  { value: "json", label: "JSON 字段" },
];

const PRESETS: { label: string; patch: Partial<Assertion> }[] = [
  { label: "状态码 == 200", patch: { target: "status", op: "eq", expected: "200" } },
  { label: "响应时间 < 500ms", patch: { target: "time", op: "lt", expected: "500" } },
  { label: "data.code == 0", patch: { target: "json", path: "data.code", op: "eq", expected: "0" } },
];

/** Visual assertion rule editor with live pass/fail verdicts per rule. */
export default function TestsEditor({ tab }: { tab: RequestTab }) {
  const updateRequest = useAppStore((s) => s.updateRequest);
  const assertions = tab.request.assertions ?? [];
  const results = tab.response.assertionResults;
  const passedCount = results?.filter((r) => r.passed).length ?? 0;

  const patch = (id: string, p: Partial<Assertion>) =>
    updateRequest(tab.id, {
      assertions: assertions.map((a) => (a.id === id ? { ...a, ...p } : a)),
    });
  const remove = (id: string) =>
    updateRequest(tab.id, { assertions: assertions.filter((a) => a.id !== id) });
  const add = (p: Partial<Assertion> = {}) =>
    updateRequest(tab.id, { assertions: [...assertions, createAssertion(p)] });

  return (
    <div className="scroll-ios h-full overflow-y-auto p-4">
      <div className="mx-auto max-w-2xl space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-medium uppercase tracking-wide text-label2">
            断言规则
          </label>
          {results && results.length > 0 && (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                passedCount === results.length
                  ? "bg-green/15 text-green"
                  : "bg-red/15 text-red"
              }`}
            >
              {passedCount}/{results.length} 通过
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              className="rounded-full bg-fill2 px-2.5 py-1 text-[11px] font-medium text-label2 transition hover:bg-fill hover:text-label"
              onClick={() => add(p.patch)}
            >
              + {p.label}
            </button>
          ))}
          <button
            className="btn-secondary ml-auto h-7 text-[12px]"
            onClick={() => add()}
          >
            <Icon name="plus" size={13} />
            添加断言
          </button>
        </div>

        {assertions.length === 0 && (
          <div className="rounded-xl bg-fill2 px-4 py-8 text-center">
            <Icon name="checkmark" size={26} className="mx-auto mb-2 text-label3" />
            <p className="text-[13px] text-label2">暂无断言规则</p>
            <p className="mt-1 text-[11px] text-label3">
              点击上方预设快速添加，或自定义状态码 / 响应时间 / JSON 字段校验。
            </p>
          </div>
        )}

        {assertions.map((a) => {
          const r = results?.find((x) => x.id === a.id);
          return (
            <div key={a.id} className="space-y-2 rounded-xl bg-fill2 p-2.5">
              <div className="flex items-center gap-2">
                <Switch
                  checked={a.enabled}
                  onChange={(enabled) => patch(a.id, { enabled })}
                  label="启用 / 禁用断言"
                />
                <div className="relative shrink-0">
                  <select
                    className="field-ios h-7 w-[104px] appearance-none pr-6 text-[12px] font-medium"
                    value={a.target}
                    onChange={(e) =>
                      patch(a.id, { target: e.target.value as AssertionTarget })
                    }
                  >
                    {TARGETS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <Icon
                    name="chevron-up-down"
                    size={11}
                    className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-label2"
                  />
                </div>
                {a.target === "json" && (
                  <input
                    className="field-ios h-7 min-w-0 flex-1 font-mono text-[12px]"
                    placeholder="data.code 或 items[0].id"
                    value={a.path}
                    spellCheck={false}
                    onChange={(e) => patch(a.id, { path: e.target.value })}
                  />
                )}
                <div className="relative shrink-0">
                  <select
                    className="field-ios h-7 w-[72px] appearance-none pr-6 text-[12px] font-medium"
                    value={a.op}
                    onChange={(e) =>
                      patch(a.id, { op: e.target.value as Assertion["op"] })
                    }
                  >
                    {ASSERTION_OPS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <Icon
                    name="chevron-up-down"
                    size={11}
                    className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-label2"
                  />
                </div>
                {a.op !== "exists" && (
                  <input
                    className="field-ios h-7 min-w-0 flex-1 font-mono text-[12px]"
                    placeholder="期望值"
                    value={a.expected}
                    spellCheck={false}
                    onChange={(e) => patch(a.id, { expected: e.target.value })}
                  />
                )}
                <button
                  className="icon-btn h-6 w-6 shrink-0 text-red hover:bg-red/10 hover:text-red"
                  onClick={() => remove(a.id)}
                  title="删除断言"
                >
                  <Icon name="minus" size={14} />
                </button>
              </div>
              {a.enabled && r ? (
                <p
                  className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium ${
                    r.passed ? "bg-green/10 text-green" : "bg-red/10 text-red"
                  }`}
                >
                  <Icon name={r.passed ? "checkmark" : "xmark"} size={12} />
                  <span className="truncate">
                    {r.label}：{r.detail}
                  </span>
                </p>
              ) : (
                <p className="px-2 text-[11px] text-label3">
                  {a.enabled ? "发送请求后自动求值" : "已禁用，不参与求值"}
                </p>
              )}
            </div>
          );
        })}

        <p className="text-[11px] text-label3">
          每次 Send 与 Runner 迭代后自动求值；JSON 路径支持 a.b[0].c 形式。
        </p>
      </div>
    </div>
  );
}
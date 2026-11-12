import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import { saveReport, sendHttpRequest } from "../services/apiService";
import { buildPayload } from "../hooks/useSendRequest";
import { useAppStore } from "../store/useAppStore";
import type { AssertionResult, HttpMethod } from "../types";
import { evaluateAssertions } from "../utils/assertions";
import { descendantIds, folderList } from "../utils/collections";
import { parseCsv, toCsv, type CsvData } from "../utils/csv";
import { formatMs, methodBadge, statusBadge, uid } from "../utils/helpers";

interface CaseResult {
  id: string;
  iteration: number;
  rowLabel: string;
  name: string;
  method: HttpMethod;
  url: string;
  status: number | null;
  timeMs: number | null;
  passed: boolean;
  assertions: AssertionResult[];
  error: string | null;
}

type Phase = "config" | "running" | "done";
type Filter = "all" | "passed" | "failed";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Right-hand drawer: pick a collection, feed CSV rows as variables, run & report. */
export default function RunnerSheet() {
  const nodes = useAppStore((s) => s.collectionNodes);
  const runnerFolderId = useAppStore((s) => s.runnerFolderId);
  const closeRunner = useAppStore((s) => s.closeRunner);
  const getActiveEnvMap = useAppStore((s) => s.getActiveEnvMap);

  const [folderId, setFolderId] = useState<string>(runnerFolderId ?? "all");
  const [csv, setCsv] = useState<CsvData | null>(null);
  const [csvName, setCsvName] = useState("");
  const [csvError, setCsvError] = useState<string | null>(null);
  const [delayMs, setDelayMs] = useState("0");
  const [phase, setPhase] = useState<Phase>("config");
  const [cases, setCases] = useState<CaseResult[]>([]);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const cancelRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    cancelRef.current = true;
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [cases]);

  const folders = folderList(nodes);
  const requests = useMemo(() => {
    const desc = folderId === "all" ? null : descendantIds(nodes, folderId);
    return nodes.filter(
      (n) =>
        n.type === "request" &&
        n.request &&
        (desc === null || desc.has(n.id)),
    );
  }, [nodes, folderId]);

  const iterations = csv ? csv.rows.length : 1;
  const totalCases = requests.length * iterations;

  const summary = useMemo(() => {
    const passed = cases.filter((c) => c.passed).length;
    const times = cases
      .map((c) => c.timeMs)
      .filter((t): t is number => t !== null);
    const avg =
      times.length > 0
        ? times.reduce((a, b) => a + b, 0) / times.length
        : 0;
    return {
      total: cases.length,
      passed,
      failed: cases.length - passed,
      avg,
      rate: cases.length > 0 ? Math.round((passed / cases.length) * 100) : 0,
    };
  }, [cases]);

  const visibleCases = cases.filter((c) =>
    filter === "all" ? true : filter === "passed" ? c.passed : !c.passed,
  );

  const onCsvFile = async (file: File) => {
    const text = await file.text();
    const data = parseCsv(text);
    if (data.columns.length === 0 || data.rows.length === 0) {
      setCsv(null);
      setCsvError("CSV 为空或缺少表头 / 数据行");
      return;
    }
    setCsv(data);
    setCsvName(file.name);
    setCsvError(null);
  };

  const start = async () => {
    if (requests.length === 0) return;
    cancelRef.current = false;
    setPhase("running");
    setCases([]);
    setDone(0);
    setStopped(false);
    setFilter("all");
    setExportMsg(null);
    setStartedAt(Date.now());
    setFinishedAt(null);
    const envBase = getActiveEnvMap();
    const rows: (Record<string, string> | null)[] = csv ? csv.rows : [null];
    const planTotal = requests.length * rows.length;
    setTotal(planTotal);
    const delay = Math.max(0, parseInt(delayMs, 10) || 0);
    let completed = 0;
    let cancelled = false;

    for (let i = 0; i < rows.length && !cancelled; i++) {
      for (const node of requests) {
        if (cancelRef.current) {
          cancelled = true;
          break;
        }
        const req = node.request!;
        const payload = buildPayload(req, { ...envBase, ...(rows[i] ?? {}) });
        const base = {
          id: uid(),
          iteration: i + 1,
          rowLabel: rows[i] ? `第 ${i + 1} 行` : "单次运行",
          name: node.name,
          method: req.method,
          url: payload.url,
        };
        let entry: CaseResult;
        try {
          const data = await sendHttpRequest(payload);
          const results = evaluateAssertions(req.assertions ?? [], data);
          entry = {
            ...base,
            status: data.status_code,
            timeMs: data.time_elapsed_ms,
            passed: results.every((r) => r.passed),
            assertions: results,
            error: null,
          };
        } catch (e) {
          entry = {
            ...base,
            status: null,
            timeMs: null,
            passed: false,
            assertions: [],
            error: e instanceof Error ? e.message : String(e),
          };
        }
        completed++;
        setCases((prev) => [...prev, entry]);
        setDone(completed);
        if (delay > 0) await sleep(delay);
      }
    }
    setStopped(cancelled);
    setFinishedAt(Date.now());
    setPhase("done");
  };

  const buildReport = () => ({
    app: "fuckpostman",
    generatedAt: new Date().toISOString(),
    startedAt: startedAt ? new Date(startedAt).toISOString() : null,
    finishedAt: finishedAt ? new Date(finishedAt).toISOString() : null,
    stopped,
    collection:
      folderId === "all"
        ? "所有集合"
        : (nodes.find((n) => n.id === folderId)?.name ?? folderId),
    csv: csvName || null,
    iterations,
    summary: {
      total: summary.total,
      passed: summary.passed,
      failed: summary.failed,
      avgMs: Math.round(summary.avg),
      passRate: summary.rate,
    },
    cases,
  });

  const doExport = async (kind: "json" | "csv") => {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    try {
      if (kind === "json") {
        const p = await saveReport(
          `runner-report-${stamp}.json`,
          JSON.stringify(buildReport(), null, 2),
        );
        setExportMsg(p ? `已保存：${p}` : "已取消导出");
      } else {
        const rows: (string | number | boolean | null)[][] = [
          [
            "iteration",
            "row",
            "request",
            "method",
            "url",
            "status",
            "time_ms",
            "passed",
            "assertions_passed",
            "assertions_total",
            "error",
          ],
          ...cases.map((c) => [
            c.iteration,
            c.rowLabel,
            c.name,
            c.method,
            c.url,
            c.status,
            c.timeMs,
            c.passed,
            c.assertions.filter((a) => a.passed).length,
            c.assertions.length,
            c.error,
          ]),
        ];
        const p = await saveReport(`runner-report-${stamp}.csv`, toCsv(rows));
        setExportMsg(p ? `已保存：${p}` : "已取消导出");
      }
    } catch (e) {
      setExportMsg(`导出失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm animate-fade-in"
      onClick={closeRunner}
    >
      <div
        className="absolute bottom-0 right-0 top-0 flex w-[620px] max-w-[94vw] flex-col border-l border-[var(--hairline)] bg-surface shadow-ios-lg animate-drawer-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--hairline)] px-5 pb-3 pt-4">
          <div>
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-label">
              <Icon name="play" size={15} className="text-accent" />
              Collection Runner
            </h2>
            <p className="mt-0.5 text-[11px] text-label3">
              按 CSV 行批量发送请求，实时求值断言并生成报告
            </p>
          </div>
          <button className="icon-btn" onClick={closeRunner} title="关闭">
            <Icon name="xmark" size={14} />
          </button>
        </div>

        <div className="scroll-ios min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {phase === "config" && (
            <>
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-label2">
                  选择集合
                </label>
                <div className="relative">
                  <select
                    className="field-ios appearance-none pr-8"
                    value={folderId}
                    onChange={(e) => setFolderId(e.target.value)}
                  >
                    <option value="all">所有集合（全部请求）</option>
                    {folders.map(({ node, depth }) => (
                      <option key={node.id} value={node.id}>
                        {" ".repeat(depth)}
                        {depth > 0 ? "└ " : ""}
                        {node.name}
                      </option>
                    ))}
                  </select>
                  <Icon
                    name="chevron-up-down"
                    size={14}
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-label2"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-label3">
                  将按目录顺序运行 {requests.length} 个请求
                  {requests.length === 0 && "（该集合下暂无请求）"}
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-label2">
                  数据驱动（可选 CSV）
                </label>
                {!csv ? (
                  <button
                    className="w-full rounded-xl border border-dashed border-separator bg-fill2 px-4 py-6 text-center transition hover:bg-fill"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Icon name="upload" size={22} className="mx-auto mb-2 text-accent" />
                    <p className="text-[13px] font-medium text-label">
                      点击选择 .csv 文件
                    </p>
                    <p className="mt-1 text-[11px] text-label3">
                      每一行作为一次迭代，列名注入为 {"{{列名}}"} 变量并覆盖当前环境
                    </p>
                  </button>
                ) : (
                  <div className="space-y-2 rounded-xl bg-fill2 p-3">
                    <div className="flex items-center justify-between">
                      <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-label">
                        <Icon name="doc" size={14} className="shrink-0 text-accent" />
                        <span className="truncate">{csvName}</span>
                      </span>
                      <button
                        className="btn-plain shrink-0 text-[12px] text-red hover:bg-red/10"
                        onClick={() => {
                          setCsv(null);
                          setCsvName("");
                        }}
                      >
                        移除
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-fill px-2 py-0.5 text-[11px] font-medium text-label2">
                        {csv.rows.length} 行数据
                      </span>
                      {csv.columns.map((c) => (
                        <span
                          key={c}
                          className="rounded-full bg-accent/10 px-2 py-0.5 font-mono text-[11px] font-medium text-accent"
                        >
                          {`{{${c}}}`}
                        </span>
                      ))}
                    </div>
                    <div className="scroll-ios overflow-x-auto rounded-lg bg-surface">
                      <table className="w-full text-left font-mono text-[11px]">
                        <thead>
                          <tr className="border-b border-[var(--hairline)] text-label2">
                            {csv.columns.map((c) => (
                              <th key={c} className="px-2 py-1 font-medium">
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csv.rows.slice(0, 3).map((r, i) => (
                            <tr
                              key={i}
                              className="border-b border-[var(--hairline)] last:border-0 text-label"
                            >
                              {csv.columns.map((c) => (
                                <td key={c} className="max-w-[140px] truncate px-2 py-1">
                                  {r[c]}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {csv.rows.length > 3 && (
                      <p className="text-[10px] text-label3">
                        仅预览前 3 行，共 {csv.rows.length} 行
                      </p>
                    )}
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onCsvFile(f);
                    e.target.value = "";
                  }}
                />
                {csvError && (
                  <p className="mt-1.5 flex items-center gap-1 text-[12px] font-medium text-red">
                    <Icon name="xmark" size={12} />
                    {csvError}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <label className="text-[11px] font-medium uppercase tracking-wide text-label2">
                  迭代间隔
                </label>
                <input
                  type="number"
                  min={0}
                  className="field-ios h-7 w-24 text-[12px]"
                  value={delayMs}
                  onChange={(e) => setDelayMs(e.target.value)}
                />
                <span className="text-[11px] text-label3">ms</span>
                <span className="ml-auto text-[11px] font-medium text-label2">
                  {iterations} 次迭代 × {requests.length} 请求 = {totalCases} 用例
                </span>
              </div>
            </>
          )}

          {phase !== "config" && (
            <>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-[12px] font-medium">
                  <span className="text-label">
                    {phase === "running"
                      ? `运行中 ${done}/${total}`
                      : stopped
                        ? `已停止 ${done}/${total}`
                        : `运行完成 ${done}/${total}`}
                  </span>
                  <span className="text-label2">
                    通过率 {summary.rate}% · {summary.passed} 通过 / {summary.failed} 失败
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-fill">
                  <div
                    className={`h-full rounded-full transition-all duration-200 ${
                      phase === "done" && summary.failed === 0 && !stopped
                        ? "bg-green"
                        : "bg-accent"
                    }`}
                    style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {phase === "done" && (
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "总用例", value: String(summary.total), cls: "text-label" },
                    { label: "成功", value: String(summary.passed), cls: "text-green" },
                    { label: "失败", value: String(summary.failed), cls: "text-red" },
                    { label: "平均耗时", value: formatMs(Math.round(summary.avg)), cls: "text-accent" },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="rounded-xl bg-fill2 px-2 py-3 text-center"
                    >
                      <p className={`text-[20px] font-bold ${s.cls}`}>{s.value}</p>
                      <p className="mt-0.5 text-[10px] font-medium text-label3">
                        {s.label}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {phase === "done" && (
                <div className="seg">
                  {(["all", "passed", "failed"] as Filter[]).map((f) => (
                    <button
                      key={f}
                      className={`seg-item ${
                        filter === f ? "seg-item-active" : "hover:text-label"
                      }`}
                      onClick={() => setFilter(f)}
                    >
                      {f === "all" ? "全部" : f === "passed" ? "通过" : "失败"}
                    </button>
                  ))}
                </div>
              )}

              <div ref={listRef} className="scroll-ios max-h-[46vh] space-y-1 overflow-y-auto">
                {visibleCases.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 rounded-lg bg-fill2 px-2.5 py-2"
                    title={
                      c.error ??
                      c.assertions.map((a) => `${a.passed ? "✓" : "✗"} ${a.label} ${a.detail}`).join("\n")
                    }
                  >
                    <span className="w-7 shrink-0 text-[10px] font-bold text-label3">
                      #{c.iteration}
                    </span>
                    <span
                      className={`w-[46px] shrink-0 rounded-md px-1 py-0.5 text-center text-[9px] font-bold ${methodBadge(c.method)}`}
                    >
                      {c.method}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-medium text-label">
                        {c.name}
                      </span>
                      <span className="block truncate font-mono text-[10px] text-label3">
                        {c.rowLabel} · {c.url}
                      </span>
                      {!c.passed && (
                        <span className="block truncate text-[10px] font-medium text-red">
                          {c.error ??
                            c.assertions.find((a) => !a.passed)?.detail ??
                            "失败"}
                        </span>
                      )}
                    </span>
                    {c.timeMs !== null && (
                      <span className="shrink-0 text-[10px] text-label2">
                        {formatMs(c.timeMs)}
                      </span>
                    )}
                    {c.status !== null ? (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusBadge(c.status)}`}
                      >
                        {c.status}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-red/15 px-2 py-0.5 text-[10px] font-bold text-red">
                        ERR
                      </span>
                    )}
                    <Icon
                      name={c.passed ? "checkmark" : "xmark"}
                      size={14}
                      className={`shrink-0 ${c.passed ? "text-green" : "text-red"}`}
                    />
                  </div>
                ))}
                {visibleCases.length === 0 && (
                  <p className="py-6 text-center text-[12px] text-label2">
                    暂无匹配的用例
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-separator/40 px-5 py-3">
          {exportMsg && (
            <p className="mb-2 truncate text-[11px] text-label2" title={exportMsg}>
              {exportMsg}
            </p>
          )}
          {phase === "config" && (
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-secondary justify-center" onClick={closeRunner}>
                取消
              </button>
              <button
                className="btn-primary justify-center"
                disabled={requests.length === 0}
                onClick={() => void start()}
              >
                <Icon name="play" size={14} />
                开始运行（{totalCases}）
              </button>
            </div>
          )}
          {phase === "running" && (
            <button
              className="btn-secondary w-full justify-center text-red hover:bg-red/10"
              onClick={() => {
                cancelRef.current = true;
              }}
            >
              <Icon name="square" size={12} />
              停止运行
            </button>
          )}
          {phase === "done" && (
            <div className="grid grid-cols-3 gap-2">
              <button
                className="btn-secondary justify-center"
                onClick={() => setPhase("config")}
              >
                <Icon name="arrow-uturn-left" size={13} />
                再次运行
              </button>
              <button
                className="btn-secondary justify-center"
                onClick={() => void doExport("csv")}
              >
                <Icon name="download" size={13} />
                CSV
              </button>
              <button
                className="btn-primary justify-center"
                onClick={() => void doExport("json")}
              >
                <Icon name="download" size={13} />
                JSON 报告
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
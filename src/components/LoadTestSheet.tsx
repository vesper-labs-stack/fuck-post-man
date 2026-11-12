import { useEffect, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import Icon from "./Icon";
import { startLoadTest, stopLoadTest } from "../services/apiService";
import { buildPayload } from "../hooks/useSendRequest";
import { useActiveTab, useAppStore } from "../store/useAppStore";
import type { LoadTestConfig, LoadTestProgress, LoadTestReport } from "../types";
import { formatMs, methodBadge } from "../utils/helpers";

type Phase = "idle" | "running" | "done";

const MAX_CONCURRENCY = 200;

/**
 * Right-hand drawer: replay the active request under a bounded concurrent pool.
 * Always mounted so the progress listener survives closing the drawer — a run
 * keeps going in Rust and reopening reveals the live dashboard / final report.
 */
export default function LoadTestSheet() {
  const open = useAppStore((s) => s.loadTestOpen);
  const closeLoadTest = useAppStore((s) => s.closeLoadTest);
  const getActiveEnvMap = useAppStore((s) => s.getActiveEnvMap);
  const activeTab = useActiveTab();

  const [concurrency, setConcurrency] = useState("10");
  const [total, setTotal] = useState("100");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<LoadTestProgress | null>(null);
  const [report, setReport] = useState<LoadTestReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<{ method: string; url: string } | null>(
    null,
  );

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    listen<LoadTestProgress>("load-test://progress", (event) => {
      setProgress(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, []);

  const preview = activeTab
    ? buildPayload(activeTab.request, getActiveEnvMap())
    : null;
  const targetMethod = target?.method ?? preview?.method ?? "GET";
  const targetUrl = target?.url ?? preview?.url ?? "";
  const canStart = !!preview?.url?.trim();

  const start = async () => {
    if (!activeTab || !preview) return;
    const conc = Math.max(
      1,
      Math.min(MAX_CONCURRENCY, parseInt(concurrency, 10) || 10),
    );
    const tot = Math.max(1, parseInt(total, 10) || 100);
    const config: LoadTestConfig = {
      url: preview.url,
      method: preview.method,
      concurrency: conc,
      total_requests: tot,
      headers: preview.headers,
      params: preview.params,
      body_type: preview.body_type,
      body: preview.body,
    };
    setError(null);
    setReport(null);
    setProgress(null);
    setTarget({ method: preview.method, url: preview.url });
    setPhase("running");
    try {
      const rep = await startLoadTest(config);
      setReport(rep);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("idle");
    }
  };

  const stop = async () => {
    try {
      await stopLoadTest();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const reset = () => {
    setPhase("idle");
    setReport(null);
    setProgress(null);
    setError(null);
    setTarget(null);
  };

  const live = phase === "running" ? progress : null;
  const completed = live?.completed ?? report?.completed ?? 0;
  const totalReq = live?.total ?? report?.total ?? (parseInt(total, 10) || 0);
  const success = live?.success ?? report?.success ?? 0;
  const failed = live?.failed ?? report?.failed ?? 0;
  const qps = live?.qps ?? report?.qps ?? 0;
  const elapsedMs = live?.elapsed_ms ?? report?.elapsed_ms ?? 0;
  const avgMs = live?.avg_ms ?? report?.avg_ms ?? 0;
  const successRate = report
    ? report.success_rate
    : completed > 0
      ? (success / completed) * 100
      : 0;
  const pct = totalReq > 0 ? Math.min(100, (completed / totalReq) * 100) : 0;

  const cards = [
    {
      label: phase === "done" ? "平均 QPS" : "实时 QPS",
      value: qps.toFixed(1),
      cls: "text-accent",
    },
    {
      label: "总耗时",
      value: formatMs(Math.round(elapsedMs)),
      cls: "text-label",
    },
    {
      label: "成功率",
      value: `${successRate.toFixed(1)}%`,
      cls:
        successRate >= 99
          ? "text-green"
          : successRate >= 50
            ? "text-orange"
            : "text-red",
    },
    {
      label: "平均延迟",
      value: `${avgMs.toFixed(1)} ms`,
      cls: "text-indigo",
    },
  ];

  const reportRows: [string, string, string?][] = report
    ? [
        ["计划请求数", String(report.total)],
        ["实际完成", String(report.completed)],
        ["成功 (2xx)", String(report.success), "text-green"],
        ["失败", String(report.failed), report.failed > 0 ? "text-red" : undefined],
        ["成功率", `${report.success_rate.toFixed(1)}%`],
        ["平均延迟", `${report.avg_ms.toFixed(1)} ms`],
        ["最小延迟", `${report.min_ms} ms`],
        ["最大延迟", `${report.max_ms} ms`],
        ["总耗时", formatMs(Math.round(report.elapsed_ms))],
        ["整体 QPS", report.qps.toFixed(1)],
        [
          "执行状态",
          report.stopped ? "已中止" : "已完成",
          report.stopped ? "text-orange" : "text-green",
        ],
      ]
    : [];

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm animate-fade-in"
      onClick={closeLoadTest}
    >
      <div
        className="absolute bottom-0 right-0 top-0 flex w-[620px] max-w-[94vw] flex-col border-l border-[var(--hairline)] bg-surface shadow-ios-lg animate-drawer-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--hairline)] px-5 pb-3 pt-4">
          <div>
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-label">
              <Icon name="bolt" size={15} className="text-accent" />
              Load Test 压力测试
            </h2>
            <p className="mt-0.5 text-[11px] text-label3">
              对当前请求发起高并发压测，实时统计 QPS / 延迟 / 成功率
            </p>
          </div>
          <button className="icon-btn" onClick={closeLoadTest} title="关闭（压测继续运行）">
            <Icon name="xmark" size={14} />
          </button>
        </div>

        <div className="scroll-ios min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div className="flex items-center gap-2 rounded-xl bg-fill2 px-3 py-2.5">
            <span
              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${methodBadge(targetMethod)}`}
            >
              {targetMethod}
            </span>
            <span
              className="min-w-0 flex-1 truncate font-mono text-[12px] text-label"
              title={targetUrl}
            >
              {targetUrl || "（当前页签无 URL）"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-label2">
                并发线程数
              </label>
              <input
                type="number"
                min={1}
                max={MAX_CONCURRENCY}
                disabled={phase === "running"}
                className="field-ios disabled:opacity-50"
                value={concurrency}
                onChange={(e) => setConcurrency(e.target.value)}
              />
              <p className="mt-1 text-[10px] text-label3">默认 10，最大 200</p>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-label2">
                总请求数
              </label>
              <input
                type="number"
                min={1}
                disabled={phase === "running"}
                className="field-ios disabled:opacity-50"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
              />
              <p className="mt-1 text-[10px] text-label3">默认 100</p>
            </div>
          </div>

          {error && (
            <p className="flex items-center gap-1 text-[12px] font-medium text-red">
              <Icon name="xmark" size={12} />
              {error}
            </p>
          )}

          {phase !== "idle" && (
            <>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-[12px] font-medium">
                  <span className="flex items-center gap-2 text-label">
                    {phase === "running" ? (
                      <span className="flex items-center gap-1.5 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                        Running
                      </span>
                    ) : report?.stopped ? (
                      <span className="rounded-full bg-orange/15 px-2 py-0.5 text-[11px] font-bold text-orange">
                        Stopped
                      </span>
                    ) : (
                      <span className="rounded-full bg-green/15 px-2 py-0.5 text-[11px] font-bold text-green">
                        Finished
                      </span>
                    )}
                    <span>
                      {completed}/{totalReq}
                    </span>
                  </span>
                  <span className="text-label2">
                    成功 {success} · 失败 {failed}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-fill">
                  <div
                    className={`h-full rounded-full transition-all duration-200 ${
                      phase === "done" && failed === 0 && !report?.stopped
                        ? "bg-green"
                        : "bg-accent"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {cards.map((c) => (
                  <div key={c.label} className="rounded-2xl bg-fill2 px-4 py-3.5">
                    <p className="text-[11px] font-medium text-label3">{c.label}</p>
                    <p className={`mt-1 text-[26px] font-bold leading-none ${c.cls}`}>
                      {c.value}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}

          {phase === "done" && report && (
            <div className="rounded-2xl border border-[var(--hairline)] bg-fill2 p-4">
              <h3 className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-label">
                <Icon name="doc" size={14} className="text-accent" />
                压测总结报告
              </h3>
              <dl className="space-y-1.5 text-[12px]">
                {reportRows.map(([k, v, cls]) => (
                  <div key={k} className="flex items-center justify-between">
                    <dt className="text-label2">{k}</dt>
                    <dd className={`font-semibold ${cls ?? "text-label"}`}>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-separator/40 px-5 py-3">
          {phase === "idle" && (
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-secondary justify-center" onClick={closeLoadTest}>
                取消
              </button>
              <button
                className="btn-primary justify-center"
                disabled={!canStart}
                onClick={() => void start()}
              >
                <Icon name="bolt" size={14} />
                开始压测
              </button>
            </div>
          )}
          {phase === "running" && (
            <button
              className="btn-secondary w-full justify-center text-red hover:bg-red/10"
              onClick={() => void stop()}
            >
              <Icon name="square" size={12} />
              停止压测
            </button>
          )}
          {phase === "done" && (
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-secondary justify-center" onClick={reset}>
                <Icon name="arrow-uturn-left" size={13} />
                再次压测
              </button>
              <button className="btn-primary justify-center" onClick={closeLoadTest}>
                <Icon name="checkmark" size={14} />
                完成
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
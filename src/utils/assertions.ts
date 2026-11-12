import type {
  Assertion,
  AssertionOp,
  AssertionResult,
  HttpResponsePayload,
} from "../types";

export const ASSERTION_OPS: { value: AssertionOp; label: string }[] = [
  { value: "eq", label: "==" },
  { value: "neq", label: "!=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "contains", label: "包含" },
  { value: "exists", label: "存在" },
];

export function opLabel(op: AssertionOp): string {
  return ASSERTION_OPS.find((o) => o.value === op)?.label ?? op;
}

export function assertionLabel(a: Assertion): string {
  if (a.target === "status") return "状态码";
  if (a.target === "time") return "响应时间";
  return a.path.trim() || "JSON 字段";
}

function lookupPath(
  root: unknown,
  path: string,
): { found: boolean; value?: unknown } {
  const parts = path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .map((s) => s.trim())
    .filter(Boolean);
  let cur: unknown = root;
  for (const part of parts) {
    if (cur === null || typeof cur !== "object") return { found: false };
    cur = (cur as Record<string, unknown>)[part];
  }
  return { found: cur !== undefined, value: cur };
}

function display(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Evaluate enabled rules against a received response, purely client-side. */
export function evaluateAssertions(
  assertions: Assertion[],
  response: HttpResponsePayload,
): AssertionResult[] {
  const enabled = assertions.filter((a) => a.enabled);
  let json: unknown;
  let jsonOk = false;
  if (enabled.some((a) => a.target === "json")) {
    try {
      json = JSON.parse(response.body);
      jsonOk = true;
    } catch {
      jsonOk = false;
    }
  }

  return enabled.map((a) => {
    const label = assertionLabel(a);
    const fail = (actual: string, detail: string): AssertionResult => ({
      id: a.id,
      passed: false,
      label,
      actual,
      detail,
    });

    let actual: unknown;
    if (a.target === "status") {
      actual = response.status_code;
    } else if (a.target === "time") {
      actual = response.time_elapsed_ms;
    } else {
      if (!jsonOk) return fail("—", "响应体不是合法 JSON");
      if (!a.path.trim()) return fail("—", "字段路径为空");
      const hit = lookupPath(json, a.path);
      if (!hit.found) return fail("缺失", `字段 ${a.path} 不存在`);
      actual = hit.value;
    }

    const actualStr = display(actual);
    const expected = a.expected.trim();
    const numA = Number(actualStr);
    const numE = Number(expected);
    const bothNum =
      expected !== "" &&
      actualStr.trim() !== "" &&
      Number.isFinite(numA) &&
      Number.isFinite(numE);

    let passed: boolean;
    switch (a.op) {
      case "exists":
        passed = true;
        break;
      case "eq":
        passed = bothNum ? numA === numE : actualStr === expected;
        break;
      case "neq":
        passed = bothNum ? numA !== numE : actualStr !== expected;
        break;
      case "lt":
      case "lte":
      case "gt":
      case "gte":
        if (!bothNum) return fail(actualStr, "无法进行数值比较");
        passed =
          a.op === "lt"
            ? numA < numE
            : a.op === "lte"
              ? numA <= numE
              : a.op === "gt"
                ? numA > numE
                : numA >= numE;
        break;
      case "contains":
        passed = actualStr.includes(expected);
        break;
    }

    const detail =
      a.op === "exists"
        ? `${actualStr} 存在`
        : `${actualStr} ${opLabel(a.op)} ${expected}`;
    return { id: a.id, passed, label, actual: actualStr, detail };
  });
}
import type { CollectionNode, HistoryEntry, KeyValue } from "../types";

export interface Suggestion {
  value: string;
  description?: string;
}

export const COMMON_HEADERS: Suggestion[] = [
  { value: "Content-Type", description: "请求体的 MIME 类型" },
  { value: "Accept", description: "客户端期望的响应类型" },
  { value: "Authorization", description: "认证凭据（Bearer / Basic）" },
  { value: "User-Agent", description: "客户端标识" },
  { value: "Cache-Control", description: "缓存策略" },
  { value: "Accept-Encoding", description: "可接受的压缩编码" },
  { value: "Accept-Language", description: "可接受的自然语言" },
  { value: "Cookie", description: "携带的 Cookie 键值对" },
  { value: "Set-Cookie", description: "响应写入 Cookie（请求侧少用）" },
  { value: "Connection", description: "连接保持策略" },
  { value: "Host", description: "目标主机（通常自动填充）" },
  { value: "Origin", description: "跨域请求来源" },
  { value: "Referer", description: "来源页面 URL" },
  { value: "X-Requested-With", description: "AJAX 请求标记" },
  { value: "X-API-Key", description: "API 密钥" },
  { value: "X-Request-ID", description: "请求追踪 ID" },
  { value: "If-None-Match", description: "条件请求：ETag 匹配" },
  { value: "If-Modified-Since", description: "条件请求：修改时间" },
  { value: "ETag", description: "资源版本标识" },
  { value: "Pragma", description: "HTTP/1.0 缓存指令" },
  { value: "Range", description: "分段下载范围" },
  { value: "Content-Length", description: "请求体字节数（通常自动计算）" },
  { value: "Content-Encoding", description: "请求体压缩编码" },
  { value: "Content-Disposition", description: "附件 / 表单文件名" },
  { value: "Access-Control-Request-Method", description: "CORS 预检方法" },
  { value: "Access-Control-Request-Headers", description: "CORS 预检头列表" },
  { value: "DNT", description: "Do Not Track 意愿" },
  { value: "Upgrade-Insecure-Requests", description: "偏好 HTTPS 升级" },
  { value: "TE", description: "可接受的传输编码" },
  { value: "Expect", description: "100-continue 协商" },
  { value: "Forwarded", description: "代理链路信息" },
  { value: "X-Forwarded-For", description: "代理链客户端 IP" },
  { value: "X-Forwarded-Proto", description: "代理链原始协议" },
  { value: "Retry-After", description: "重试等待秒数" },
  { value: "WWW-Authenticate", description: "认证挑战（响应侧）" },
];

export const HEADER_VALUES: Record<string, Suggestion[]> = {
  "content-type": [
    { value: "application/json", description: "JSON 请求体" },
    { value: "application/x-www-form-urlencoded", description: "表单键值对" },
    { value: "multipart/form-data", description: "文件 / 混合表单" },
    { value: "text/plain", description: "纯文本" },
    { value: "text/html", description: "HTML 文档" },
    { value: "application/xml", description: "XML 文档" },
    { value: "application/octet-stream", description: "二进制流" },
    { value: "application/graphql", description: "GraphQL 查询" },
  ],
  accept: [
    { value: "application/json", description: "只接受 JSON" },
    { value: "*/*", description: "接受任意类型" },
    { value: "text/plain", description: "只接受纯文本" },
    { value: "text/html", description: "只接受 HTML" },
    { value: "application/xml", description: "只接受 XML" },
  ],
  authorization: [
    { value: "Bearer ", description: "Bearer <token>" },
    { value: "Basic ", description: "Basic <base64(user:pass)>" },
    { value: "Token ", description: "Token <key>" },
  ],
  "cache-control": [
    { value: "no-cache", description: "每次向服务器验证" },
    { value: "no-store", description: "禁止任何缓存" },
    { value: "max-age=0", description: "立即过期" },
    { value: "max-age=3600", description: "缓存 1 小时" },
    { value: "public", description: "允许共享缓存" },
    { value: "private", description: "仅浏览器私有缓存" },
  ],
  "accept-encoding": [
    { value: "gzip, deflate, br", description: "常见压缩全开" },
    { value: "gzip", description: "仅 gzip" },
    { value: "br", description: "仅 Brotli" },
    { value: "identity", description: "不压缩" },
  ],
  "accept-language": [
    { value: "zh-CN,zh;q=0.9", description: "简体中文优先" },
    { value: "en-US,en;q=0.9", description: "美式英语优先" },
    { value: "*", description: "任意语言" },
  ],
  connection: [
    { value: "keep-alive", description: "复用连接" },
    { value: "close", description: "响应后关闭" },
  ],
  "x-requested-with": [{ value: "XMLHttpRequest", description: "标记 AJAX 请求" }],
  pragma: [{ value: "no-cache", description: "HTTP/1.0 不缓存" }],
  dnt: [
    { value: "1", description: "拒绝跟踪" },
    { value: "0", description: "允许跟踪" },
  ],
  "upgrade-insecure-requests": [{ value: "1", description: "偏好 HTTPS" }],
};

const MAX_EXTRA = 12;

/** Curated suggestions first, then names/values actually used in history & collections. */
export function buildHeaderSuggestions(
  history: HistoryEntry[],
  nodes: CollectionNode[],
): { keys: Suggestion[]; values: (key: string) => Suggestion[] } {
  const nameCount = new Map<string, { display: string; n: number }>();
  const valueCount = new Map<string, Map<string, { display: string; n: number }>>();

  const feed = (rows: KeyValue[] | undefined) => {
    for (const row of rows ?? []) {
      const name = row.key.trim();
      if (!name) continue;
      const lk = name.toLowerCase();
      const cur = nameCount.get(lk);
      nameCount.set(lk, { display: cur?.display ?? name, n: (cur?.n ?? 0) + 1 });
      const value = row.value.trim();
      if (!value) continue;
      let per = valueCount.get(lk);
      if (!per) {
        per = new Map();
        valueCount.set(lk, per);
      }
      const lv = value.toLowerCase();
      const vc = per.get(lv);
      per.set(lv, { display: vc?.display ?? value, n: (vc?.n ?? 0) + 1 });
    }
  };
  for (const h of history) feed(h.request?.headers);
  for (const n of nodes) if (n.type === "request") feed(n.request?.headers);

  const curated = new Set(COMMON_HEADERS.map((h) => h.value.toLowerCase()));
  const extraNames = [...nameCount.entries()]
    .filter(([lk]) => !curated.has(lk))
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, MAX_EXTRA)
    .map(([, v]) => ({ value: v.display, description: `历史常用 · 出现 ${v.n} 次` }));

  const values = (key: string): Suggestion[] => {
    const lk = key.trim().toLowerCase();
    const base = HEADER_VALUES[lk] ?? [];
    const known = new Set(base.map((s) => s.value.toLowerCase()));
    const used = [...(valueCount.get(lk)?.entries() ?? [])]
      .filter(([lv]) => !known.has(lv))
      .sort((a, b) => b[1].n - a[1].n)
      .slice(0, MAX_EXTRA)
      .map(([, v]) => ({ value: v.display, description: `历史值 · 出现 ${v.n} 次` }));
    return [...base, ...used];
  };

  return { keys: [...COMMON_HEADERS, ...extraNames], values };
}
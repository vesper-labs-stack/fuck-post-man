import type { AuthConfig, BodyType, HttpMethod, KeyValue } from "../types";
import { uid } from "./helpers";

export interface ParsedCurl {
  method: HttpMethod;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  auth: AuthConfig;
  bodyType: BodyType;
  body: string;
  bodyForm: KeyValue[];
}

const KNOWN_METHODS: HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "HEAD",
  "OPTIONS",
];

/** Flags that consume the next token (or an attached value) as argument. */
const ARG_FLAGS = new Set([
  "-X", "--request",
  "-H", "--header",
  "-d", "--data", "--data-raw", "--data-binary", "--data-ascii", "--data-urlencode",
  "--json",
  "-u", "--user",
  "-b", "--cookie",
  "-A", "--user-agent",
  "-e", "--referer",
  "--url",
  "-F", "--form", "--form-string",
  "-o", "--output",
  "-D", "--dump-header",
  "-c", "--cookie-jar",
  "-m", "--max-time",
  "--connect-timeout",
  "--retry", "--retry-delay", "--retry-max-time",
  "--limit-rate",
  "-x", "--proxy",
  "-U", "--proxy-user",
  "--cacert", "--capath", "--cert", "--key",
  "--resolve", "--interface", "--local-port",
  "--socks5", "--socks5-hostname",
  "--ciphers", "--tls-max",
  "--output-dir",
  "-w", "--write-out",
  "--stderr", "--trace", "--trace-ascii",
  "-K", "--config",
  "--max-filesize",
  "--expect100-timeout",
  "--happy-eyeballs-timeout-ms",
  "--speed-limit", "--speed-time",
  "-r", "--range",
  "-z", "--time-cond",
  "--netrc-file",
  "--oauth2-bearer",
  "--aws-sigv4",
  "--unix-socket", "--abstract-unix-socket",
  "--alt-svc", "--hsts", "--doh-url",
  "--proxy-cacert", "--proxy-cert", "--proxy-key",
  "--request-target",
  "--max-redirs",
  "--keepalive-time",
  "--tftp-blksize",
  "--ftp-account",
  "--ftp-alternative-to-user",
  "--mail-from", "--mail-rcpt",
  "--quote", "-Q",
  "--upload-file", "-T",
  "--continue-at", "-C",
  "--proto", "--proto-redir",
  "--service-name",
  "--delegation",
  "--engine",
  "--random-file",
  "--egd-file",
  "--cert-type", "--key-type",
  "--pass",
  "--crlfile",
  "--pinnedpubkey",
  "--proxy-pinnedpubkey",
  "--login-options",
  "--sasl-authzid",
  "--krb",
  "--negotiate",
  "--ntlm",
  "--ntlm-wb",
  "--digest",
  "--anyauth",
  "--basic",
]);

/** Boolean flags we recognise and safely ignore. */
const IGNORED_FLAGS = new Set([
  "-k", "--insecure",
  "-L", "--location", "--location-trusted",
  "--compressed", "--compressed-ssh",
  "-s", "--silent",
  "-S", "--show-error",
  "-i", "--include",
  "-v", "--verbose",
  "-#", "--progress-bar",
  "--http1.0", "--http1.1", "--http2", "--http2-prior-knowledge", "--http3",
  "--no-keepalive",
  "-N", "--no-buffer",
  "-f", "--fail", "--fail-early", "--fail-with-body",
  "-g", "--globoff",
  "--no-alpn", "--no-npn",
  "--create-dirs",
  "--parallel", "-Z", "--parallel-immediate", "--parallel-max",
  "--path-as-is",
  "--tcp-nodelay", "--tcp-fastopen",
  "--tlsv1.0", "--tlsv1.1", "--tlsv1.2", "--tlsv1.3",
  "--ssl", "--ssl-reqd", "--ftp-ssl", "--ftp-ssl-reqd",
  "--disable-eprt", "--disable-epsv",
  "--ftp-create-dirs", "--ftp-method", "--ftp-pasv", "--ftp-port",
  "--use-ascii", "-B",
  "--crlf",
  "--stderr",
  "--no-sessionid",
  "--post301", "--post302", "--post303",
  "--proxy-insecure",
  "--proxy-http2",
  "--proxy-ntlm", "--proxy-digest", "--proxy-basic", "--proxy-anyauth",
  "--tr-encoding",
  "--raw",
  "--styled-output",
  "--xattr",
  "--metalink",
  "--sasl-ir",
  "--oauth2-bearer",
  "--next",
]);

const SHORT_ARG = new Set(
  [...ARG_FLAGS].filter((f) => /^-[a-zA-Z]$/.test(f)),
);
const SHORT_BOOL = new Set(
  [...IGNORED_FLAGS].filter((f) => /^-[a-zA-Z]$/.test(f)).map((f) => f[1]),
);

/** Shell-aware tokenizer: quotes, escapes and backslash-newline continuations. */
export function tokenizeCurl(input: string): string[] {
  const src = input.replace(/\\\r?\n/g, " ");
  const tokens: string[] = [];
  let cur = "";
  let has = false;
  let i = 0;
  const push = () => {
    if (has) {
      tokens.push(cur);
      cur = "";
      has = false;
    }
  };
  while (i < src.length) {
    const c = src[i];
    if (c === "'") {
      has = true;
      i++;
      while (i < src.length && src[i] !== "'") cur += src[i++];
      i++;
      continue;
    }
    if (c === '"') {
      has = true;
      i++;
      while (i < src.length && src[i] !== '"') {
        if (src[i] === "\\" && i + 1 < src.length) {
          const n = src[i + 1];
          cur += n === "n" ? "\n" : n === "t" ? "\t" : n;
          i += 2;
        } else {
          cur += src[i++];
        }
      }
      i++;
      continue;
    }
    if (c === "\\" && i + 1 < src.length && src[i + 1] !== "\n") {
      has = true;
      cur += src[i + 1];
      i += 2;
      continue;
    }
    if (/\s/.test(c)) {
      push();
      i++;
      continue;
    }
    has = true;
    cur += c;
    i++;
  }
  push();
  return tokens;
}

function kv(key: string, value: string): KeyValue {
  return { id: uid(), key, value, enabled: true };
}

function encodeDataUrlencode(part: string): string {
  const eq = part.indexOf("=");
  if (eq === -1) return encodeURIComponent(part);
  const name = part.slice(0, eq);
  const value = part.slice(eq + 1);
  if (!name) return encodeURIComponent(value);
  return `${name}=${encodeURIComponent(value)}`;
}

function splitQuery(url: string): { base: string; query: string } {
  const hash = url.indexOf("#");
  const noHash = hash >= 0 ? url.slice(0, hash) : url;
  const q = noHash.indexOf("?");
  if (q === -1) return { base: noHash, query: "" };
  return { base: noHash.slice(0, q), query: noHash.slice(q + 1) };
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  if (!t.startsWith("{") && !t.startsWith("[")) return false;
  try {
    JSON.parse(t);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse a terminal `curl` invocation into request state.
 * Throws Error with a human-readable (zh-CN) message on unusable input.
 */
export function parseCurl(input: string): ParsedCurl {
  const tokens = tokenizeCurl(input);
  if (tokens.length === 0) throw new Error("粘贴内容为空");

  let method: HttpMethod | null = null;
  let headFlag = false;
  let getFlag = false;
  let jsonFlag = false;
  let url: string | null = null;
  let user: string | null = null;
  const headers: KeyValue[] = [];
  const dataParts: string[] = [];
  const formFields: KeyValue[] = [];

  const addHeader = (raw: string) => {
    const idx = raw.indexOf(":");
    if (idx <= 0) return;
    headers.push(kv(raw.slice(0, idx).trim(), raw.slice(idx + 1).trim()));
  };
  const hasHeader = (name: string) =>
    headers.some((h) => h.key.toLowerCase() === name);

  let i = 0;
  if (tokens[0] === "curl") i = 1;
  for (; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "--") {
      for (let j = i + 1; j < tokens.length; j++)
        if (!url) url = tokens[j];
      break;
    }
    let flag: string;
    let value: string | undefined;
    if (t.startsWith("--")) {
      const eq = t.indexOf("=");
      if (eq >= 0) {
        flag = t.slice(0, eq);
        value = t.slice(eq + 1);
      } else {
        flag = t;
      }
    } else if (t.startsWith("-") && t.length > 1) {
      const short = `-${t[1]}`;
      if (SHORT_ARG.has(short) && t.length > 2) {
        flag = short;
        value = t.slice(2);
      } else if (
        t.length > 2 &&
        [...t.slice(1)].every((ch) => SHORT_BOOL.has(ch))
      ) {
        continue;
      } else {
        flag = t;
      }
    } else {
      if (!url) url = t;
      continue;
    }

    if (value === undefined && ARG_FLAGS.has(flag)) {
      value = tokens[++i];
      if (value === undefined) throw new Error(`选项 ${flag} 缺少参数`);
    }

    switch (flag) {
      case "-X":
      case "--request": {
        const m = (value ?? "").toUpperCase() as HttpMethod;
        if (!KNOWN_METHODS.includes(m))
          throw new Error(`不支持的 Method：${value}`);
        method = m;
        break;
      }
      case "-I":
      case "--head":
        headFlag = true;
        break;
      case "-G":
      case "--get":
        getFlag = true;
        break;
      case "-H":
      case "--header":
        addHeader(value ?? "");
        break;
      case "-d":
      case "--data":
      case "--data-raw":
      case "--data-binary":
      case "--data-ascii":
        dataParts.push(value ?? "");
        break;
      case "--data-urlencode":
        dataParts.push(encodeDataUrlencode(value ?? ""));
        break;
      case "--json":
        jsonFlag = true;
        dataParts.push(value ?? "");
        break;
      case "-u":
      case "--user":
        user = value ?? "";
        break;
      case "-b":
      case "--cookie":
        addHeader(`Cookie: ${value ?? ""}`);
        break;
      case "-A":
      case "--user-agent":
        addHeader(`User-Agent: ${value ?? ""}`);
        break;
      case "-e":
      case "--referer":
        addHeader(`Referer: ${value ?? ""}`);
        break;
      case "--url":
        url = value ?? "";
        break;
      case "-F":
      case "--form":
      case "--form-string": {
        const raw = value ?? "";
        const eq = raw.indexOf("=");
        if (eq > 0) formFields.push(kv(raw.slice(0, eq), raw.slice(eq + 1)));
        break;
      }
      case "-T":
      case "--upload-file":
        dataParts.push(`@${value ?? ""}`);
        break;
      default:
        if (IGNORED_FLAGS.has(flag)) break;
        if (ARG_FLAGS.has(flag)) break;
        if (flag.startsWith("--")) break;
        break;
    }
  }

  if (!url) throw new Error("未识别到 URL，请检查 cURL 命令");
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url)) url = `http://${url}`;

  const dataJoined = dataParts.join("&");
  let { base, query } = splitQuery(url);
  if (getFlag && dataJoined) {
    query = query ? `${query}&${dataJoined}` : dataJoined;
  }

  const params: KeyValue[] = [];
  if (query) {
    for (const [key, value] of new URLSearchParams(query)) {
      params.push(kv(key, value));
    }
  }

  let bodyType: BodyType = "none";
  let body = "";
  let bodyForm: KeyValue[] = [];
  if (formFields.length > 0) {
    bodyType = "form-data";
    bodyForm = formFields;
  } else if (dataJoined && !getFlag) {
    if (jsonFlag || looksLikeJson(dataJoined)) {
      bodyType = "json";
      body = dataJoined.trim();
      if (!hasHeader("content-type"))
        headers.push(kv("Content-Type", "application/json"));
      if (jsonFlag && !hasHeader("accept"))
        headers.push(kv("Accept", "application/json"));
    } else {
      bodyType = "raw";
      body = dataJoined;
      if (!hasHeader("content-type"))
        headers.push(
          kv("Content-Type", "application/x-www-form-urlencoded"),
        );
    }
  }

  const resolvedMethod: HttpMethod =
    method ??
    (headFlag ? "HEAD" : getFlag ? "GET" : bodyType !== "none" ? "POST" : "GET");

  const auth: AuthConfig = {
    type: "none",
    bearerToken: "",
    basicUsername: "",
    basicPassword: "",
  };
  if (user !== null) {
    const idx = user.indexOf(":");
    auth.type = "basic";
    auth.basicUsername = idx >= 0 ? user.slice(0, idx) : user;
    auth.basicPassword = idx >= 0 ? user.slice(idx + 1) : "";
  }

  return {
    method: resolvedMethod,
    url: base,
    params,
    headers,
    auth,
    bodyType,
    body,
    bodyForm,
  };
}
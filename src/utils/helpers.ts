import type { HttpMethod } from "../types";

/** Stable unique id for tabs, rows, history entries, etc. */
export function uid(): string {
  return crypto.randomUUID();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/** iOS system-color text class per HTTP method. */
export function methodColor(method: HttpMethod | string): string {
  switch (method.toUpperCase()) {
    case "GET":
      return "text-green";
    case "POST":
      return "text-orange";
    case "PUT":
      return "text-indigo";
    case "DELETE":
      return "text-red";
    case "PATCH":
      return "text-purple";
    case "HEAD":
      return "text-teal";
    case "OPTIONS":
      return "text-pink";
    default:
      return "text-label2";
  }
}

/** Literal tinted-badge classes (kept literal for Tailwind JIT). */
export function methodBadge(method: HttpMethod | string): string {
  switch (method.toUpperCase()) {
    case "GET":
      return "text-green bg-green/15";
    case "POST":
      return "text-orange bg-orange/15";
    case "PUT":
      return "text-indigo bg-indigo/15";
    case "DELETE":
      return "text-red bg-red/15";
    case "PATCH":
      return "text-purple bg-purple/15";
    case "HEAD":
      return "text-teal bg-teal/15";
    case "OPTIONS":
      return "text-pink bg-pink/15";
    default:
      return "text-label2 bg-fill";
  }
}

export function statusColor(code: number): string {
  if (code >= 200 && code < 300) return "text-green";
  if (code >= 300 && code < 400) return "text-indigo";
  if (code >= 400 && code < 500) return "text-orange";
  if (code >= 500) return "text-red";
  return "text-label2";
}

export function statusBadge(code: number): string {
  if (code >= 200 && code < 300) return "text-green bg-green/15";
  if (code >= 300 && code < 400) return "text-indigo bg-indigo/15";
  if (code >= 400 && code < 500) return "text-orange bg-orange/15";
  if (code >= 500) return "text-red bg-red/15";
  return "text-label2 bg-fill";
}

/** Base64 that tolerates unicode (btoa alone throws on non-latin1). */
export function toBase64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}
// ---------------------------------------------------------------------------
// IPC contract — mirrors src-tauri/src/http.rs exactly (snake_case both sides).
// ---------------------------------------------------------------------------

export interface HttpRequestPayload {
  method: string;
  url: string;
  headers: Record<string, string>;
  params: Record<string, string>;
  body_type: string;
  body: string | null;
  timeout_ms: number | null;
}

export interface HttpResponsePayload {
  status_code: number;
  status_text: string;
  headers: Record<string, string>;
  body: string;
  time_elapsed_ms: number;
  size_bytes: number;
}

/** Pushed over Tauri events when an SSE response starts. */
export interface StreamMeta {
  status_code: number;
  status_text: string;
  headers: Record<string, string>;
}

/** One decoded piece of an SSE body, pushed as it arrives. */
export interface StreamChunk {
  text: string;
}

// ---------------------------------------------------------------------------
// Load-test IPC contract — mirrors src-tauri/src/loadtest.rs (snake_case).
// ---------------------------------------------------------------------------

export interface LoadTestConfig {
  url: string;
  method: string;
  concurrency: number;
  total_requests: number;
  headers: Record<string, string>;
  params: Record<string, string>;
  body_type: string;
  body: string | null;
}

/** Live metrics pushed over `load-test://progress` while a run is in flight. */
export interface LoadTestProgress {
  completed: number;
  total: number;
  success: number;
  failed: number;
  avg_ms: number;
  qps: number;
  elapsed_ms: number;
  running: boolean;
}

/** Final summary returned when `start_load_test` resolves. */
export interface LoadTestReport {
  total: number;
  completed: number;
  success: number;
  failed: number;
  success_rate: number;
  avg_ms: number;
  min_ms: number;
  max_ms: number;
  elapsed_ms: number;
  qps: number;
  stopped: boolean;
}

// ---------------------------------------------------------------------------
// UI domain model
// ---------------------------------------------------------------------------

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "HEAD"
  | "OPTIONS";

export const HTTP_METHODS: HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "HEAD",
  "OPTIONS",
];

export type BodyType =
  | "none"
  | "json"
  | "form-data"
  | "x-www-form-urlencoded"
  | "raw";

export type AuthType = "none" | "bearer" | "basic";

export type Theme = "light" | "dark";

export interface KeyValue {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface AuthConfig {
  type: AuthType;
  bearerToken: string;
  basicUsername: string;
  basicPassword: string;
}

export type AssertionTarget = "status" | "time" | "json";

export type AssertionOp =
  | "eq"
  | "neq"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "contains"
  | "exists";

export interface Assertion {
  id: string;
  enabled: boolean;
  target: AssertionTarget;
  /** Dot path into the JSON body, e.g. data.code or items[0].id */
  path: string;
  op: AssertionOp;
  expected: string;
}

export interface AssertionResult {
  id: string;
  passed: boolean;
  label: string;
  actual: string;
  detail: string;
}

export interface RequestState {
  method: HttpMethod;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  auth: AuthConfig;
  bodyType: BodyType;
  body: string;
  bodyForm: KeyValue[];
  assertions: Assertion[];
}

export interface ResponseState {
  data: HttpResponsePayload | null;
  error: string | null;
  loading: boolean;
  assertionResults: AssertionResult[] | null;
  /** True while SSE chunks are still arriving. */
  streaming: boolean;
  /** Live-accumulated SSE text shown with the typewriter view. */
  streamText: string;
}

export interface RequestTab {
  id: string;
  name: string;
  /** Linked saved-collection node, if this tab was saved / opened from one. */
  collectionNodeId: string | null;
  request: RequestState;
  response: ResponseState;
}

export interface HistoryEntry {
  id: string;
  method: HttpMethod;
  url: string;
  timestamp: number;
  status: number | null;
  request: RequestState;
}

/** Postman-style collection tree node (flat list + parentId). */
export interface CollectionNode {
  id: string;
  parentId: string | null;
  type: "folder" | "request";
  name: string;
  expanded?: boolean;
  request?: RequestState;
}

export interface Environment {
  id: string;
  name: string;
  variables: Record<string, string>;
}

/**
 * Metadata for a secret stored in OS secure storage. Only the name lives in
 * the persisted store — the value itself never leaves the Rust vault.
 */
export interface SecretMeta {
  id: string;
  name: string;
  createdAt: number;
}

export interface ContextMenuItem {
  label: string;
  icon?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}
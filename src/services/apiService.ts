import { invoke } from "@tauri-apps/api/core";
import type {
  HttpRequestPayload,
  HttpResponsePayload,
  LoadTestConfig,
  LoadTestReport,
} from "../types";

/**
 * The single outbound network path for the whole app.
 *
 * Every request is delegated to the Rust `execute_request` command via Tauri
 * IPC. The webview never calls fetch/axios directly, which sidesteps CORS and
 * mixed-content restrictions entirely.
 */
export async function sendHttpRequest(
  payload: HttpRequestPayload,
  streamId?: string,
): Promise<HttpResponsePayload> {
  return invoke<HttpResponsePayload>("execute_request", { payload, streamId });
}

/** Native save dialog; resolves to the written path, or null if cancelled. */
export async function saveReport(
  defaultName: string,
  contents: string,
): Promise<string | null> {
  return invoke<string | null>("save_text_file", { defaultName, contents });
}

// ---------------------------------------------------------------------------
// Secure vault — values live in OS credential storage, handled entirely in
// Rust. The webview only ever sees names and presence flags.
// ---------------------------------------------------------------------------

export async function vaultSet(name: string, value: string): Promise<void> {
  return invoke<void>("vault_set", { name, value });
}

export async function vaultGet(name: string): Promise<string | null> {
  return invoke<string | null>("vault_get", { name });
}

export async function vaultDelete(name: string): Promise<void> {
  return invoke<void>("vault_delete", { name });
}

/** Map of secret name → whether it currently exists in OS secure storage. */
export async function vaultStatus(
  names: string[],
): Promise<Record<string, boolean>> {
  return invoke<Record<string, boolean>>("vault_status", { names });
}

/** Replace stored secret values in an export document with placeholders. */
export async function sanitizeExport(
  contents: string,
  names: string[],
): Promise<string> {
  return invoke<string>("sanitize_export", { contents, names });
}

// ---------------------------------------------------------------------------
// Load test — the concurrent request pool runs entirely in Rust; the webview
// only sends the config and listens for `load-test://progress` events.
// ---------------------------------------------------------------------------

export async function startLoadTest(
  config: LoadTestConfig,
): Promise<LoadTestReport> {
  return invoke<LoadTestReport>("start_load_test", { config });
}

export async function stopLoadTest(): Promise<void> {
  return invoke<void>("stop_load_test");
}
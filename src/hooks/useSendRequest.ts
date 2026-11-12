import { useCallback } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { sendHttpRequest } from "../services/apiService";
import { useAppStore } from "../store/useAppStore";
import type {
  HttpRequestPayload,
  KeyValue,
  RequestState,
  RequestTab,
  StreamChunk,
  StreamMeta,
} from "../types";
import { parseEnvironmentVariables } from "../utils/env";
import { evaluateAssertions } from "../utils/assertions";
import { toBase64, uid } from "../utils/helpers";

const DEFAULT_TIMEOUT_MS = 30_000;

function kvToRecord(
  rows: KeyValue[],
  envMap: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    if (!row.enabled || !row.key.trim()) continue;
    out[parseEnvironmentVariables(row.key, envMap)] = parseEnvironmentVariables(
      row.value,
      envMap,
    );
  }
  return out;
}

/** Serialize the body to the string form the Rust payload expects. */
function serializeBody(
  request: RequestState,
  envMap: Record<string, string>,
): string | null {
  switch (request.bodyType) {
    case "none":
      return null;
    case "json":
    case "raw":
      return parseEnvironmentVariables(request.body, envMap);
    case "x-www-form-urlencoded": {
      const search = new URLSearchParams();
      for (const row of request.bodyForm) {
        if (!row.enabled || !row.key.trim()) continue;
        search.append(
          parseEnvironmentVariables(row.key, envMap),
          parseEnvironmentVariables(row.value, envMap),
        );
      }
      return search.toString();
    }
    case "form-data": {
      const fields: Record<string, string> = {};
      for (const row of request.bodyForm) {
        if (!row.enabled || !row.key.trim()) continue;
        fields[parseEnvironmentVariables(row.key, envMap)] =
          parseEnvironmentVariables(row.value, envMap);
      }
      return JSON.stringify(fields);
    }
    default:
      return null;
  }
}

/**
 * Resolve all `{{variables}}` across URL / headers / params / body and fold auth
 * into an Authorization header, producing the exact payload the Rust side expects.
 */
export function buildPayload(
  request: RequestState,
  envMap: Record<string, string>,
): HttpRequestPayload {
  const headers = kvToRecord(request.headers, envMap);

  if (request.auth.type === "bearer" && request.auth.bearerToken.trim()) {
    headers["Authorization"] =
      `Bearer ${parseEnvironmentVariables(request.auth.bearerToken, envMap)}`;
  } else if (request.auth.type === "basic") {
    const user = parseEnvironmentVariables(request.auth.basicUsername, envMap);
    const pass = parseEnvironmentVariables(request.auth.basicPassword, envMap);
    headers["Authorization"] = `Basic ${toBase64(`${user}:${pass}`)}`;
  }

  return {
    method: request.method,
    url: parseEnvironmentVariables(request.url, envMap),
    headers,
    params: kvToRecord(request.params, envMap),
    body_type: request.bodyType,
    body: serializeBody(request, envMap),
    timeout_ms: DEFAULT_TIMEOUT_MS,
  };
}

export function useSendRequest() {
  const setResponse = useAppStore((s) => s.setResponse);
  const addHistory = useAppStore((s) => s.addHistory);
  const getActiveEnvMap = useAppStore((s) => s.getActiveEnvMap);

  return useCallback(
    async (tab: RequestTab) => {
      const envMap = getActiveEnvMap();
      const payload = buildPayload(tab.request, envMap);
      const timestamp = Date.now();
      const streamId = uid();

      setResponse(tab.id, {
        loading: true,
        error: null,
        assertionResults: null,
        streaming: false,
        streamText: "",
      });

      const unlisteners: UnlistenFn[] = [];
      try {
        unlisteners.push(
          await listen<StreamMeta>(`http-stream://${streamId}/meta`, (event) => {
            const meta = event.payload;
            setResponse(tab.id, {
              data: {
                status_code: meta.status_code,
                status_text: meta.status_text,
                headers: meta.headers,
                body: "",
                time_elapsed_ms: 0,
                size_bytes: 0,
              },
              streaming: true,
              streamText: "",
            });
          }),
        );
        unlisteners.push(
          await listen<StreamChunk>(
            `http-stream://${streamId}/chunk`,
            (event) => {
              const current = useAppStore
                .getState()
                .tabs.find((t) => t.id === tab.id);
              if (!current) return;
              const piece = event.payload.text;
              const pieceBytes = new TextEncoder().encode(piece).length;
              setResponse(tab.id, {
                streamText: current.response.streamText + piece,
                data: current.response.data
                  ? {
                      ...current.response.data,
                      size_bytes: current.response.data.size_bytes + pieceBytes,
                    }
                  : null,
              });
            },
          ),
        );

        const data = await sendHttpRequest(payload, streamId);
        unlisteners.forEach((unlisten) => unlisten());
        unlisteners.length = 0;
        setResponse(tab.id, {
          data,
          loading: false,
          error: null,
          streaming: false,
          streamText: "",
          assertionResults: evaluateAssertions(tab.request.assertions ?? [], data),
        });
        addHistory({
          method: tab.request.method,
          url: payload.url,
          timestamp,
          status: data.status_code,
          request: tab.request,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setResponse(tab.id, {
          data: null,
          loading: false,
          error: message,
          assertionResults: null,
          streaming: false,
          streamText: "",
        });
        addHistory({
          method: tab.request.method,
          url: payload.url,
          timestamp,
          status: null,
          request: tab.request,
        });
      } finally {
        unlisteners.forEach((unlisten) => unlisten());
      }
    },
    [setResponse, addHistory, getActiveEnvMap],
  );
}
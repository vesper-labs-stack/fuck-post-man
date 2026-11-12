import type {
  Assertion,
  CollectionNode,
  KeyValue,
  RequestState,
  RequestTab,
} from "../types";
import { uid } from "./helpers";

export function newKeyValue(key = "", value = ""): KeyValue {
  return { id: uid(), key, value, enabled: true };
}

export function createAssertion(patch: Partial<Assertion> = {}): Assertion {
  return {
    id: uid(),
    enabled: true,
    target: "status",
    path: "",
    op: "eq",
    expected: "200",
    ...patch,
  };
}

export function createEmptyRequest(): RequestState {
  return {
    method: "GET",
    url: "",
    params: [newKeyValue()],
    headers: [newKeyValue()],
    auth: {
      type: "none",
      bearerToken: "",
      basicUsername: "",
      basicPassword: "",
    },
    bodyType: "none",
    body: "",
    bodyForm: [newKeyValue()],
    assertions: [],
  };
}

export function createTab(name = "Untitled Request"): RequestTab {
  return {
    id: uid(),
    name,
    collectionNodeId: null,
    request: createEmptyRequest(),
    response: {
      data: null,
      error: null,
      loading: false,
      assertionResults: null,
      streaming: false,
      streamText: "",
    },
  };
}

/** Deep-ish clone so opening from history/collection never shares row ids. */
export function cloneRequest(request: RequestState): RequestState {
  return {
    ...request,
    params: request.params.map((p) => ({ ...p, id: uid() })),
    headers: request.headers.map((h) => ({ ...h, id: uid() })),
    bodyForm: request.bodyForm.map((f) => ({ ...f, id: uid() })),
    assertions: (request.assertions ?? []).map((a) => ({ ...a, id: uid() })),
    auth: { ...request.auth },
  };
}

/** Identity of a request ignoring row ids and blank placeholder rows. */
export function requestSignature(request: RequestState): string {
  const rows = (kvs: KeyValue[]) =>
    kvs
      .filter((kv) => kv.key.trim() !== "" || kv.value.trim() !== "")
      .map((kv) => [kv.key, kv.value, kv.enabled]);
  return JSON.stringify([
    request.method,
    request.url,
    request.bodyType,
    request.body,
    request.auth,
    rows(request.params),
    rows(request.headers),
    rows(request.bodyForm),
    (request.assertions ?? []).map((a) => [
      a.enabled,
      a.target,
      a.path,
      a.op,
      a.expected,
    ]),
  ]);
}

export function createFolderNode(
  parentId: string | null,
  name: string,
): CollectionNode {
  return { id: uid(), parentId, type: "folder", name, expanded: true };
}

export function createRequestNode(
  parentId: string | null,
  name: string,
  request: RequestState,
): CollectionNode {
  return { id: uid(), parentId, type: "request", name, request };
}
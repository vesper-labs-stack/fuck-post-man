import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  CollectionNode,
  ContextMenuItem,
  ContextMenuState,
  Environment,
  HistoryEntry,
  RequestState,
  RequestTab,
  ResponseState,
  SecretMeta,
  Theme,
} from "../types";
import {
  cloneRequest,
  createFolderNode,
  createRequestNode,
  createTab,
  requestSignature,
} from "../utils/factory";
import { descendantIds, isDescendant } from "../utils/collections";
import { uid } from "../utils/helpers";

const HISTORY_LIMIT = 100;

interface AppState {
  // Session state
  tabs: RequestTab[];
  activeTabId: string;
  sidebarTab: "collections" | "history";
  contextMenu: ContextMenuState | null;
  saveSheetTabId: string | null;
  renamingNodeId: string | null;
  runnerOpen: boolean;
  runnerFolderId: string | null;
  loadTestOpen: boolean;

  // Durable state
  history: HistoryEntry[];
  collectionNodes: CollectionNode[];
  environments: Environment[];
  activeEnvironmentId: string | null;
  theme: Theme;
  /** Secret names only — values live in OS secure storage, never here. */
  secrets: SecretMeta[];

  // Tabs
  addTab: () => void;
  openTab: (
    name: string,
    request: RequestState,
    collectionNodeId?: string | null,
  ) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  moveTab: (id: string, beforeId: string | null) => void;
  renameTab: (id: string, name: string) => void;
  updateRequest: (id: string, patch: Partial<RequestState>) => void;
  setResponse: (id: string, patch: Partial<ResponseState>) => void;

  // Sidebar / overlays
  setSidebarTab: (tab: "collections" | "history") => void;
  openContextMenu: (x: number, y: number, items: ContextMenuItem[]) => void;
  closeContextMenu: () => void;
  openSaveSheet: (tabId: string) => void;
  closeSaveSheet: () => void;
  requestRename: (id: string | null) => void;
  setTheme: (theme: Theme) => void;
  openRunner: (folderId?: string | null) => void;
  closeRunner: () => void;
  openLoadTest: () => void;
  closeLoadTest: () => void;

  // History
  addHistory: (entry: Omit<HistoryEntry, "id">) => void;
  clearHistory: () => void;

  // Collection tree
  addFolder: (parentId: string | null, name: string) => string;
  addRequestNode: (
    parentId: string | null,
    name: string,
    request: RequestState,
  ) => string;
  saveRequestFromTab: (
    tabId: string,
    name: string,
    parentId: string | null,
  ) => string;
  renameNode: (id: string, name: string) => void;
  deleteNode: (id: string) => void;
  duplicateRequestNode: (id: string) => void;
  moveNode: (
    id: string,
    parentId: string | null,
    beforeId: string | null,
  ) => void;
  toggleExpanded: (id: string) => void;

  // Environments
  addEnvironment: (name: string) => void;
  updateEnvironment: (
    id: string,
    patch: Partial<Omit<Environment, "id">>,
  ) => void;
  deleteEnvironment: (id: string) => void;
  setActiveEnvironment: (id: string | null) => void;
  getActiveEnvMap: () => Record<string, string>;

  // Secrets (metadata only; values are handled by the Rust vault)
  addSecret: (name: string) => string;
  renameSecret: (id: string, name: string) => void;
  deleteSecret: (id: string) => void;
}

const initialTab = createTab();

const seedEnvironments: Environment[] = [
  {
    id: "env-dev",
    name: "Dev",
    variables: { baseUrl: "https://jsonplaceholder.typicode.com" },
  },
];

const seedCollection: CollectionNode[] = [
  {
    id: "folder-demo",
    parentId: null,
    type: "folder",
    name: "Sample APIs",
    expanded: true,
  },
  {
    id: "req-demo-1",
    parentId: "folder-demo",
    type: "request",
    name: "Get todo",
    request: {
      ...createTab().request,
      method: "GET",
      url: "{{baseUrl}}/todos/1",
    },
  },
];

const seedHistory: HistoryEntry[] = [
  {
    id: "hist-demo-2",
    method: "POST",
    url: "https://jsonplaceholder.typicode.com/posts",
    timestamp: Date.now() - 2 * 60_000,
    status: 201,
    request: {
      ...createTab().request,
      method: "POST",
      url: "{{baseUrl}}/posts",
      headers: [
        {
          id: "hist-demo-2-h1",
          key: "Content-Type",
          value: "application/json",
          enabled: true,
        },
      ],
      bodyType: "json",
      body: '{\n  "title": "hello",\n  "body": "from history",\n  "userId": 1\n}',
    },
  },
  {
    id: "hist-demo-1",
    method: "GET",
    url: "https://jsonplaceholder.typicode.com/todos/1",
    timestamp: Date.now() - 5 * 60_000,
    status: 200,
    request: {
      ...createTab().request,
      method: "GET",
      url: "{{baseUrl}}/todos/1",
    },
  },
];

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      tabs: [initialTab],
      activeTabId: initialTab.id,
      sidebarTab: "collections",
      contextMenu: null,
      saveSheetTabId: null,
      renamingNodeId: null,
      runnerOpen: false,
      runnerFolderId: null,
      loadTestOpen: false,
      history: seedHistory,
      collectionNodes: seedCollection,
      environments: seedEnvironments,
      activeEnvironmentId: "env-dev",
      theme: "light",
      secrets: [],

      addTab: () =>
        set((state) => {
          const tab = createTab();
          return { tabs: [...state.tabs, tab], activeTabId: tab.id };
        }),

      openTab: (name, request, collectionNodeId = null) =>
        set((state) => {
          const linked = collectionNodeId
            ? state.tabs.find((t) => t.collectionNodeId === collectionNodeId)
            : undefined;
          const sig = request.url.trim() ? requestSignature(request) : null;
          const existing =
            linked ??
            (sig
              ? state.tabs.find((t) => requestSignature(t.request) === sig)
              : undefined);
          if (existing) return { activeTabId: existing.id };
          const tab: RequestTab = {
            id: uid(),
            name,
            collectionNodeId,
            request: cloneRequest(request),
            response: {
              data: null,
              error: null,
              loading: false,
              assertionResults: null,
              streaming: false,
              streamText: "",
            },
          };
          return { tabs: [...state.tabs, tab], activeTabId: tab.id };
        }),

      closeTab: (id) =>
        set((state) => {
          const index = state.tabs.findIndex((t) => t.id === id);
          if (index === -1) return state;
          const tabs = state.tabs.filter((t) => t.id !== id);
          if (tabs.length === 0) {
            const tab = createTab();
            return { tabs: [tab], activeTabId: tab.id };
          }
          const activeTabId =
            state.activeTabId === id
              ? tabs[Math.min(index, tabs.length - 1)].id
              : state.activeTabId;
          return { tabs, activeTabId };
        }),

      setActiveTab: (id) => set({ activeTabId: id }),

      moveTab: (id, beforeId) =>
        set((state) => {
          if (id === beforeId) return state;
          const tab = state.tabs.find((t) => t.id === id);
          if (!tab) return state;
          const rest = state.tabs.filter((t) => t.id !== id);
          let index = rest.length;
          if (beforeId) {
            const i = rest.findIndex((t) => t.id === beforeId);
            if (i >= 0) index = i;
          }
          return {
            tabs: [...rest.slice(0, index), tab, ...rest.slice(index)],
          };
        }),

      renameTab: (id, name) =>
        set((state) => ({
          tabs: state.tabs.map((t) => (t.id === id ? { ...t, name } : t)),
        })),

      updateRequest: (id, patch) =>
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === id ? { ...t, request: { ...t.request, ...patch } } : t,
          ),
        })),

      setResponse: (id, patch) =>
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === id ? { ...t, response: { ...t.response, ...patch } } : t,
          ),
        })),

      setSidebarTab: (tab) => set({ sidebarTab: tab }),

      openContextMenu: (x, y, items) => set({ contextMenu: { x, y, items } }),
      closeContextMenu: () => set({ contextMenu: null }),
      openSaveSheet: (tabId) => set({ saveSheetTabId: tabId }),
      closeSaveSheet: () => set({ saveSheetTabId: null }),
      requestRename: (id) => set({ renamingNodeId: id }),
      setTheme: (theme) => set({ theme }),
      openRunner: (folderId = null) =>
        set({ runnerOpen: true, runnerFolderId: folderId }),
      closeRunner: () => set({ runnerOpen: false }),
      openLoadTest: () => set({ loadTestOpen: true }),
      closeLoadTest: () => set({ loadTestOpen: false }),

      addHistory: (entry) =>
        set((state) => ({
          history: [{ ...entry, id: uid() }, ...state.history].slice(
            0,
            HISTORY_LIMIT,
          ),
        })),

      clearHistory: () => set({ history: [] }),

      addFolder: (parentId, name) => {
        const node = createFolderNode(parentId, name);
        set((state) => ({
          collectionNodes: [...state.collectionNodes, node],
        }));
        return node.id;
      },

      addRequestNode: (parentId, name, request) => {
        const node = createRequestNode(parentId, name, cloneRequest(request));
        set((state) => ({
          collectionNodes: [...state.collectionNodes, node],
        }));
        return node.id;
      },

      saveRequestFromTab: (tabId, name, parentId) => {
        const state = get();
        const tab = state.tabs.find((t) => t.id === tabId);
        if (!tab) return "";
        const existing = tab.collectionNodeId
          ? state.collectionNodes.find((n) => n.id === tab.collectionNodeId)
          : undefined;

        let nodeId: string;
        let collectionNodes: CollectionNode[];
        if (existing) {
          nodeId = existing.id;
          collectionNodes = state.collectionNodes.map((n) =>
            n.id === existing.id
              ? { ...n, name, parentId, request: cloneRequest(tab.request) }
              : n,
          );
        } else {
          const node = createRequestNode(
            parentId,
            name,
            cloneRequest(tab.request),
          );
          nodeId = node.id;
          collectionNodes = [...state.collectionNodes, node];
        }
        set({
          collectionNodes,
          tabs: state.tabs.map((t) =>
            t.id === tabId ? { ...t, name, collectionNodeId: nodeId } : t,
          ),
        });
        return nodeId;
      },

      renameNode: (id, name) =>
        set((state) => ({
          collectionNodes: state.collectionNodes.map((n) =>
            n.id === id ? { ...n, name } : n,
          ),
          tabs: state.tabs.map((t) =>
            t.collectionNodeId === id ? { ...t, name } : t,
          ),
        })),

      deleteNode: (id) =>
        set((state) => {
          const ids = descendantIds(state.collectionNodes, id);
          ids.add(id);
          return {
            collectionNodes: state.collectionNodes.filter(
              (n) => !ids.has(n.id),
            ),
            tabs: state.tabs.map((t) =>
              t.collectionNodeId && ids.has(t.collectionNodeId)
                ? { ...t, collectionNodeId: null }
                : t,
            ),
          };
        }),

      duplicateRequestNode: (id) =>
        set((state) => {
          const node = state.collectionNodes.find((n) => n.id === id);
          if (!node || node.type !== "request" || !node.request) return state;
          const copy = createRequestNode(
            node.parentId,
            `${node.name} copy`,
            cloneRequest(node.request),
          );
          const index = state.collectionNodes.findIndex((n) => n.id === id);
          const next = [...state.collectionNodes];
          next.splice(index + 1, 0, copy);
          return { collectionNodes: next };
        }),

      moveNode: (id, parentId, beforeId) =>
        set((state) => {
          const nodes = state.collectionNodes;
          const node = nodes.find((n) => n.id === id);
          if (!node || parentId === id || beforeId === id) return state;
          if (
            node.type === "folder" &&
            parentId &&
            isDescendant(nodes, id, parentId)
          ) {
            return state;
          }
          const rest = nodes.filter((n) => n.id !== id);
          const moved = { ...node, parentId };
          let index = rest.length;
          if (beforeId) {
            const i = rest.findIndex((n) => n.id === beforeId);
            if (i >= 0) index = i;
          }
          return {
            collectionNodes: [
              ...rest.slice(0, index),
              moved,
              ...rest.slice(index),
            ],
          };
        }),

      toggleExpanded: (id) =>
        set((state) => ({
          collectionNodes: state.collectionNodes.map((n) =>
            n.id === id ? { ...n, expanded: !n.expanded } : n,
          ),
        })),

      addEnvironment: (name) =>
        set((state) => {
          const env: Environment = { id: uid(), name, variables: {} };
          return {
            environments: [...state.environments, env],
            activeEnvironmentId: env.id,
          };
        }),

      updateEnvironment: (id, patch) =>
        set((state) => ({
          environments: state.environments.map((e) =>
            e.id === id ? { ...e, ...patch } : e,
          ),
        })),

      deleteEnvironment: (id) =>
        set((state) => {
          const environments = state.environments.filter((e) => e.id !== id);
          const activeEnvironmentId =
            state.activeEnvironmentId === id
              ? (environments[0]?.id ?? null)
              : state.activeEnvironmentId;
          return { environments, activeEnvironmentId };
        }),

      setActiveEnvironment: (id) => set({ activeEnvironmentId: id }),

      getActiveEnvMap: () => {
        const { environments, activeEnvironmentId } = get();
        const env = environments.find((e) => e.id === activeEnvironmentId);
        return env ? env.variables : {};
      },

      addSecret: (name) => {
        const meta: SecretMeta = { id: uid(), name, createdAt: Date.now() };
        set((state) => ({ secrets: [...state.secrets, meta] }));
        return meta.id;
      },

      renameSecret: (id, name) =>
        set((state) => ({
          secrets: state.secrets.map((s) => (s.id === id ? { ...s, name } : s)),
        })),

      deleteSecret: (id) =>
        set((state) => ({
          secrets: state.secrets.filter((s) => s.id !== id),
        })),
    }),
    {
      name: "postman-store",
      version: 4,
      migrate: (persisted, version) => {
        const state = persisted as {
          collectionNodes?: CollectionNode[];
          history?: HistoryEntry[];
          secrets?: SecretMeta[];
        };
        if (version < 3) {
          const fix = (r?: RequestState) =>
            r ? { ...r, assertions: r.assertions ?? [] } : r;
          state.collectionNodes = (state.collectionNodes ?? []).map((n) =>
            n.request ? { ...n, request: fix(n.request) } : n,
          );
          state.history = (state.history ?? []).map((h) => ({
            ...h,
            request: fix(h.request)!,
          }));
        }
        if (version < 4) {
          state.secrets = state.secrets ?? [];
        }
        return state as never;
      },
      partialize: (state) => ({
        history: state.history,
        collectionNodes: state.collectionNodes,
        environments: state.environments,
        activeEnvironmentId: state.activeEnvironmentId,
        theme: state.theme,
        secrets: state.secrets,
      }),
    },
  ),
);

export function useActiveTab(): RequestTab | undefined {
  return useAppStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
}
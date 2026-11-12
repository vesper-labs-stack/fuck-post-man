import type { CollectionNode } from "../types";

export function childrenOf(
  nodes: CollectionNode[],
  parentId: string | null,
): CollectionNode[] {
  return nodes.filter((n) => n.parentId === parentId);
}

/** All descendant ids of a node (excluding the node itself). */
export function descendantIds(
  nodes: CollectionNode[],
  id: string,
): Set<string> {
  const out = new Set<string>();
  const walk = (parent: string) => {
    for (const child of nodes.filter((n) => n.parentId === parent)) {
      out.add(child.id);
      walk(child.id);
    }
  };
  walk(id);
  return out;
}

export function isDescendant(
  nodes: CollectionNode[],
  ancestorId: string,
  id: string,
): boolean {
  let cur = nodes.find((n) => n.id === id);
  while (cur && cur.parentId) {
    if (cur.parentId === ancestorId) return true;
    cur = nodes.find((n) => n.id === cur!.parentId);
  }
  return false;
}

export function folderDepth(
  nodes: CollectionNode[],
  id: string | null,
): number {
  let depth = 0;
  let cur = nodes.find((n) => n.id === id);
  while (cur && cur.parentId) {
    depth += 1;
    cur = nodes.find((n) => n.id === cur!.parentId);
  }
  return depth;
}

/** Folders only, ordered depth-first, for pickers. */
export function folderList(
  nodes: CollectionNode[],
): { node: CollectionNode; depth: number }[] {
  const out: { node: CollectionNode; depth: number }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const child of childrenOf(nodes, parentId)) {
      if (child.type === "folder") {
        out.push({ node: child, depth });
        walk(child.id, depth + 1);
      }
    }
  };
  walk(null, 0);
  return out;
}
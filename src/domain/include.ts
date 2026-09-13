/** Safety stop, matching the Postgres include trigger. Not a product depth limit. */
export const INCLUDE_DEPTH_LIMIT = 16;

export type IncludeEdge = {
  processId: string;
  childProcessId: string;
};

type IncludeChild = {
  ownerId: string;
  deletedAt: string | null;
};

/**
 * Client-side check before writing `child_process_id`.
 * Matches the SQL trigger: self-include, missing or deleted child, other owner, cycle, depth.
 */
export function liveIncludeError(input: {
  parentId: string;
  childId: string;
  parentOwnerId: string;
  child: IncludeChild | null;
  edges: readonly IncludeEdge[];
}): string | null {
  if (input.childId === input.parentId) {
    return 'A process cannot include itself.';
  }
  if (!input.child) {
    return 'That process is not available to include.';
  }
  if (input.child.deletedAt) {
    return 'A deleted process cannot be included.';
  }
  if (input.child.ownerId !== input.parentOwnerId) {
    return 'You can only include a process you own.';
  }

  const childrenOf = new Map<string, string[]>();
  for (const edge of input.edges) {
    const list = childrenOf.get(edge.processId) ?? [];
    list.push(edge.childProcessId);
    childrenOf.set(edge.processId, list);
  }

  const queue = (childrenOf.get(input.childId) ?? []).map((id) => ({ id, depth: 1 }));
  const seen = new Set<string>();
  let cycle = false;
  let tooDeep = false;

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (current.id === input.parentId) cycle = true;
    if (current.depth >= INCLUDE_DEPTH_LIMIT) {
      tooDeep = true;
      continue;
    }
    if (seen.has(current.id)) continue;
    seen.add(current.id);
    for (const next of childrenOf.get(current.id) ?? []) {
      queue.push({ id: next, depth: current.depth + 1 });
    }
  }

  if (cycle) return 'That include would loop back on itself.';
  if (tooDeep) return 'Includes cannot nest that deep.';
  return null;
}

export function assertLiveInclude(input: Parameters<typeof liveIncludeError>[0]): void {
  const error = liveIncludeError(input);
  if (error) throw new Error(error);
}

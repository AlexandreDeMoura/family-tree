import type { ParentChild } from './schemas.js';

function childIndex(edges: readonly ParentChild[]) {
  const children = new Map<string, string[]>();
  for (const { parentId, childId } of edges) {
    const list = children.get(parentId) ?? [];
    list.push(childId);
    children.set(parentId, list);
  }
  return children;
}

/** Adding parent -> child cycles exactly when child already reaches parent. */
export function wouldCreateAncestryCycle(
  edges: readonly ParentChild[], parentId: string, childId: string,
): boolean {
  const children = childIndex(edges);
  const pending = [childId];
  const visited = new Set<string>();
  while (pending.length) {
    const id = pending.pop()!;
    if (id === parentId) return true;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const child of children.get(id) ?? []) pending.push(child);
  }
  return false;
}

/** Iterative DFS avoids call-stack limits on deep trees, in O(people + edges). */
export function findAncestryCycle(edges: readonly ParentChild[]): string[] | null {
  const children = childIndex(edges);
  const finished = new Set<string>();
  const active = new Map<string, number>();

  for (const root of children.keys()) {
    if (finished.has(root)) continue;
    const stack = [{ id: root, next: 0 }];
    active.set(root, 0);
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const descendants = children.get(frame.id) ?? [];
      if (frame.next === descendants.length) {
        finished.add(frame.id);
        active.delete(frame.id);
        stack.pop();
        continue;
      }
      const child = descendants[frame.next++];
      const cycleStart = active.get(child);
      if (cycleStart !== undefined) {
        return [...stack.slice(cycleStart).map(({ id }) => id), child];
      }
      if (!finished.has(child)) {
        active.set(child, stack.length);
        stack.push({ id: child, next: 0 });
      }
    }
  }
  return null;
}

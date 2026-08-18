import { FormulaPoint } from '../types-formula';
import { parseFormula, extractDependencies } from './formulaParser';

export interface TopoSortResult {
  order: string[] | null; // null if cycle detected
  cycleNodes?: string[]; // nodes involved in the loop
}

export function topologicalSort(points: FormulaPoint[]): TopoSortResult {
  const allNodeNames = new Set(points.map(p => p.name));
  const adj = new Map<string, string[]>();

  for (const p of points) {
    try {
      const node = parseFormula(p.formula);
      const pointDeps = extractDependencies(node).filter(dep => allNodeNames.has(dep));
      adj.set(p.name, pointDeps);
    } catch {
      adj.set(p.name, []);
    }
  }

  const visited = new Map<string, number>(); // 0 = unvisited, 1 = visiting, 2 = visited
  const order: string[] = [];
  let hasCycle = false;
  const cycleNodes: string[] = [];

  function dfs(u: string): boolean {
    visited.set(u, 1); // visiting
    const neighbors = adj.get(u) || [];
    for (const v of neighbors) {
      const state = visited.get(v) || 0;
      if (state === 1) {
        hasCycle = true;
        cycleNodes.push(u);
        return false;
      } else if (state === 0) {
        if (!dfs(v)) return false;
      }
    }
    visited.set(u, 2); // visited
    order.push(u);
    return true;
  }

  for (const p of points) {
    if ((visited.get(p.name) || 0) === 0) {
      if (!dfs(p.name)) {
        return { order: null, cycleNodes: Array.from(new Set(cycleNodes)) };
      }
    }
  }

  return { order, cycleNodes: [] };
}

import { FormulaPoint, FormulaVariable, FormulaEvalResult, EvaluatedPoint, FormulaEvalError } from '../types-formula';
import { parseFormula, evaluateNode, extractDependencies } from './formulaParser';
import { topologicalSort } from './formulaGraph';

export function evaluateAllFormulas(
  points: FormulaPoint[],
  variables: FormulaVariable[]
): FormulaEvalResult {
  const errors: FormulaEvalError[] = [];
  const computedPoints = new Map<string, EvaluatedPoint>();
  
  const varMap = new Map<string, number>();
  for (const v of variables) {
    varMap.set(v.name, v.value);
  }

  const allNodeNames = new Set(points.map(p => p.name));
  const pointMap = new Map<string, FormulaPoint>();
  for (const p of points) {
    pointMap.set(p.name, p);
  }

  const topo = topologicalSort(points);

  if (topo.order === null) {
    const cycleNodes = topo.cycleNodes || [];
    const cycleSet = new Set(cycleNodes);
    
    for (const p of points) {
      if (cycleSet.has(p.name)) {
        errors.push({
          pointName: p.name,
          message: 'Lỗi vòng lặp phụ thuộc (dependency cycle detected)',
        });
      } else {
        errors.push({
          pointName: p.name,
          message: 'Không thể tính toán do hệ thống có vòng lặp phụ thuộc',
        });
      }
    }

    return {
      points: computedPoints,
      errors,
      evaluationOrder: [],
    };
  }

  const failedPoints = new Set<string>();

  for (const name of topo.order) {
    const p = pointMap.get(name);
    if (!p) continue;

    let parsed;
    try {
      parsed = parseFormula(p.formula);
    } catch (e: any) {
      failedPoints.add(name);
      errors.push({
        pointName: name,
        message: `Lỗi cú pháp: ${e.message}`,
      });
      continue;
    }

    const deps = extractDependencies(parsed);
    const missingDeps = deps.filter(d => !allNodeNames.has(d));
    const failedDeps = deps.filter(d => failedPoints.has(d));

    if (missingDeps.length > 0) {
      failedPoints.add(name);
      errors.push({
        pointName: name,
        message: `Điểm tham chiếu không tồn tại: ${missingDeps.join(', ')}`,
      });
      continue;
    }

    if (failedDeps.length > 0) {
      failedPoints.add(name);
      errors.push({
        pointName: name,
        message: `Phụ thuộc vào điểm bị lỗi: ${failedDeps.join(', ')}`,
      });
      continue;
    }

    try {
      const coord = evaluateNode(parsed, computedPoints, varMap);
      computedPoints.set(name, {
        name,
        x: coord.x,
        y: coord.y,
      });
    } catch (e: any) {
      failedPoints.add(name);
      errors.push({
        pointName: name,
        message: `Lỗi tính toán: ${e.message}`,
      });
    }
  }

  return {
    points: computedPoints,
    errors,
    evaluationOrder: topo.order,
  };
}

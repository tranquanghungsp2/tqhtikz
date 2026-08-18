export type FormulaPointType = 'formula';

export interface FormulaPoint {
  id: string;
  name: string; // Display name, e.g., "O", "A", "H" — MUST be unique
  formula: string; // Raw formula, e.g., "(0,0)", "(108:\r)", "($(A)!(B)!(C)$)", "(intersection of A--D and C--F)"
  labelAngleDeg?: number; // Offset angle for labels, default 0 (right)
  groupId: string; // Which path group it belongs to
}

export interface FormulaVariable {
  name: string; // e.g. "r"
  value: number;
  min?: number;
  max?: number;
}

export interface FormulaPathGroup {
  id: string;
  name: string;
  order: number;
}

export interface EvaluatedPoint {
  name: string;
  x: number;
  y: number;
}

export interface FormulaEvalError {
  pointName: string;
  message: string;
}

export interface FormulaEvalResult {
  points: Map<string, EvaluatedPoint>; // Calculated coordinates
  errors: FormulaEvalError[]; // Evaluation/dependency/parsing errors
  evaluationOrder: string[]; // Topological order used
}

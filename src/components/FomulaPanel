import React from 'react';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { FormulaPoint, FormulaVariable, FormulaPathGroup, FormulaEvalResult } from '../types-formula';

interface FormulaPanelProps {
  points: FormulaPoint[];
  onUpdatePoints: (points: FormulaPoint[]) => void;
  variables: FormulaVariable[];
  onUpdateVariables: (vars: FormulaVariable[]) => void;
  groups: FormulaPathGroup[];
  onUpdateGroups: (groups: FormulaPathGroup[]) => void;
  evalResult: FormulaEvalResult;
}

export const FormulaPanel: React.FC<FormulaPanelProps> = ({
  points,
  onUpdatePoints,
  variables,
  onUpdateVariables,
  groups,
  evalResult,
}) => {
  const errorMap = new Map(evalResult.errors.map((e) => [e.pointName, e.message]));

  const updatePoint = (id: string, patch: Partial<FormulaPoint>) => {
    onUpdatePoints(points.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const deletePoint = (id: string) => {
    onUpdatePoints(points.filter((p) => p.id !== id));
  };

  const addPoint = (groupId: string) => {
    const usedNames = new Set(points.map((p) => p.name));
    let n = 1;
    let name = 'P1';
    while (usedNames.has(name)) {
      n++;
      name = `P${n}`;
    }
    onUpdatePoints([
      ...points,
      { id: `fp_${Date.now()}`, name, formula: '(0,0)', groupId },
    ]);
  };

  const updateVariable = (name: string, patch: Partial<FormulaVariable>) => {
    onUpdateVariables(variables.map((v) => (v.name === name ? { ...v, ...patch } : v)));
  };

  const addVariable = () => {
    const usedNames = new Set(variables.map((v) => v.name));
    let n = 1;
    let name = 'k1';
    while (usedNames.has(name)) {
      n++;
      name = `k${n}`;
    }
    onUpdateVariables([...variables, { name, value: 1, min: 0, max: 10 }]);
  };

  return (
    <aside className="w-[420px] flex-none bg-white border-r border-[#dbe4ee] flex flex-col overflow-hidden">
      {/* Variables section */}
      <div className="border-b border-[#dbe4ee] p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold text-[#5b6b82] uppercase tracking-widest">Biến số</p>
          <button onClick={addVariable} className="text-[11px] text-[#2f5d99] hover:underline flex items-center gap-0.5">
            <Plus className="w-3 h-3" /> Thêm biến
          </button>
        </div>
        {variables.map((v) => (
          <div key={v.name} className="flex items-center gap-2">
            <span className="text-xs font-mono-code text-[#16233a] w-8">\{v.name}</span>
            <input
              type="range"
              min={v.min ?? 0}
              max={v.max ?? 10}
              step={0.1}
              value={v.value}
              onChange={(e) => updateVariable(v.name, { value: Number(e.target.value) })}
              className="flex-1 h-1.5 bg-[#dbe4ee] rounded-lg appearance-none cursor-pointer accent-[#2f5d99]"
            />
            <input
              type="number"
              value={v.value}
              onChange={(e) => updateVariable(v.name, { value: Number(e.target.value) })}
              className="w-16 text-xs border border-[#dbe4ee] rounded px-1.5 py-0.5"
            />
          </div>
        ))}
      </div>

      {/* Points list, grouped */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {groups
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((group) => (
            <div key={group.id}>
              <p className="text-[10px] font-semibold text-[#5b6b82] uppercase tracking-widest mb-1.5">
                {group.name}
              </p>
              <div className="space-y-1.5">
                {points
                  .filter((p) => p.groupId === group.id)
                  .map((p) => {
                    const err = errorMap.get(p.name);
                    return (
                      <div key={p.id}>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={p.name}
                            onChange={(e) => updatePoint(p.id, { name: e.target.value })}
                            className="w-14 text-xs font-mono-code font-semibold text-center border border-[#dbe4ee] rounded px-1 py-1"
                            placeholder="Tên"
                          />
                          <input
                            type="text"
                            value={p.formula}
                            onChange={(e) => updatePoint(p.id, { formula: e.target.value })}
                            className={`flex-1 text-xs font-mono-code border rounded px-2 py-1 ${
                              err ? 'border-[#b91c1c] bg-[#fef2f2]' : 'border-[#dbe4ee]'
                            }`}
                            placeholder="Công thức, vd: (108:\\r) hoặc ($(A)!0.5!(B)$)"
                          />
                          <input
                            type="number"
                            value={p.labelAngleDeg ?? 0}
                            onChange={(e) => updatePoint(p.id, { labelAngleDeg: Number(e.target.value) })}
                            title="Góc nhãn (độ)"
                            className="w-12 text-[11px] border border-[#dbe4ee] rounded px-1 py-1"
                          />
                          <button
                            onClick={() => deletePoint(p.id)}
                            className="text-[#b91c1c] hover:bg-[#fee2e2] p-1 rounded shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {err && (
                          <div className="flex items-start gap-1 mt-0.5 pl-1 text-[10.5px] text-[#b91c1c]">
                            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                            <span>{err}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                <button
                  onClick={() => addPoint(group.id)}
                  className="flex items-center gap-1 text-[11px] text-[#2f5d99] hover:underline"
                >
                  <Plus className="w-3 h-3" /> Thêm điểm
                </button>
              </div>
            </div>
          ))}
      </div>
    </aside>
  );
};

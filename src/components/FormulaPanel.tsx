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

  const [focusedPointId, setFocusedPointId] = React.useState<string | null>(null);
  const inputRefs = React.useRef<Map<string, HTMLInputElement>>(new Map());

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

  const insertTemplate = (template: string) => {
    if (!focusedPointId) return;
    const input = inputRefs.current.get(focusedPointId);
    const point = points.find((p) => p.id === focusedPointId);
    if (!input || !point) return;

    const start = input.selectionStart ?? point.formula.length;
    const end = input.selectionEnd ?? point.formula.length;
    const newFormula = point.formula.slice(0, start) + template + point.formula.slice(end);
    updatePoint(point.id, { formula: newFormula });

    requestAnimationFrame(() => {
      input.focus();
      const newPos = start + template.length;
      input.setSelectionRange(newPos, newPos);
    });
  };

  const FORMULA_TEMPLATES = [
    { label: '(x,y)', title: 'Toạ độ tự do', template: '(0,0)' },
    { label: '∠:r', title: 'Toạ độ cực (góc:bán kính)', template: '(90:5)' },
    { label: '2P−Q', title: 'Đối xứng tâm (P đối xứng qua Q)', template: '2*(A)-(B)' },
    { label: 'P!t!Q', title: 'Điểm chia đoạn theo tỉ lệ t (0..1) hoặc khoảng cách (vd 3cm)', template: '(A)!0.5!(B)' },
    { label: '⊥ chiếu', title: 'Chiếu vuông góc: chiếu B lên đường thẳng qua A và C', template: '(A)!(B)!(C)' },
    { label: '↻ quay', title: 'Quay quanh A theo hướng B, khoảng cách và góc quay', template: '(A)!3cm!60:(B)' },
    { label: '∩', title: 'Giao điểm 2 đường thẳng', template: 'intersection of A--B and C--D' },
  ];

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
        {variables.map((v, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <span className="text-xs font-mono-code text-[#5b6b82]">\</span>
            <input
              type="text"
              value={v.name}
              onChange={(e) => {
                const newName = e.target.value.replace(/[^a-zA-Z]/g, ''); // chỉ cho chữ cái, khớp cú pháp \tenBien của TikZ
                const isDuplicate = variables.some((other, i) => i !== idx && other.name === newName);
                if (isDuplicate) return; // bỏ qua nếu trùng tên với biến khác
                const next = [...variables];
                next[idx] = { ...next[idx], name: newName };
                onUpdateVariables(next);
              }}
              className="w-14 text-xs font-mono-code font-semibold border border-[#dbe4ee] rounded px-1 py-1"
              placeholder="tên"
              title="Đổi tên biến — LƯU Ý: không tự sửa các công thức đang dùng tên cũ, cần tự cập nhật tay"
            />
            <input
              type="range"
              min={v.min ?? 0}
              max={v.max ?? 10}
              step={0.1}
              value={v.value}
              onChange={(e) => {
                const next = [...variables];
                next[idx] = { ...next[idx], value: Number(e.target.value) };
                onUpdateVariables(next);
              }}
              className="flex-1 h-1.5 bg-[#dbe4ee] rounded-lg appearance-none cursor-pointer accent-[#2f5d99]"
            />
            <input
              type="number"
              value={v.value}
              onChange={(e) => {
                const next = [...variables];
                next[idx] = { ...next[idx], value: Number(e.target.value) };
                onUpdateVariables(next);
              }}
              className="w-16 text-xs border border-[#dbe4ee] rounded px-1.5 py-0.5"
            />
            <button
              onClick={() => onUpdateVariables(variables.filter((_, i) => i !== idx))}
              className="text-[#b91c1c] hover:bg-[#fee2e2] p-1 rounded shrink-0"
              title="Xoá biến"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Quick insert templates */}
      <div className="border-b border-[#dbe4ee] p-3 space-y-1.5">
        <p className="text-[10px] font-semibold text-[#5b6b82] uppercase tracking-widest">
          Chèn nhanh công thức
        </p>
        <div className="flex flex-wrap gap-1">
          {FORMULA_TEMPLATES.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => insertTemplate(t.template)}
              title={`${t.title}\nMẫu: ${t.template}`}
              disabled={!focusedPointId}
              className="text-[11px] font-mono-code px-2 py-1 rounded border border-[#dbe4ee] bg-white hover:bg-[#e4ecf7] hover:border-[#2f5d99] hover:text-[#2f5d99] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {t.label}
            </button>
          ))}
        </div>
        {!focusedPointId && (
          <p className="text-[10px] text-[#94a3b8] italic">Bấm vào 1 ô công thức bên dưới trước, rồi bấm nút để chèn.</p>
        )}
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
                            ref={(el) => {
                              if (el) inputRefs.current.set(p.id, el);
                              else inputRefs.current.delete(p.id);
                            }}
                            value={p.formula}
                            onChange={(e) => updatePoint(p.id, { formula: e.target.value })}
                            onFocus={() => setFocusedPointId(p.id)}
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

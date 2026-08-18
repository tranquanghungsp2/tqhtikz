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
  focusedPointId: string | null;
  onFocusPoint: (id: string | null) => void;
  pickingTemplateKind: 'reflect' | 'ratio' | 'projection' | 'rotate' | 'intersection' | null;
  onSetPickingTemplateKind: (kind: 'reflect' | 'ratio' | 'projection' | 'rotate' | 'intersection' | null) => void;
  pickedPointNames: string[];
}

export const FormulaPanel: React.FC<FormulaPanelProps> = ({
  points,
  onUpdatePoints,
  variables,
  onUpdateVariables,
  groups,
  evalResult,
  focusedPointId,
  onFocusPoint,
  pickingTemplateKind,
  onSetPickingTemplateKind,
  pickedPointNames,
}) => {
  const errorMap = new Map(evalResult.errors.map((e) => [e.pointName, e.message]));

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

  const SIMPLE_TEMPLATE_DEFS = {
    freeCoord: {
      label: '(x,y)',
      title: 'Toạ độ tự do',
      fields: [
        { key: 'x', label: 'x', placeholder: '0' },
        { key: 'y', label: 'y', placeholder: '0' },
      ],
    },
    polar: {
      label: '∠:r',
      title: 'Toạ độ cực (góc:bán kính), tính từ gốc (0,0)',
      fields: [
        { key: 'angle', label: 'Góc (độ)', placeholder: '90' },
        { key: 'radius', label: 'Bán kính', placeholder: '\\r' },
      ],
    },
  };

  const buildSimpleFormula = (kind: 'freeCoord' | 'polar', f: Record<string, string>): string => {
    if (kind === 'freeCoord') return `(${f.x || '0'},${f.y || '0'})`;
    return `(${f.angle || '0'}:${f.radius || '1'})`;
  };

  const [activeSimpleKind, setActiveSimpleKind] = React.useState<'freeCoord' | 'polar' | null>(null);
  const [simpleFields, setSimpleFields] = React.useState<Record<string, string>>({});

  const insertSimpleFormula = () => {
    if (!activeSimpleKind || !focusedPointId) return;
    const template = buildSimpleFormula(activeSimpleKind, simpleFields);
    const input = inputRefs.current.get(focusedPointId);
    const point = points.find((p) => p.id === focusedPointId);
    if (!input || !point) return;
    const start = input.selectionStart ?? point.formula.length;
    const end = input.selectionEnd ?? point.formula.length;
    const newFormula = point.formula.slice(0, start) + template + point.formula.slice(end);
    updatePoint(point.id, { formula: newFormula });
    setActiveSimpleKind(null);
    setSimpleFields({});
    requestAnimationFrame(() => {
      input.focus();
      const newPos = start + template.length;
      input.setSelectionRange(newPos, newPos);
    });
  };

  const POINT_BASED_TEMPLATES: Array<{
    kind: 'reflect' | 'ratio' | 'projection' | 'rotate' | 'intersection';
    label: string;
    title: string;
    pointsNeeded: number;
    pointLabels: string[];
    numericFields: Array<{ key: string; label: string; placeholder: string }>;
  }> = [
    {
      kind: 'reflect',
      label: '2P−Q',
      title: 'Đối xứng tâm — bấm Điểm nguồn rồi Tâm đối xứng',
      pointsNeeded: 2,
      pointLabels: ['Điểm nguồn', 'Tâm đối xứng'],
      numericFields: [],
    },
    {
      kind: 'ratio',
      label: 'P!t!Q',
      title: 'Chia đoạn theo tỉ lệ — bấm điểm P rồi điểm Q, sau đó nhập tỉ lệ',
      pointsNeeded: 2,
      pointLabels: ['Điểm P (đầu)', 'Điểm Q (cuối)'],
      numericFields: [{ key: 't', label: 'Tỉ lệ / khoảng cách', placeholder: '0.5' }],
    },
    {
      kind: 'projection',
      label: '⊥ chiếu',
      title: 'Chiếu vuông góc — bấm 2 điểm trên đường thẳng, rồi điểm cần chiếu',
      pointsNeeded: 3,
      pointLabels: ['Trên đường (1)', 'Điểm cần chiếu', 'Trên đường (2)'],
      numericFields: [],
    },
    {
      kind: 'rotate',
      label: '↻ quay',
      title: 'Quay — bấm điểm Gốc rồi điểm Hướng, sau đó nhập khoảng cách và góc',
      pointsNeeded: 2,
      pointLabels: ['Gốc', 'Hướng tới'],
      numericFields: [
        { key: 'dist', label: 'Khoảng cách / tỉ lệ', placeholder: '3cm' },
        { key: 'angle', label: 'Góc quay (độ)', placeholder: '60' },
      ],
    },
    {
      kind: 'intersection',
      label: '∩',
      title: 'Giao điểm 2 đường — bấm lần lượt 4 điểm: 2 điểm đường 1, 2 điểm đường 2',
      pointsNeeded: 4,
      pointLabels: ['Đường 1 - A', 'Đường 1 - B', 'Đường 2 - C', 'Đường 2 - D'],
      numericFields: [],
    },
  ];

  const activePointTemplate = POINT_BASED_TEMPLATES.find((t) => t.kind === pickingTemplateKind) || null;

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
      <div className="border-b border-[#dbe4ee] p-3 space-y-2">
        <p className="text-[10px] font-semibold text-[#5b6b82] uppercase tracking-widest">
          Chèn nhanh công thức
        </p>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(SIMPLE_TEMPLATE_DEFS) as Array<'freeCoord' | 'polar'>).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => {
                setActiveSimpleKind(activeSimpleKind === kind ? null : kind);
                setSimpleFields({});
              }}
              title={SIMPLE_TEMPLATE_DEFS[kind].title}
              disabled={!focusedPointId}
              className={`text-[11px] font-mono-code px-2 py-1 rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                activeSimpleKind === kind
                  ? 'bg-[#2f5d99] border-[#2f5d99] text-white'
                  : 'bg-white border-[#dbe4ee] hover:bg-[#e4ecf7] hover:border-[#2f5d99] hover:text-[#2f5d99]'
              }`}
            >
              {SIMPLE_TEMPLATE_DEFS[kind].label}
            </button>
          ))}
          {POINT_BASED_TEMPLATES.map((t) => (
            <button
              key={t.kind}
              type="button"
              onClick={() => onSetPickingTemplateKind(pickingTemplateKind === t.kind ? null : t.kind)}
              title={t.title}
              disabled={!focusedPointId}
              className={`text-[11px] font-mono-code px-2 py-1 rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                pickingTemplateKind === t.kind
                  ? 'bg-[#059669] border-[#059669] text-white'
                  : 'bg-white border-[#dbe4ee] hover:bg-[#e4ecf7] hover:border-[#2f5d99] hover:text-[#2f5d99]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {!focusedPointId && (
          <p className="text-[10px] text-[#94a3b8] italic">Bấm vào 1 ô công thức bên dưới trước, rồi chọn loại công thức.</p>
        )}

        {activeSimpleKind && focusedPointId && (
          <div className="bg-[#f8fafc] border border-[#dbe4ee] rounded-md p-2.5 space-y-2">
            {SIMPLE_TEMPLATE_DEFS[activeSimpleKind].fields.map((field) => (
              <div key={field.key} className="flex items-center gap-2">
                <label className="text-[11px] text-[#5b6b82] w-20 shrink-0">{field.label}</label>
                <input
                  type="text"
                  value={simpleFields[field.key] || ''}
                  onChange={(e) => setSimpleFields((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="flex-1 text-xs font-mono-code border border-[#dbe4ee] rounded px-1.5 py-1"
                />
              </div>
            ))}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10.5px] font-mono-code text-[#5b6b82]">
                {buildSimpleFormula(activeSimpleKind, simpleFields)}
              </span>
              <button
                onClick={insertSimpleFormula}
                className="text-[11px] font-semibold text-white bg-[#2f5d99] hover:bg-[#254a7a] px-3 py-1 rounded"
              >
                Chèn
              </button>
            </div>
          </div>
        )}

        {activePointTemplate && (
          <div className="bg-[#ecfdf5] border border-[#059669]/40 rounded-md p-2.5 text-[11px] text-[#065f46] space-y-1">
            <p className="font-semibold">{activePointTemplate.title}</p>
            <p>
              Đã chọn {pickedPointNames.length}/{activePointTemplate.pointsNeeded} điểm trên canvas:{' '}
              {pickedPointNames.length > 0 ? pickedPointNames.join(' → ') : '(chưa chọn)'}
            </p>
            <p className="italic text-[#059669]">
              Tiếp theo bấm điểm: {activePointTemplate.pointLabels[pickedPointNames.length] ?? '—'}
            </p>
            <button
              onClick={() => onSetPickingTemplateKind(null)}
              className="text-[10.5px] text-[#5b6b82] hover:underline"
            >
              Huỷ chọn
            </button>
          </div>
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
                            onFocus={() => onFocusPoint(p.id)}
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

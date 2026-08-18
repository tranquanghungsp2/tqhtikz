import React from 'react';
import { FormulaPoint, FormulaEvalResult } from '../types-formula';

interface FormulaCanvasProps {
  points: FormulaPoint[];
  evalResult: FormulaEvalResult;
  pickingTemplateKind: 'reflect' | 'ratio' | 'projection' | 'rotate' | 'intersection' | null;
  pickedPointNames: string[];
  onPickPoint: (name: string) => void;
  onCancelPicking: () => void;
  onFinishPicking: (formula: string) => void;
}

const SCALE = 40; // px per cm, giống canvas chính

const POINTS_NEEDED: Record<string, number> = {
  reflect: 2,
  ratio: 2,
  projection: 3,
  rotate: 2,
  intersection: 4,
};

export const FormulaCanvas: React.FC<FormulaCanvasProps> = ({
  points,
  evalResult,
  pickingTemplateKind,
  pickedPointNames,
  onPickPoint,
  onCancelPicking,
  onFinishPicking,
}) => {
  const width = 900;
  const height = 700;
  const cx = width / 2;
  const cy = height / 2;

  const [pendingNumericFields, setPendingNumericFields] = React.useState<Record<string, string>>({});

  const toScreen = (x: number, y: number) => ({ x: cx + x * SCALE, y: cy - y * SCALE });

  const buildFinalFormula = (kind: string, picked: string[], numeric: Record<string, string>): string => {
    switch (kind) {
      case 'reflect':
        return `2*(${picked[1]})-(${picked[0]})`;
      case 'ratio':
        return `(${picked[0]})!${numeric.t || '0.5'}!(${picked[1]})`;
      case 'projection':
        return `(${picked[0]})!(${picked[1]})!(${picked[2]})`;
      case 'rotate':
        return `(${picked[0]})!${numeric.dist || '1'}!${numeric.angle || '0'}:(${picked[1]})`;
      case 'intersection':
        return `intersection of ${picked[0]}--${picked[1]} and ${picked[2]}--${picked[3]}`;
      default:
        return '';
    }
  };

  return (
    <div className="flex-1 bg-[#eef2f6] overflow-auto relative">
      <svg width={width} height={height}>
        <defs>
          <pattern id="formula-grid" width={SCALE} height={SCALE} patternUnits="userSpaceOnUse">
            <path d={`M ${SCALE} 0 L 0 0 0 ${SCALE}`} fill="none" stroke="#dbe4ee" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={width} height={height} fill="url(#formula-grid)" />
        <line x1={0} y1={cy} x2={width} y2={cy} stroke="#5b6b82" strokeWidth={1.2} />
        <line x1={cx} y1={0} x2={cx} y2={height} stroke="#5b6b82" strokeWidth={1.2} />

        {points.map((p) => {
          const pt = evalResult.points.get(p.name);
          if (!pt) return null;
          const s = toScreen(pt.x, pt.y);
          const angle = ((p.labelAngleDeg ?? 0) * Math.PI) / 180;
          const labelX = s.x + Math.cos(angle) * 14;
          const labelY = s.y - Math.sin(angle) * 14;
          return (
            <g key={p.id}>
              <circle
                cx={s.x}
                cy={s.y}
                r={pickingTemplateKind ? 8 : 3.5}
                fill={pickedPointNames.includes(p.name) ? '#059669' : '#16233a'}
                className={pickingTemplateKind ? 'cursor-pointer' : ''}
                onClick={() => {
                  if (!pickingTemplateKind) return;
                  const needed = POINTS_NEEDED[pickingTemplateKind];
                  if (pickedPointNames.length >= needed) return;
                  if (pickedPointNames.includes(p.name)) return; // không cho chọn trùng 1 điểm 2 lần
                  onPickPoint(p.name);
                }}
              />
              {pickedPointNames.includes(p.name) && (
                <text x={s.x} y={s.y - 14} textAnchor="middle" className="text-[10px] font-bold fill-[#059669]">
                  {pickedPointNames.indexOf(p.name) + 1}
                </text>
              )}
              <text
                x={labelX}
                y={labelY}
                textAnchor="middle"
                className="font-math text-[14px] fill-[#16233a]"
              >
                {p.name}
              </text>
            </g>
          );
        })}
      </svg>

      {evalResult.errors.length > 0 && (
        <div className="fixed bottom-4 left-[440px] bg-[#fef2f2] border border-[#b91c1c]/40 rounded-md px-3 py-2 text-[11px] text-[#b91c1c] max-w-md">
          {evalResult.errors.length} điểm đang lỗi — xem chi tiết ngay tại từng dòng công thức bên trái.
        </div>
      )}

      {pickingTemplateKind &&
        pickedPointNames.length === POINTS_NEEDED[pickingTemplateKind] &&
        (() => {
          const numericFieldsMap: Record<string, Array<{ key: string; label: string; placeholder: string }>> = {
            reflect: [],
            ratio: [{ key: 't', label: 'Tỉ lệ / khoảng cách', placeholder: '0.5' }],
            projection: [],
            rotate: [
              { key: 'dist', label: 'Khoảng cách / tỉ lệ', placeholder: '3cm' },
              { key: 'angle', label: 'Góc quay (độ)', placeholder: '60' },
            ],
            intersection: [],
          };
          const fields = numericFieldsMap[pickingTemplateKind];
          const finalFormula = buildFinalFormula(pickingTemplateKind, pickedPointNames, pendingNumericFields);
          return (
            <div className="fixed top-20 right-8 bg-white border border-[#059669] rounded-lg shadow-lg p-3 z-50 w-64 space-y-2 animate-in fade-in zoom-in-95 duration-150">
              <p className="text-[11px] font-semibold text-[#065f46]">Đã chọn đủ điểm — hoàn tất công thức</p>
              {fields.map((f) => (
                <div key={f.key} className="flex items-center gap-2">
                  <label className="text-[11px] text-[#5b6b82] w-24 shrink-0">{f.label}</label>
                  <input
                    type="text"
                    value={pendingNumericFields[f.key] || ''}
                    onChange={(e) => setPendingNumericFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="flex-1 text-xs font-mono-code border border-[#dbe4ee] rounded px-1.5 py-1"
                  />
                </div>
              ))}
              <p className="text-[10.5px] font-mono-code text-[#5b6b82] break-all bg-slate-50 p-1.5 rounded">{finalFormula}</p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => {
                    onFinishPicking(finalFormula);
                    setPendingNumericFields({});
                  }}
                  className="flex-1 text-[11px] font-semibold text-white bg-[#059669] hover:bg-[#047857] px-2 py-1.5 rounded shadow-sm transition-colors"
                >
                  Xong
                </button>
                <button
                  onClick={() => {
                    onCancelPicking();
                    setPendingNumericFields({});
                  }}
                  className="text-[11px] text-[#5b6b82] hover:text-[#16233a] px-2 py-1.5 transition-colors"
                >
                  Huỷ
                </button>
              </div>
            </div>
          );
        })()}
    </div>
  );
};

import React from 'react';
import { FormulaPoint, FormulaEvalResult } from '../types-formula';

interface FormulaCanvasProps {
  points: FormulaPoint[];
  evalResult: FormulaEvalResult;
}

const SCALE = 40; // px per cm, giống canvas chính

export const FormulaCanvas: React.FC<FormulaCanvasProps> = ({ points, evalResult }) => {
  const width = 900;
  const height = 700;
  const cx = width / 2;
  const cy = height / 2;

  const toScreen = (x: number, y: number) => ({ x: cx + x * SCALE, y: cy - y * SCALE });

  return (
    <div className="flex-1 bg-[#eef2f6] overflow-auto">
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
              <circle cx={s.x} cy={s.y} r={3.5} fill="#16233a" />
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
    </div>
  );
};

import React, { useState } from 'react';
import {
  Code2,
  Sliders,
  Copy,
  Check,
  Download,
  Trash2,
  FileCode,
  Image as ImageIcon,
  Layers,
  MapPin,
  CircleDot,
  X,
} from 'lucide-react';
import {
  GeoPoint,
  GeoShape,
  LabelPosition,
  PointStyle,
  DashPattern,
  TikZExportOptions,
  PathAnnotation,
} from '../types';
import { generateTikZCodeWithLineMap, getMathLabel } from '../utils/tikzExport';
import { formatCm } from '../utils/geometry';

interface RightSidebarProps {
  selectedPoint: GeoPoint | null;
  selectedShape: GeoShape | null;
  selectedPathAnnotation: PathAnnotation | null;
  pathAnnotations: PathAnnotation[];
  points: GeoPoint[];
  shapes: GeoShape[];
  onUpdatePoint: (pointId: string, updates: Partial<GeoPoint>) => void;
  onUpdateShape: (shapeId: string, updates: Partial<GeoShape>) => void;
  onUpdatePathAnnotation: (id: string, updates: Partial<PathAnnotation>) => void;
  onDeletePoint: (pointId: string) => void;
  onDeleteShape: (shapeId: string) => void;
  onDeletePathAnnotation: (id: string) => void;
  onUnmergeShape?: (shapeId: string) => void;
  onDeselect: () => void;
  onSelectPathAnnotation?: (id: string | null) => void;
  tikzOptions: TikZExportOptions;
  onUpdateTikzOptions: (opts: Partial<TikZExportOptions>) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
}

const PRESET_COLORS = [
  { label: 'Mặc định (Đen mực)', value: '#16233a' },
  { label: 'Đỏ', value: '#b91c1c' },
  { label: 'Xanh dương', value: '#2f5d99' },
  { label: 'Xanh lá / Ngọc', value: '#059669' },
  { label: 'Cam', value: '#b45309' },
  { label: 'Tím', value: '#7c3aed' },
  { label: 'Hồng', value: '#db2777' },
  { label: 'Xám', value: '#475569' },
];

const STROKE_WIDTHS = [
  { label: '0.5 pt', value: 0.5, desc: 'Mảnh' },
  { label: '1.0 pt', value: 1.0, desc: 'Chuẩn' },
  { label: '1.5 pt', value: 1.5, desc: 'Đậm vừa' },
  { label: '2.0 pt', value: 2.0, desc: 'Đậm' },
  { label: '3.0 pt', value: 3.0, desc: 'Rất đậm' },
];

const DASH_PATTERNS: Array<{ id: DashPattern; label: string }> = [
  { id: 'solid', label: 'Nét liền' },
  { id: 'dashed', label: 'Nét đứt' },
  { id: 'dotted', label: 'Chấm chấm' },
  { id: 'dashdotted', label: 'Chấm gạch' },
];

const LABEL_POSITIONS: Array<{ id: LabelPosition; label: string }> = [
  { id: 'auto', label: 'Tự động' },
  { id: 'above', label: 'Trên' },
  { id: 'below', label: 'Dưới' },
  { id: 'left', label: 'Trái' },
  { id: 'right', label: 'Phải' },
  { id: 'above left', label: 'Trên - Trái' },
  { id: 'above right', label: 'Trên - Phải' },
  { id: 'below left', label: 'Dưới - Trái' },
  { id: 'below right', label: 'Dưới - Phải' },
];

export const RightSidebar: React.FC<RightSidebarProps> = ({
  selectedPoint,
  selectedShape,
  selectedPathAnnotation,
  pathAnnotations,
  points,
  shapes,
  onUpdatePoint,
  onUpdateShape,
  onUpdatePathAnnotation,
  onDeletePoint,
  onDeleteShape,
  onDeletePathAnnotation,
  onUnmergeShape,
  onDeselect,
  onSelectPathAnnotation,
  tikzOptions,
  onUpdateTikzOptions,
  svgRef,
}) => {
  const [activeTab, setActiveTab] = useState<'properties' | 'tikz'>('properties');
  const [copied, setCopied] = useState(false);
  const [copiedLineIdx, setCopiedLineIdx] = useState<number | null>(null);
  const [lastClickedLine, setLastClickedLine] = useState<number | null>(null);
  const [copiedRange, setCopiedRange] = useState<{ start: number; end: number } | null>(null);

  const { code: tikzCode, shapeToLines } = generateTikZCodeWithLineMap(points, shapes, { ...tikzOptions, pathAnnotations });
  const selectedShapeId = selectedShape?.id;
  const highlightedLines = React.useMemo(() => {
    return new Set<number>(selectedShapeId ? shapeToLines.get(selectedShapeId) || [] : []);
  }, [selectedShapeId, shapeToLines]);

  const tikzLineRefs = React.useRef<Map<number, HTMLDivElement>>(new Map());

  React.useEffect(() => {
    if (highlightedLines.size > 0) {
      const linesArr = Array.from(highlightedLines) as number[];
      const firstLine = Math.min(...linesArr);
      const el = tikzLineRefs.current.get(firstLine);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedShapeId]);

  const handleCopyLineOrBlock = async (idx: number, e: React.MouseEvent) => {
    const linesArray = tikzCode.split('\n');

    if (e.shiftKey && lastClickedLine !== null) {
      // Khi giữ Shift + Click: Copy toàn bộ khối từ lastClickedLine đến idx
      const start = Math.min(lastClickedLine, idx);
      const end = Math.max(lastClickedLine, idx);
      const blockText = linesArray.slice(start, end + 1).join('\n');

      await navigator.clipboard.writeText(blockText);
      setCopiedRange({ start, end });
      setCopiedLineIdx(null);
      setTimeout(() => setCopiedRange(null), 1500);
    } else {
      // Click bình thường: Copy 1 dòng và đặt làm mốc đầu khối
      await navigator.clipboard.writeText(linesArray[idx] || '');
      setLastClickedLine(idx);
      setCopiedLineIdx(idx);
      setCopiedRange(null);
      setTimeout(() => setCopiedLineIdx((cur) => (cur === idx ? null : cur)), 1200);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(tikzCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const handleDownloadTex = () => {
    const blob = new Blob([tikzCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hinh_hoc_tikz.tex';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadSvg = () => {
    if (!svgRef.current) return;
    const svgEl = svgRef.current;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgEl);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hinh_hoc.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <aside
      id="right-sidebar"
      className="w-[330px] min-w-[330px] h-full bg-[#ffffff] border-l border-[#dbe4ee] flex flex-col justify-between select-none shadow-[-1px_0_4px_rgba(22,35,58,0.03)] z-10"
    >
      {/* Header with Bento full-width Split Tabs */}
      <div className="flex border-b border-[#dbe4ee] bg-white">
        <button
          id="tab-properties-btn"
          onClick={() => setActiveTab('properties')}
          className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 ${
            activeTab === 'properties'
              ? 'text-[#2f5d99] border-[#2f5d99] bg-[#f8fafc]/50'
              : 'text-[#5b6b82] border-transparent hover:bg-[#f8fafc]'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>THUỘC TÍNH</span>
          {(selectedPoint || selectedShape || selectedPathAnnotation) && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#2f5d99]" />
          )}
        </button>

        <button
          id="tab-tikz-btn"
          onClick={() => setActiveTab('tikz')}
          className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 ${
            activeTab === 'tikz'
              ? 'text-[#2f5d99] border-[#2f5d99] bg-[#f8fafc]/50'
              : 'text-[#5b6b82] border-transparent hover:bg-[#f8fafc]'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>MÃ TIKZ</span>
          <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-[#e4ecf7] text-[#2f5d99]">
            {shapes.length}
          </span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'properties' ? (
          <div className="space-y-5">
            {/* When a Point is selected */}
            {selectedPoint ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#dbe4ee]">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded bg-[#e4ecf7] text-[#2f5d99] flex items-center justify-center">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#16233a]">
                        Điểm {selectedPoint.label}
                      </div>
                      <div className="text-[10px] font-mono text-[#5b6b82]">
                        ({selectedPoint.x.toFixed(2)}, {selectedPoint.y.toFixed(2)}) cm
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={onDeselect}
                    title="Bỏ chọn"
                    className="p-1 rounded hover:bg-[#f1f5f9] text-[#5b6b82]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Point Label Input */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold text-[#5b6b82] uppercase tracking-wider flex items-center justify-between">
                    <span>Tên nhãn điểm:</span>
                    <span className="font-math text-sm text-[#2f5d99]">
                      {getMathLabel(selectedPoint.label)}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={selectedPoint.label}
                    onChange={(e) =>
                      onUpdatePoint(selectedPoint.id, { label: e.target.value.trim() })
                    }
                    className="w-full px-3 py-1.5 bg-white border border-[#dbe4ee] rounded-md text-xs font-medium text-[#16233a] focus:outline-none focus:border-[#2f5d99]"
                    placeholder="A, B, C, O, A_1..."
                  />
                </div>

                {selectedPoint.derivedFrom?.type === 'intersection' && (
                  <div className="flex items-start gap-2 p-2.5 bg-[#fef3c7] border border-[#f59e0b]/40 rounded-md text-[11px] text-[#92400e] leading-relaxed">
                    <span>🔒</span>
                    <span>Điểm phụ thuộc — vị trí tự động tính từ giao điểm của 2 hình gốc, không kéo tay được. Kéo 1 trong 2 hình gốc để điểm này tự cập nhật theo.</span>
                  </div>
                )}

                {selectedPoint.derivedFrom?.type === 'pointOnLine' && (
                  <div className="flex items-start gap-2 p-2.5 bg-[#fef3c7] border border-[#f59e0b]/40 rounded-md text-[11px] text-[#92400e] leading-relaxed">
                    <span>🔗</span>
                    <span>Điểm trên đường — luôn ràng buộc nằm trên đường đã chọn. Kéo điểm này để trượt dọc theo đường, hoặc kéo đường để điểm tự cập nhật theo.</span>
                  </div>
                )}

                {selectedPoint.derivedFrom?.type === 'segmentDivision' && (
                  <div className="flex items-start gap-2 p-2.5 bg-[#f3e8ff] border border-[#7c3aed]/40 rounded-md text-[11px] text-[#6b21a8] leading-relaxed">
                    <span>📏</span>
                    <span>Điểm chia đoạn — vị trí luôn giữ đúng tỉ lệ giữa 2 điểm gốc, không kéo tay trực tiếp được. Kéo 1 trong 2 điểm gốc để điểm này tự cập nhật theo.</span>
                  </div>
                )}

                {selectedPoint.derivedFrom?.type === 'paramArcEnd' && (
                  <div className="flex items-start gap-2 p-2.5 bg-[#e0f2fe] border border-[#0284c7]/40 rounded-md text-[11px] text-[#075985] leading-relaxed">
                    <span>⌒</span>
                    <span>Điểm cuối của cung tròn — tự tính lại theo điểm đầu, góc và bán kính. Vẫn dùng được để nối sang hình khác bình thường.</span>
                  </div>
                )}

                {/* Coordinates (X, Y cm) */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#5b6b82] uppercase tracking-wider">
                    Toạ độ thực tế (cm):
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1.5 bg-[#f8fafc] border border-[#dbe4ee] px-2.5 py-1.5 rounded-md">
                      <span className="text-[10px] font-bold text-[#5b6b82]">X:</span>
                      <input
                        type="number"
                        step="0.01"
                        value={Math.round(selectedPoint.x * 100) / 100}
                        onChange={(e) =>
                          onUpdatePoint(selectedPoint.id, { x: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full bg-transparent text-xs font-mono-code text-[#16233a] focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 bg-[#f8fafc] border border-[#dbe4ee] px-2.5 py-1.5 rounded-md">
                      <span className="text-[10px] font-bold text-[#5b6b82]">Y:</span>
                      <input
                        type="number"
                        step="0.01"
                        value={Math.round(selectedPoint.y * 100) / 100}
                        onChange={(e) =>
                          onUpdatePoint(selectedPoint.id, { y: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full bg-transparent text-xs font-mono-code text-[#16233a] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Label Position */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#5b6b82] uppercase tracking-wider">
                    Vị trí đặt nhãn:
                  </label>
                  <select
                    value={selectedPoint.labelPos || 'auto'}
                    onChange={(e) =>
                      onUpdatePoint(selectedPoint.id, {
                        labelPos: e.target.value as LabelPosition,
                      })
                    }
                    className="w-full px-3 py-1.5 bg-white border border-[#dbe4ee] rounded-md text-xs text-[#16233a] focus:outline-none focus:border-[#2f5d99]"
                  >
                    {LABEL_POSITIONS.map((pos) => (
                      <option key={pos.id} value={pos.id}>
                        {pos.label}
                      </option>
                    ))}
                  </select>
                </div>



                {/* Point Style */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#5b6b82] uppercase tracking-wider">
                    Kiểu hiển thị điểm:
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { id: 'dot', label: '● Chấm đặc' },
                        { id: 'circle', label: '○ Vòng tròn' },
                        { id: 'cross', label: '✕ Dấu chéo' },
                        { id: 'hidden', label: 'Ẩn điểm' },
                      ] as Array<{ id: PointStyle; label: string }>
                    ).map((s) => (
                      <button
                        key={s.id}
                        onClick={() =>
                          onUpdatePoint(selectedPoint.id, {
                            style: { ...selectedPoint.style, pointStyle: s.id },
                          })
                        }
                        className={`py-1.5 px-2 text-xs rounded-md border text-left transition-colors ${
                          (selectedPoint.style?.pointStyle || 'dot') === s.id
                            ? 'bg-[#e4ecf7] border-[#2f5d99] text-[#2f5d99] font-semibold'
                            : 'bg-white border-[#dbe4ee] text-[#16233a] hover:bg-[#f8fafc]'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Delete Point Button */}
                <div className="pt-2">
                  <button
                    onClick={() => onDeletePoint(selectedPoint.id)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-[#fee2e2] hover:bg-[#fecaca] text-[#b91c1c] text-xs font-semibold rounded-md transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xoá điểm này</span>
                  </button>
                </div>
              </div>
            ) : selectedShape ? (
              /* When a Shape is selected */
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#dbe4ee]">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded bg-[#e4ecf7] text-[#2f5d99] flex items-center justify-center">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#16233a] uppercase tracking-wide">
                        {selectedShape.type.replace('_', ' ')}
                      </div>
                      <div className="text-[10px] text-[#5b6b82]">Đối tượng hình học</div>
                    </div>
                  </div>
                  <button
                    onClick={onDeselect}
                    title="Bỏ chọn"
                    className="p-1 rounded hover:bg-[#f1f5f9] text-[#5b6b82]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {selectedShape.mergeGroupId && (
                  <div className="flex items-center justify-between gap-2 p-2 bg-[#e4ecf7] border border-[#2f5d99]/30 rounded-md text-[11px] text-[#2f5d99]">
                    <span>🔗 Thuộc nhóm gộp mã TikZ</span>
                    {onUnmergeShape && (
                      <button
                        onClick={() => onUnmergeShape(selectedShape.id)}
                        className="font-semibold hover:underline cursor-pointer"
                      >
                        Bỏ gộp
                      </button>
                    )}
                  </div>
                )}

                {selectedShape.chainGroupId && (
                  <div className="flex items-center justify-between gap-2 p-2 bg-[#d1fae5] border border-[#059669]/30 rounded-md text-[11px] text-[#059669]">
                    <span>🔗 Thuộc nhóm nối liên tục</span>
                    <button
                      onClick={() => onUpdateShape(selectedShape.id, { chainGroupId: undefined })}
                      className="font-semibold hover:underline cursor-pointer"
                    >
                      Bỏ nối
                    </button>
                  </div>
                )}

                {/* Stroke Color Palette in Bento circles */}
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold text-[#5b6b82] uppercase tracking-wider">
                    Màu sắc
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    {PRESET_COLORS.map((c) => {
                      const isSelected =
                        selectedShape.style.color.toLowerCase() === c.value.toLowerCase();
                      return (
                        <button
                          key={c.value}
                          onClick={() =>
                            onUpdateShape(selectedShape.id, {
                              style: { ...selectedShape.style, color: c.value },
                            })
                          }
                          title={c.label}
                          className={`w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center ${
                            isSelected
                              ? 'border-[#2f5d99] ring-2 ring-[#2f5d99]/30 scale-110'
                              : 'border-white ring-1 ring-[#cbd5e1] hover:scale-105'
                          }`}
                          style={{ backgroundColor: c.value }}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-2xs" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Stroke Width */}
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold text-[#5b6b82] uppercase tracking-wider">
                    Độ dày nét
                  </h3>
                  <div className="grid grid-cols-5 gap-1">
                    {STROKE_WIDTHS.map((w) => (
                      <button
                        key={w.value}
                        onClick={() =>
                          onUpdateShape(selectedShape.id, {
                            style: { ...selectedShape.style, strokeWidth: w.value },
                          })
                        }
                        className={`py-1.5 text-[11px] rounded-md border text-center transition-colors ${
                          selectedShape.style.strokeWidth === w.value
                            ? 'bg-[#e4ecf7] border-[#2f5d99] text-[#2f5d99] font-bold'
                            : 'bg-white border-[#dbe4ee] text-[#16233a] hover:bg-[#f8fafc]'
                        }`}
                      >
                        {w.value}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dash Pattern */}
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold text-[#5b6b82] uppercase tracking-wider">
                    Kiểu nét
                  </h3>
                  <select
                    value={selectedShape.style.dashPattern || 'solid'}
                    onChange={(e) =>
                      onUpdateShape(selectedShape.id, {
                        style: {
                          ...selectedShape.style,
                          dashPattern: e.target.value as DashPattern,
                        },
                      })
                    }
                    className="w-full px-3 py-1.5 bg-white border border-[#dbe4ee] rounded-md text-xs text-[#16233a] focus:outline-none focus:border-[#2f5d99]"
                  >
                    {DASH_PATTERNS.map((dp) => (
                      <option key={dp.id} value={dp.id}>
                        {dp.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Corner Radius control for Rounded Rectangle */}
                {selectedShape.type === 'rounded_rectangle' && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between items-center text-[10px] font-bold text-[#5b6b82] uppercase tracking-wider">
                      <span>Bán kính bo góc:</span>
                      <span className="font-mono text-[#16233a]">
                        {formatCm(selectedShape.cornerRadius ?? 0.3)} cm
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.05}
                      max={2.0}
                      step={0.05}
                      value={selectedShape.cornerRadius ?? 0.3}
                      onChange={(e) =>
                        onUpdateShape(selectedShape.id, {
                          cornerRadius: parseFloat(e.target.value) || 0.3,
                        })
                      }
                      className="w-full h-1.5 bg-[#dbe4ee] rounded-lg appearance-none cursor-pointer accent-[#2f5d99]"
                    />
                  </div>
                )}

                {/* Param Arc controls: Start Angle, End Angle, Radius */}
                {selectedShape.type === 'param_arc' && (
                  <div className="space-y-2.5 pt-1">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-[#16233a]">
                        <span className="text-[10px] font-bold text-[#5b6b82] uppercase tracking-wider">Góc bắt đầu:</span>
                        <span className="font-semibold text-[#2f5d99]">{selectedShape.startAngle}°</span>
                      </div>
                      <input
                        type="range"
                        min={-360}
                        max={360}
                        value={selectedShape.startAngle}
                        onChange={(e) =>
                          onUpdateShape(selectedShape.id, {
                            startAngle: Number(e.target.value),
                          } as any)
                        }
                        className="w-full h-1.5 bg-[#dbe4ee] rounded-lg appearance-none cursor-pointer accent-[#2f5d99]"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-[#16233a]">
                        <span className="text-[10px] font-bold text-[#5b6b82] uppercase tracking-wider">Góc kết thúc:</span>
                        <span className="font-semibold text-[#2f5d99]">{selectedShape.endAngle}°</span>
                      </div>
                      <input
                        type="range"
                        min={-360}
                        max={360}
                        value={selectedShape.endAngle}
                        onChange={(e) =>
                          onUpdateShape(selectedShape.id, {
                            endAngle: Number(e.target.value),
                          } as any)
                        }
                        className="w-full h-1.5 bg-[#dbe4ee] rounded-lg appearance-none cursor-pointer accent-[#2f5d99]"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-[#16233a]">
                        <span className="text-[10px] font-bold text-[#5b6b82] uppercase tracking-wider">Bán kính:</span>
                        <span className="font-semibold text-[#2f5d99]">{selectedShape.radius} cm</span>
                      </div>
                      <input
                        type="range"
                        min={0.2}
                        max={10}
                        step={0.1}
                        value={selectedShape.radius}
                        onChange={(e) =>
                          onUpdateShape(selectedShape.id, {
                            radius: Number(e.target.value),
                          } as any)
                        }
                        className="w-full h-1.5 bg-[#dbe4ee] rounded-lg appearance-none cursor-pointer accent-[#2f5d99]"
                      />
                    </div>
                  </div>
                )}

                {/* Rotation Angle control for rotatable shapes */}
                {(selectedShape.type === 'ellipse' ||
                  selectedShape.type === 'semi_ellipse' ||
                  selectedShape.type === 'rectangle' ||
                  selectedShape.type === 'square' ||
                  selectedShape.type === 'rounded_rectangle') && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[10px] font-bold text-[#5b6b82] uppercase tracking-wider">
                        Góc xoay
                      </h3>
                      <span className="text-[11px] font-semibold text-[#2f5d99]">
                        {selectedShape.rotation ?? 0}°
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      step={1}
                      value={selectedShape.rotation ?? 0}
                      onChange={(e) =>
                        onUpdateShape(selectedShape.id, { rotation: Number(e.target.value) } as any)
                      }
                      className="w-full h-1.5 bg-[#dbe4ee] rounded-lg appearance-none cursor-pointer accent-[#2f5d99]"
                    />
                    <div className="flex justify-between text-[10px] text-[#5b6b82]">
                      <span>-180°</span>
                      <button
                        onClick={() => onUpdateShape(selectedShape.id, { rotation: 0 } as any)}
                        className="text-[#2f5d99] hover:underline font-medium"
                      >
                        Đặt lại 0°
                      </button>
                      <span>180°</span>
                    </div>
                  </div>
                )}

                {/* Fill Option for Closed Shapes */}
                {(selectedShape.type === 'circle' ||
                  selectedShape.type === 'ellipse' ||
                  selectedShape.type === 'rectangle' ||
                  selectedShape.type === 'square' ||
                  selectedShape.type === 'rounded_rectangle' ||
                  selectedShape.type === 'semicircle' ||
                  selectedShape.type === 'semi_ellipse' ||
                  selectedShape.type === 'regular_polygon' ||
                  (selectedShape.type === 'polyline' && selectedShape.isClosed) ||
                  (selectedShape.type === 'bezier' && selectedShape.isClosed) ||
                  !!selectedShape.chainGroupId) && (
                  <div className="space-y-2 pt-1">
                    <h3 className="text-[10px] font-bold text-[#5b6b82] uppercase tracking-wider">
                      Tô màu nền
                    </h3>
                    {selectedShape.chainGroupId && (
                      <p className="text-[10px] text-[#5b6b82] italic">
                        Chỉ có tác dụng nếu cả chuỗi đã nối tạo thành đường khép kín (đầu = cuối).
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          onUpdateShape(selectedShape.id, {
                            style: { ...selectedShape.style, fillColor: 'transparent' },
                          })
                        }
                        className={`flex-1 py-1.5 text-xs rounded-md border transition-colors ${
                          !selectedShape.style.fillColor ||
                          selectedShape.style.fillColor === 'transparent'
                            ? 'bg-[#e4ecf7] border-[#2f5d99] text-[#2f5d99] font-bold'
                            : 'bg-white border-[#dbe4ee] text-[#5b6b82]'
                        }`}
                      >
                        Không tô
                      </button>
                      <button
                        onClick={() =>
                          onUpdateShape(selectedShape.id, {
                            style: {
                              ...selectedShape.style,
                              fillColor: selectedShape.style.color,
                              fillOpacity: 0.15,
                            },
                          })
                        }
                        className={`flex-1 py-1.5 text-xs rounded-md border transition-colors ${
                          selectedShape.style.fillColor &&
                          selectedShape.style.fillColor !== 'transparent'
                            ? 'bg-[#e4ecf7] border-[#2f5d99] text-[#2f5d99] font-bold'
                            : 'bg-white border-[#dbe4ee] text-[#5b6b82]'
                        }`}
                      >
                        Tô 15% màu nét
                      </button>
                    </div>
                  </div>
                )}

                {/* Delete Shape Button */}
                <div className="pt-2">
                  <button
                    onClick={() => onDeleteShape(selectedShape.id)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-[#fee2e2] hover:bg-[#fecaca] text-[#b91c1c] text-xs font-semibold rounded-md transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xoá hình này</span>
                  </button>
                </div>
              </div>
            ) : selectedPathAnnotation ? (
              /* When a PathAnnotation is selected */
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#dbe4ee]">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded bg-[#e4ecf7] text-[#2f5d99] flex items-center justify-center font-bold text-xs">
                      Ab
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#16233a] uppercase tracking-wide">
                        {selectedPathAnnotation.type === 'segment_label' ? 'Nhãn trên đoạn' : 'Nhãn điểm/góc'}
                      </div>
                      <div className="text-[10px] text-[#5b6b82]">Nhãn tùy biến \path</div>
                    </div>
                  </div>
                  <button
                    onClick={onDeselect}
                    title="Bỏ chọn"
                    className="p-1 rounded hover:bg-[#f1f5f9] text-[#5b6b82]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Edit Text Field */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#5b6b82] uppercase tracking-wider">
                    Nội dung nhãn
                  </label>
                  <input
                    type="text"
                    value={selectedPathAnnotation.text}
                    onChange={(e) =>
                      onUpdatePathAnnotation(selectedPathAnnotation.id, { text: e.target.value })
                    }
                    className="w-full text-xs bg-white border border-[#dbe4ee] hover:border-[#b4c6dc] focus:border-[#2f5d99] focus:ring-1 focus:ring-[#2f5d99]/20 rounded-md px-2.5 py-1.5 outline-none transition-all font-mono"
                    placeholder="Ví dụ: $30^\circ$, 5m..."
                  />
                </div>

                {selectedPathAnnotation.type === 'segment_label' ? (
                  <>
                    {/* Position slider (pos) */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-[#16233a]">
                        <span className="text-[10px] font-bold text-[#5b6b82] uppercase tracking-wider">Vị trí (pos):</span>
                        <span className="font-semibold text-[#2f5d99]">{selectedPathAnnotation.pos ?? 0.5}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={selectedPathAnnotation.pos ?? 0.5}
                        onChange={(e) =>
                          onUpdatePathAnnotation(selectedPathAnnotation.id, {
                            pos: parseFloat(e.target.value),
                          })
                        }
                        className="w-full h-1.5 bg-[#dbe4ee] rounded-lg appearance-none cursor-pointer accent-[#2f5d99]"
                      />
                    </div>

                    {/* Position Option Selector */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[#5b6b82] uppercase tracking-wider">
                        Hướng nhãn
                      </label>
                      <select
                        value={selectedPathAnnotation.positionOption || ''}
                        onChange={(e) =>
                          onUpdatePathAnnotation(selectedPathAnnotation.id, {
                            positionOption: e.target.value || undefined,
                          })
                        }
                        className="w-full text-xs bg-white border border-[#dbe4ee] rounded-md px-2 py-1.5 outline-none transition-all"
                      >
                        <option value="">Mặc định (Không chỉ định)</option>
                        <option value="above">above (Phía trên)</option>
                        <option value="below">below (Phía dưới)</option>
                        <option value="left">left (Phía trái)</option>
                        <option value="right">right (Phía phải)</option>
                        <option value="above left">above left (Trên - Trái)</option>
                        <option value="above right">above right (Trên - Phải)</option>
                        <option value="below left">below left (Dưới - Trái)</option>
                        <option value="below right">below right (Dưới - Phải)</option>
                        <option value="midway">midway (Chính giữa)</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Angle (góc độ) control */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-[#16233a]">
                        <span className="text-[10px] font-bold text-[#5b6b82] uppercase tracking-wider">Góc độ (angle):</span>
                        <span className="font-semibold text-[#2f5d99]">{selectedPathAnnotation.angle}°</span>
                      </div>
                      <input
                        type="range"
                        min={-360}
                        max={360}
                        step={5}
                        value={selectedPathAnnotation.angle}
                        onChange={(e) =>
                          onUpdatePathAnnotation(selectedPathAnnotation.id, {
                            angle: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full h-1.5 bg-[#dbe4ee] rounded-lg appearance-none cursor-pointer accent-[#2f5d99]"
                      />
                    </div>

                    {/* Distance in pt */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-[#16233a]">
                        <span className="text-[10px] font-bold text-[#5b6b82] uppercase tracking-wider">Khoảng cách (pt):</span>
                        <span className="font-semibold text-[#2f5d99]">{selectedPathAnnotation.distancePt} pt</span>
                      </div>
                      <input
                        type="range"
                        min={5}
                        max={60}
                        step={1}
                        value={selectedPathAnnotation.distancePt}
                        onChange={(e) =>
                          onUpdatePathAnnotation(selectedPathAnnotation.id, {
                            distancePt: parseInt(e.target.value) || 15,
                          })
                        }
                        className="w-full h-1.5 bg-[#dbe4ee] rounded-lg appearance-none cursor-pointer accent-[#2f5d99]"
                      />
                    </div>
                  </>
                )}

                {/* Delete Button */}
                <div className="pt-2">
                  <button
                    onClick={() => onDeletePathAnnotation(selectedPathAnnotation.id)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-[#fee2e2] hover:bg-[#fecaca] text-[#b91c1c] text-xs font-semibold rounded-md transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xoá nhãn này</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Empty state when nothing selected */
              <div className="py-10 px-2 text-center space-y-4">
                <div className="space-y-3">
                  <div className="w-10 h-10 mx-auto rounded-full bg-[#eef2f6] text-[#5b6b82] flex items-center justify-center">
                    <CircleDot className="w-5 h-5 stroke-[1.5]" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-[#16233a]">
                      Chưa chọn đối tượng nào
                    </div>
                    <div className="text-[11px] text-[#5b6b82] leading-relaxed">
                      Nhấp vào một điểm, hình vẽ hoặc nhãn \path trên canvas để tùy chỉnh.
                    </div>
                  </div>
                </div>

                {pathAnnotations.length > 0 && (
                  <div className="pt-4 border-t border-[#dbe4ee] text-left space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#5b6b82]">
                      Nhãn tùy biến đã thêm ({pathAnnotations.length})
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {pathAnnotations.map((ann) => (
                        <button
                          key={ann.id}
                          onClick={() => {
                            if (onSelectPathAnnotation) {
                              onSelectPathAnnotation(ann.id);
                            }
                          }}
                          className="w-full text-left p-2 rounded bg-[#f8fafc] border border-[#dbe4ee] hover:bg-[#e4ecf7] hover:border-[#2f5d99]/30 transition-all text-xs flex justify-between items-center"
                        >
                          <div className="truncate pr-2 flex items-center gap-1.5">
                            <span className="font-mono text-[#16233a] truncate font-semibold">{ann.text || '(Không có nội dung)'}</span>
                          </div>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#f1f5f9] text-[#5b6b82] shrink-0 font-medium">
                            {ann.type === 'segment_label' ? 'Đoạn thẳng' : 'Điểm/Góc'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-[#dbe4ee] text-left space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#5b6b82]">
                    Mẹo sử dụng
                  </div>
                  <ul className="text-[11px] text-[#5b6b82] space-y-1 list-disc list-inside">
                    <li>Kéo thả điểm để di chuyển hình</li>
                    <li>Giữ Shift + Kéo để dịch chuyển canvas</li>
                    <li>Cuộn chuột để phóng to / thu nhỏ</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Tab TikZ Code */
          <div className="space-y-4 flex flex-col h-full">
            {/* Options */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-[#5b6b82] uppercase tracking-wider">
                Tùy chọn xuất LaTeX
              </h3>
              <div className="space-y-1.5 bg-[#f8fafc] p-2.5 rounded-md border border-[#dbe4ee]">
                <label className="flex items-center gap-2 text-xs text-[#16233a] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tikzOptions.standalone}
                    onChange={(e) => onUpdateTikzOptions({ standalone: e.target.checked })}
                    className="rounded border-[#cbd5e1] text-[#2f5d99] accent-[#2f5d99] focus:ring-[#2f5d99]"
                  />
                  <span>Tài liệu hoàn chỉnh (\documentclass)</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-[#16233a] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tikzOptions.includeLabels}
                    onChange={(e) => onUpdateTikzOptions({ includeLabels: e.target.checked })}
                    className="rounded border-[#cbd5e1] text-[#2f5d99] accent-[#2f5d99] focus:ring-[#2f5d99]"
                  />
                  <span>Xuất nhãn điểm ($A$, $B$, $C$...)</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-[#16233a] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tikzOptions.includePoints}
                    onChange={(e) => onUpdateTikzOptions({ includePoints: e.target.checked })}
                    className="rounded border-[#cbd5e1] text-[#2f5d99] accent-[#2f5d99] focus:ring-[#2f5d99]"
                  />
                  <span>Vẽ chấm tròn các điểm</span>
                </label>
              </div>
            </div>

            {/* Code Block Container - Bento Dark Card */}
            <div className="space-y-2 flex-1 flex flex-col">
              <div className="flex justify-between items-center">
                <h3 className="text-[10px] font-bold text-[#5b6b82] uppercase tracking-wider">
                  Mã TikZ Export
                </h3>
                <button
                  onClick={handleCopyCode}
                  className="text-[10px] text-[#2f5d99] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-[#059669]" />
                      <span className="text-[#059669]">Đã chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Sao chép</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex-1 min-h-[220px] bg-[#17233a] rounded-lg overflow-auto border border-[#1e293b] shadow-inner select-text">
                {tikzCode.split('\n').map((line, idx) => {
                  const isHighlighted = highlightedLines.has(idx);
                  const isInCopiedRange =
                    copiedRange !== null && idx >= copiedRange.start && idx <= copiedRange.end;
                  const isAnchor = lastClickedLine === idx && !copiedRange;

                  return (
                    <div
                      key={idx}
                      ref={(el) => {
                        if (el) tikzLineRefs.current.set(idx, el);
                        else tikzLineRefs.current.delete(idx);
                      }}
                      onClick={(e) => {
                        // Nếu giữ Shift bấm thẳng vào dòng thì cũng kích hoạt copy khối
                        if (e.shiftKey) {
                          handleCopyLineOrBlock(idx, e);
                        }
                      }}
                      className={`group flex items-center justify-between px-3 py-0.5 transition-colors cursor-pointer ${
                        isInCopiedRange
                          ? 'bg-[#065f46]/40 border-l-2 border-[#10b981]'
                          : isHighlighted
                          ? 'bg-[#fef3c7] border-l-2 border-[#f59e0b]'
                          : isAnchor
                          ? 'bg-[#1e293b] border-l-2 border-[#60a5fa]'
                          : 'hover:bg-[#1e293b]'
                      }`}
                    >
                      {/* Số thứ tự dòng (Line number) */}
                      <span className="text-[10px] font-mono text-[#475569] w-6 shrink-0 select-none text-right mr-2">
                        {idx + 1}
                      </span>

                      <pre
                        className={`whitespace-pre font-mono text-[11px] leading-relaxed selection:bg-[#2f5d99] selection:text-white flex-1 overflow-x-auto ${
                          isHighlighted ? 'text-[#16233a]' : 'text-[#a5b4fc]'
                        }`}
                      >
                        {line || ' '}
                      </pre>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyLineOrBlock(idx, e);
                        }}
                        className={`transition-opacity shrink-0 ml-2 p-1 rounded hover:bg-[#2f3f5c] cursor-pointer ${
                          isInCopiedRange || isAnchor || copiedLineIdx === idx
                            ? 'opacity-100'
                            : 'opacity-0 group-hover:opacity-100'
                        } ${
                          isHighlighted
                            ? 'text-[#16233a] hover:text-black'
                            : 'text-[#a5b4fc] hover:text-white'
                        }`}
                        title="Bấm để chép dòng này · Giữ Shift + Bấm để chép cả khối từ mốc trước"
                      >
                        {isInCopiedRange || copiedLineIdx === idx ? (
                          <Check className="w-3 h-3 text-[#10b981]" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bento Bottom CTA Footer */}
      <div className="p-4 border-t border-[#dbe4ee] bg-white space-y-2">
        <button
          onClick={handleDownloadTex}
          className="w-full py-3 bg-[#2f5d99] hover:bg-[#254b7c] text-white rounded-md text-xs font-bold tracking-wide flex items-center justify-center gap-2 shadow-xs transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>TẢI FILE .TEX</span>
        </button>

        <button
          onClick={handleDownloadSvg}
          className="w-full py-1.5 bg-white hover:bg-[#f8fafc] text-[#5b6b82] hover:text-[#16233a] border border-[#dbe4ee] rounded-md text-[11px] font-semibold transition-colors flex items-center justify-center gap-1.5"
        >
          <ImageIcon className="w-3 h-3" />
          <span>Xuất ảnh SVG</span>
        </button>
      </div>
    </aside>
  );
};

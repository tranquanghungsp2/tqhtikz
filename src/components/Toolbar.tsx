import React, { useRef } from 'react';
import {
  MousePointer,
  Dot,
  Minus,
  Spline,
  Circle,
  Square,
  Hexagon,
  CornerDownRight,
  GitCommit,
  Equal,
  Sparkles,
  Grid,
  Magnet,
  Maximize2,
  Undo2,
  Redo2,
  Trash2,
  Compass,
  Image as ImageIcon,
  Move,
  Lock,
  Unlock,
  X,
  Upload,
  Pipette,
} from 'lucide-react';
import { ToolType, AppSettings, BackgroundImageState, GeoPoint } from '../types';
import { dist, formatCm } from '../utils/geometry';

interface ToolbarProps {
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  settings: AppSettings;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClearAll: () => void;
  polygonSides: number;
  onChangePolygonSides: (sides: number) => void;
  rectangleMode?: 'shape' | 'points';
  onChangeRectangleMode?: (mode: 'shape' | 'points') => void;
  bezierSegments: number;
  onChangeBezierSegments: (segments: number) => void;
  bezierClosed: boolean;
  onToggleBezierClosed: () => void;
  polylineStepCount?: number;
  onFinishPolyline?: () => void;
  paramArcStartPointId?: string | null;
  arcStartAngle?: number;
  onChangeArcStartAngle?: (v: number) => void;
  arcEndAngle?: number;
  onChangeArcEndAngle?: (v: number) => void;
  arcRadius?: number;
  onChangeArcRadius?: (v: number) => void;
  onFinishParamArc?: () => void;
  pickingArcRadius?: boolean;
  onTogglePickingArcRadius?: () => void;
  radiusPickPoints?: GeoPoint[];
  onApplyRadiusFromPoints?: (divisor: number) => void;
  onCancelRadiusPick?: () => void;
  bgImage?: BackgroundImageState;
  onUpdateBgImage?: React.Dispatch<React.SetStateAction<BackgroundImageState>>;
  globalLabelDistance: number;
  onSetGlobalLabelDistance: (v: number) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  onSelectTool,
  settings,
  onUpdateSettings,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClearAll,
  polygonSides,
  onChangePolygonSides,
  rectangleMode = 'shape',
  onChangeRectangleMode,
  bezierSegments,
  onChangeBezierSegments,
  bezierClosed,
  onToggleBezierClosed,
  polylineStepCount = 0,
  onFinishPolyline,
  paramArcStartPointId = null,
  arcStartAngle = 0,
  onChangeArcStartAngle,
  arcEndAngle = 90,
  onChangeArcEndAngle,
  arcRadius = 2,
  onChangeArcRadius,
  onFinishParamArc,
  pickingArcRadius = false,
  onTogglePickingArcRadius,
  radiusPickPoints = [],
  onApplyRadiusFromPoints,
  onCancelRadiusPick,
  bgImage,
  onUpdateBgImage,
  globalLabelDistance,
  onSetGlobalLabelDistance,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const naturalAspect = img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 1;
        onUpdateBgImage?.((prev) => ({
          ...prev,
          dataUrl,
          fileName: file.name,
          opacity: 0.4,
          scale: 1,
          panX: 0,
          panY: 0,
          naturalAspect,
        }));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    // Reset file input so same file can be re-selected if needed
    e.target.value = '';
  };

  const handleRemoveBgImage = () => {
    onUpdateBgImage?.((prev) => ({
      ...prev,
      dataUrl: null,
      fileName: '',
    }));
    if (activeTool === 'move_background') {
      onSelectTool('select');
    }
  };

  return (
    <aside
      id="left-toolbar"
      className="w-[226px] min-w-[226px] h-full bg-[#ffffff] border-r border-[#dbe4ee] flex flex-col justify-between select-none shadow-[1px_0_4px_rgba(22,35,58,0.03)] z-10"
    >
      {/* App brand header */}
      <div className="p-3.5 border-b border-[#dbe4ee] flex items-center justify-between bg-white">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#2f5d99] rotate-45 shrink-0 shadow-2xs"></div>
          <h1 className="text-xs font-bold tracking-wider text-[#2f5d99] uppercase leading-none">
            GEO TIKZ STUDIO
          </h1>
        </div>
        <span className="text-[9px] font-semibold bg-[#e4ecf7] text-[#2f5d99] px-1.5 py-0.5 rounded tracking-tight">
          MATH
        </span>
      </div>

      {/* Scrollable Tool Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Group 1: Chọn — ghim cố định ở đầu vùng cuộn */}
        <div className="sticky -top-3 z-20 bg-white pt-3 -mx-3 px-3 pb-2 border-b border-[#dbe4ee]">
          <p className="text-[10px] font-semibold text-[#5b6b82] uppercase tracking-widest mb-1.5 px-1">
            Chọn
          </p>
          <button
            id="tool-btn-select"
            onClick={() => onSelectTool('select')}
            title="Kéo thả điểm để di chuyển, nhấp vào hình để chọn và đổi thuộc tính (phím tắt: V)"
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all text-left ${
              activeTool === 'select'
                ? 'bg-[#e4ecf7] text-[#2f5d99] font-semibold shadow-2xs ring-1 ring-[#2f5d99]/20'
                : 'text-[#16233a] hover:bg-[#f1f5f9]'
            }`}
          >
            <MousePointer className="w-4 h-4 text-[#2f5d99]" />
            <span>Con trỏ chọn</span>
          </button>

          <button
            id="tool-btn-toggle_visibility"
            onClick={() => onSelectTool('toggle_visibility')}
            title="Bấm vào 1 điểm hoặc hình trên canvas để ẩn/hiện nó (ẩn = không xuất mã TikZ, vẫn mờ trên canvas)"
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all text-left mt-1 ${
              activeTool === 'toggle_visibility'
                ? 'bg-[#e4ecf7] text-[#2f5d99] font-semibold shadow-2xs ring-1 ring-[#2f5d99]/20'
                : 'text-[#16233a] hover:bg-[#f1f5f9]'
            }`}
          >
            <span className="w-4 h-4 flex items-center justify-center shrink-0">👁️</span>
            <span>Ẩn/Hiện đối tượng</span>
          </button>
        </div>

        {/* Group 2: Điểm & đường */}
        <div>
          <p className="text-[10px] font-semibold text-[#5b6b82] uppercase tracking-widest mb-1.5 px-1">
            Điểm & đường
          </p>
          <div className="space-y-1">
            <button
              id="tool-btn-point"
              onClick={() => onSelectTool('point')}
              title="Nhấp chuột vào canvas để tạo điểm tự do"
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all text-left ${
                activeTool === 'point'
                  ? 'bg-[#e4ecf7] text-[#2f5d99] font-semibold shadow-2xs'
                  : 'text-[#16233a] hover:bg-[#f1f5f9]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-current mx-1 shrink-0"></span>
              <span>Điểm tự do</span>
            </button>
            <button
              id="tool-btn-point-on-line"
              onClick={() => onSelectTool('point_on_line')}
              title="Điểm trên đường: nhấp vào 1 đường có sẵn để tạo điểm luôn ràng buộc nằm trên đường đó"
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all text-left ${
                activeTool === 'point_on_line'
                  ? 'bg-[#e4ecf7] text-[#2f5d99] font-semibold shadow-2xs'
                  : 'text-[#16233a] hover:bg-[#f1f5f9]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-current mx-1 shrink-0 ring-2 ring-[#f59e0b] ring-offset-1"></span>
              <span>Điểm trên đường</span>
            </button>
            <button
              id="tool-btn-measure"
              onClick={() => onSelectTool('measure')}
              title="Đo khoảng cách giữa 2 điểm, chia đôi/chia 3/chia 4"
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all text-left ${
                activeTool === 'measure'
                  ? 'bg-[#e4ecf7] text-[#2f5d99] font-semibold shadow-2xs'
                  : 'text-[#16233a] hover:bg-[#f1f5f9]'
              }`}
            >
              <span className="font-mono text-xs font-bold leading-none w-4 text-center">↔</span>
              <span>Đo & chia đoạn</span>
            </button>
            <button
              id="tool-btn-segment"
              onClick={() => onSelectTool('segment')}
              title="Nhấp điểm đầu, nhấp điểm cuối để tạo đoạn thẳng"
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all text-left ${
                activeTool === 'segment'
                  ? 'bg-[#e4ecf7] text-[#2f5d99] font-semibold shadow-2xs'
                  : 'text-[#16233a] hover:bg-[#f1f5f9]'
              }`}
            >
              <span className="w-4 h-[2px] bg-current shrink-0"></span>
              <span>Đoạn thẳng</span>
            </button>
            <button
              id="tool-btn-polyline"
              onClick={() => onSelectTool('polyline')}
              title="Nhấp liên tiếp nhiều điểm, nhấp điểm đầu để đóng hoặc bấm Hoàn thành"
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all text-left ${
                activeTool === 'polyline'
                  ? 'bg-[#e4ecf7] text-[#2f5d99] font-semibold shadow-2xs'
                  : 'text-[#16233a] hover:bg-[#f1f5f9]'
              }`}
            >
              <CornerDownRight className="w-4 h-4 shrink-0" />
              <span>Đường gấp khúc</span>
            </button>

            {activeTool === 'polyline' && polylineStepCount > 0 && (
              <div className="p-2 bg-[#fef3c7] rounded-md border border-[#f59e0b]/40 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="text-[11px] text-[#b45309] font-medium">
                  Đã chấm {polylineStepCount} điểm
                </div>
                {onFinishPolyline && (
                  <button
                    onClick={onFinishPolyline}
                    className="w-full py-1 px-2 bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-semibold rounded shadow-xs transition-colors"
                  >
                    Hoàn thành nét (Enter hoặc double-click)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Nhãn & Ghi chú */}
        <div>
          <p className="text-[10px] font-semibold text-[#5b6b82] uppercase tracking-widest mb-1.5 px-1">
            Nhãn & Ghi chú (TikZ \path)
          </p>
          <div className="space-y-1">
            <button
              id="tool-btn-path_segment_label"
              onClick={() => onSelectTool('path_segment_label')}
              title="Ghi nhãn dán trên đoạn thẳng giữa 2 điểm (A)--(B) node[pos=0.5, left] {$7\,m$}"
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all text-left ${
                activeTool === 'path_segment_label'
                  ? 'bg-[#e4ecf7] text-[#2f5d99] font-semibold shadow-2xs ring-1 ring-[#2f5d99]/10'
                  : 'text-[#16233a] hover:bg-[#f1f5f9]'
              }`}
            >
              <span className="font-mono text-xs font-bold leading-none w-4 text-center">⇎</span>
              <span>Nhãn trên đoạn (2 điểm)</span>
            </button>

            <button
              id="tool-btn-path_offset_label"
              onClick={() => onSelectTool('path_offset_label')}
              title="Ghi chú nhãn lệch / nhãn góc từ 1 điểm (A) ++ (30:20pt) node{$30^\circ$}"
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all text-left ${
                activeTool === 'path_offset_label'
                  ? 'bg-[#e4ecf7] text-[#2f5d99] font-semibold shadow-2xs ring-1 ring-[#2f5d99]/10'
                  : 'text-[#16233a] hover:bg-[#f1f5f9]'
              }`}
            >
              <span className="font-mono text-xs font-bold leading-none w-4 text-center">∡</span>
              <span>Nhãn góc / lệch (1 điểm)</span>
            </button>
          </div>
        </div>

        {/* Group 3: Hình cơ bản - Bento 2-column grid */}
        <div>
          <p className="text-[10px] font-semibold text-[#5b6b82] uppercase tracking-widest mb-1.5 px-1">
            Hình cơ bản
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              id="tool-btn-square"
              onClick={() => onSelectTool('square')}
              title="Hình vuông: Nhấp 2 góc đối diện"
              className={`flex flex-col items-center justify-center p-2 rounded-md text-[11px] font-medium border transition-all ${
                activeTool === 'square'
                  ? 'bg-[#e4ecf7] border-[#2f5d99] text-[#2f5d99] font-semibold shadow-2xs'
                  : 'bg-white border-[#dbe4ee] text-[#16233a] hover:bg-[#f8fafc]'
              }`}
            >
              <div className="w-3.5 h-3.5 border-2 border-current mb-1"></div>
              <span>Vuông</span>
            </button>
            <button
              id="tool-btn-circle"
              onClick={() => onSelectTool('circle')}
              title="Đường tròn: Nhấp tâm, nhấp điểm bán kính"
              className={`flex flex-col items-center justify-center p-2 rounded-md text-[11px] font-medium border transition-all ${
                activeTool === 'circle'
                  ? 'bg-[#e4ecf7] border-[#2f5d99] text-[#2f5d99] font-semibold shadow-2xs'
                  : 'bg-white border-[#dbe4ee] text-[#16233a] hover:bg-[#f8fafc]'
              }`}
            >
              <div className="w-3.5 h-3.5 rounded-full border-2 border-current mb-1"></div>
              <span>Tròn</span>
            </button>
            <button
              id="tool-btn-rectangle"
              onClick={() => onSelectTool('rectangle')}
              title="Hình chữ nhật: Nhấp 2 góc đối diện"
              className={`flex flex-col items-center justify-center p-2 rounded-md text-[11px] font-medium border transition-all ${
                activeTool === 'rectangle'
                  ? 'bg-[#e4ecf7] border-[#2f5d99] text-[#2f5d99] font-semibold shadow-2xs'
                  : 'bg-white border-[#dbe4ee] text-[#16233a] hover:bg-[#f8fafc]'
              }`}
            >
              <div className="w-4 h-3 border-2 border-current mb-1"></div>
              <span>Chữ nhật</span>
            </button>

            {activeTool === 'rectangle' && (
              <div className="col-span-2 flex rounded-md border border-[#dbe4ee] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                <button
                  onClick={() => onChangeRectangleMode?.('shape')}
                  className={`flex-1 py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
                    rectangleMode === 'shape'
                      ? 'bg-[#e4ecf7] text-[#2f5d99] font-semibold'
                      : 'bg-white text-[#5b6b82] hover:bg-[#f8fafc]'
                  }`}
                >
                  Vẽ hình liền
                </button>
                <button
                  onClick={() => onChangeRectangleMode?.('points')}
                  className={`flex-1 py-1.5 text-[11px] font-medium border-l border-[#dbe4ee] transition-colors cursor-pointer ${
                    rectangleMode === 'points'
                      ? 'bg-[#e4ecf7] text-[#2f5d99] font-semibold'
                      : 'bg-white text-[#5b6b82] hover:bg-[#f8fafc]'
                  }`}
                >
                  Chỉ tạo 4 điểm
                </button>
              </div>
            )}
            <button
              id="tool-btn-rounded_rectangle"
              onClick={() => onSelectTool('rounded_rectangle')}
              title="Hình chữ nhật bo góc: Nhấp 2 góc đối diện"
              className={`flex flex-col items-center justify-center p-2 rounded-md text-[11px] font-medium border transition-all ${
                activeTool === 'rounded_rectangle'
                  ? 'bg-[#e4ecf7] border-[#2f5d99] text-[#2f5d99] font-semibold shadow-2xs'
                  : 'bg-white border-[#dbe4ee] text-[#16233a] hover:bg-[#f8fafc]'
              }`}
            >
              <div className="w-4 h-3 border-2 border-current rounded-xs mb-1"></div>
              <span>Bo góc</span>
            </button>
            <button
              id="tool-btn-ellipse"
              onClick={() => onSelectTool('ellipse')}
              title="Elip: Nhấp tâm, nhấp bán trục ngang, nhấp bán trục dọc"
              className={`col-span-2 flex items-center justify-center gap-2 p-1.5 rounded-md text-[11px] font-medium border transition-all ${
                activeTool === 'ellipse'
                  ? 'bg-[#e4ecf7] border-[#2f5d99] text-[#2f5d99] font-semibold shadow-2xs'
                  : 'bg-white border-[#dbe4ee] text-[#16233a] hover:bg-[#f8fafc]'
              }`}
            >
              <span className="w-4 h-3 border-2 border-current rounded-[50%]"></span>
              <span>Elip</span>
            </button>
            <button
              id="tool-btn-regular_polygon"
              onClick={() => onSelectTool('regular_polygon')}
              title={`Đa giác đều ${polygonSides} cạnh`}
              className={`col-span-2 flex items-center justify-center gap-2 p-1.5 rounded-md text-[11px] font-medium border transition-all ${
                activeTool === 'regular_polygon'
                  ? 'bg-[#e4ecf7] border-[#2f5d99] text-[#2f5d99] font-semibold shadow-2xs'
                  : 'bg-white border-[#dbe4ee] text-[#16233a] hover:bg-[#f8fafc]'
              }`}
            >
              <Hexagon className="w-3.5 h-3.5" />
              <span>Đa giác đều ({polygonSides} cạnh)</span>
            </button>

            {activeTool === 'regular_polygon' && (
              <div className="col-span-2 p-2.5 bg-[#f8fafc] rounded-md border border-[#dbe4ee] space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="flex items-center justify-between text-xs text-[#16233a]">
                  <span>Số cạnh:</span>
                  <span className="font-semibold text-[#2f5d99]">{polygonSides}</span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={12}
                  value={polygonSides}
                  onChange={(e) => onChangePolygonSides(Number(e.target.value))}
                  className="w-full h-1.5 bg-[#dbe4ee] rounded-lg appearance-none cursor-pointer accent-[#2f5d99]"
                />
                <div className="flex justify-between text-[10px] text-[#5b6b82]">
                  <span>3 (Tam giác)</span>
                  <span>6 (Lục giác)</span>
                  <span>12</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Group 4: Đường cong & nâng cao */}
        <div>
          <p className="text-[10px] font-semibold text-[#5b6b82] uppercase tracking-widest mb-1.5 px-1">
            Đường cong & nâng cao
          </p>
          <div className="space-y-1">
            <button
              id="tool-btn-arc_3p"
              onClick={() => onSelectTool('arc_3p')}
              title="Cung tròn ngoại tiếp qua 3 điểm"
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all text-left ${
                activeTool === 'arc_3p'
                  ? 'bg-[#e4ecf7] text-[#2f5d99] font-semibold shadow-2xs'
                  : 'text-[#16233a] hover:bg-[#f1f5f9]'
              }`}
            >
              <Compass className="w-4 h-4 shrink-0" />
              <span>Cung tròn qua 3 điểm</span>
            </button>

            <button
              id="tool-btn-param_arc"
              onClick={() => onSelectTool('param_arc')}
              title="Cung tròn theo góc bắt đầu/kết thúc + bán kính (cú pháp TikZ arc(start:end:radius))"
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all text-left ${
                activeTool === 'param_arc'
                  ? 'bg-[#e4ecf7] text-[#2f5d99] font-semibold shadow-2xs'
                  : 'text-[#16233a] hover:bg-[#f1f5f9]'
              }`}
            >
              <span className="font-mono text-xs font-bold leading-none w-4 text-center">⌒</span>
              <span>Cung tròn (góc, bán kính)</span>
            </button>

            {activeTool === 'param_arc' && (
              <div className="p-2.5 bg-[#f8fafc] rounded-md border border-[#dbe4ee] space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                {!paramArcStartPointId ? (
                  <p className="text-[11px] text-[#5b6b82]">Nhấp 1 điểm trên canvas làm điểm bắt đầu cung.</p>
                ) : (
                  <>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs text-[#16233a]">
                        <span>Góc bắt đầu</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={arcStartAngle}
                            min={-360}
                            max={360}
                            step={1}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              if (!Number.isNaN(v)) onChangeArcStartAngle?.(v);
                            }}
                            className="w-16 text-right text-xs font-semibold text-[#2f5d99] bg-white border border-[#dbe4ee] rounded px-1.5 py-0.5 focus:outline-none focus:border-[#2f5d99]"
                          />
                          <span className="text-[#5b6b82]">°</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min={-360}
                        max={360}
                        value={arcStartAngle}
                        onChange={(e) => onChangeArcStartAngle?.(Number(e.target.value))}
                        className="w-full h-1.5 bg-[#dbe4ee] rounded-lg appearance-none cursor-pointer accent-[#2f5d99]"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs text-[#16233a]">
                        <span>Góc kết thúc</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={arcEndAngle}
                            min={-360}
                            max={360}
                            step={1}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              if (!Number.isNaN(v)) onChangeArcEndAngle?.(v);
                            }}
                            className="w-16 text-right text-xs font-semibold text-[#2f5d99] bg-white border border-[#dbe4ee] rounded px-1.5 py-0.5 focus:outline-none focus:border-[#2f5d99]"
                          />
                          <span className="text-[#5b6b82]">°</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min={-360}
                        max={360}
                        value={arcEndAngle}
                        onChange={(e) => onChangeArcEndAngle?.(Number(e.target.value))}
                        className="w-full h-1.5 bg-[#dbe4ee] rounded-lg appearance-none cursor-pointer accent-[#2f5d99]"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs text-[#16233a]">
                        <span>Bán kính</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={arcRadius}
                            min={0.2}
                            max={10}
                            step={0.1}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              if (!Number.isNaN(v)) onChangeArcRadius?.(v);
                            }}
                            className="w-16 text-right text-xs font-semibold text-[#2f5d99] bg-white border border-[#dbe4ee] rounded px-1.5 py-0.5 focus:outline-none focus:border-[#2f5d99]"
                          />
                          <span className="text-[#5b6b82]">cm</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min={0.2}
                        max={10}
                        step={0.1}
                        value={arcRadius}
                        onChange={(e) => onChangeArcRadius?.(Number(e.target.value))}
                        className="w-full h-1.5 bg-[#dbe4ee] rounded-lg appearance-none cursor-pointer accent-[#2f5d99]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <button
                        onClick={onTogglePickingArcRadius}
                        className={`w-full text-[11px] font-medium px-2 py-1.5 rounded border transition-colors ${
                          pickingArcRadius
                            ? 'bg-[#e0f2fe] border-[#0284c7] text-[#0284c7]'
                            : 'bg-white border-[#dbe4ee] text-[#5b6b82] hover:bg-[#f1f5f9]'
                        }`}
                      >
                        📏 Lấy bán kính từ 2 điểm
                      </button>

                      {pickingArcRadius && (
                        <div className="p-2 bg-[#f0f9ff] border border-[#7dd3fc] rounded-md space-y-1.5">
                          {radiusPickPoints.length < 2 ? (
                            <p className="text-[10.5px] text-[#0369a1]">
                              Nhấp {radiusPickPoints.length === 0 ? '2 điểm' : '1 điểm nữa'} trên canvas để đo khoảng cách.
                            </p>
                          ) : (
                            <>
                              <div className="text-[11px] text-[#0369a1]">
                                Khoảng cách: <span className="font-semibold">{formatCm(dist(radiusPickPoints[0], radiusPickPoints[1]))} cm</span>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => onApplyRadiusFromPoints?.(1)}
                                  className="flex-1 text-[10.5px] font-medium bg-white border border-[#7dd3fc] hover:bg-[#e0f2fe] px-1.5 py-1 rounded"
                                >
                                  Dùng nguyên
                                </button>
                                <button
                                  onClick={() => onApplyRadiusFromPoints?.(2)}
                                  className="flex-1 text-[10.5px] font-medium bg-white border border-[#7dd3fc] hover:bg-[#e0f2fe] px-1.5 py-1 rounded"
                                >
                                  Chia đôi
                                </button>
                                <button
                                  onClick={() => onApplyRadiusFromPoints?.(3)}
                                  className="flex-1 text-[10.5px] font-medium bg-white border border-[#7dd3fc] hover:bg-[#e0f2fe] px-1.5 py-1 rounded"
                                >
                                  Chia 3
                                </button>
                              </div>
                            </>
                          )}
                          <button onClick={onCancelRadiusPick} className="text-[10px] text-[#5b6b82] hover:text-[#16233a]">
                            Huỷ
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={onFinishParamArc}
                      className="w-full py-1.5 px-2 bg-[#2f5d99] hover:bg-[#254a7a] text-white text-xs font-semibold rounded shadow-xs transition-colors cursor-pointer"
                    >
                      Vẽ cung (Enter)
                    </button>
                  </>
                )}
              </div>
            )}

            <button
              id="tool-btn-semicircle"
              onClick={() => onSelectTool('semicircle')}
              title="Nửa đường tròn: Nhấp tâm, nhấp điểm xác định bán kính và hướng cắt"
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all text-left ${
                activeTool === 'semicircle'
                  ? 'bg-[#e4ecf7] text-[#2f5d99] font-semibold shadow-2xs'
                  : 'text-[#16233a] hover:bg-[#f1f5f9]'
              }`}
            >
              <div className="w-4 h-2 border-t-2 border-l-2 border-r-2 border-b-2 border-current rounded-t-full shrink-0"></div>
              <span>Nửa đường tròn</span>
            </button>

            <button
              id="tool-btn-semi_ellipse"
              onClick={() => onSelectTool('semi_ellipse')}
              title="Nửa elip: Nhấp tâm, nhấp bán trục cắt, nhấp hướng phình"
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all text-left ${
                activeTool === 'semi_ellipse'
                  ? 'bg-[#e4ecf7] text-[#2f5d99] font-semibold shadow-2xs'
                  : 'text-[#16233a] hover:bg-[#f1f5f9]'
              }`}
            >
              <span className="w-4 h-2.5 border-t-2 border-l-2 border-r-2 border-b-2 border-current rounded-t-[50%] shrink-0"></span>
              <span>Nửa elip</span>
            </button>

            <button
              id="tool-btn-parabola"
              onClick={() => onSelectTool('parabola')}
              title="Parabol: Nhấp đỉnh, nhấp 1 điểm parabol đi qua"
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all text-left ${
                activeTool === 'parabola'
                  ? 'bg-[#e4ecf7] text-[#2f5d99] font-semibold shadow-2xs'
                  : 'text-[#16233a] hover:bg-[#f1f5f9]'
              }`}
            >
              <span className="font-mono text-xs font-bold leading-none w-4 text-center">∪</span>
              <span>Parabol</span>
            </button>

            <button
              id="tool-btn-hyperbola"
              onClick={() => onSelectTool('hyperbola')}
              title="Hypecbol: Nhấp tâm đối xứng, nhấp điểm xác định độ mở 2 nhánh"
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all text-left ${
                activeTool === 'hyperbola'
                  ? 'bg-[#e4ecf7] text-[#2f5d99] font-semibold shadow-2xs'
                  : 'text-[#16233a] hover:bg-[#f1f5f9]'
              }`}
            >
              <span className="font-mono text-xs font-bold leading-none w-4 text-center">)(</span>
              <span>Hypecbol</span>
            </button>

            <button
              id="tool-btn-bezier"
              onClick={() => onSelectTool('bezier')}
              title="Đường cong Bezier với điểm uốn"
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all text-left ${
                activeTool === 'bezier'
                  ? 'bg-[#e4ecf7] text-[#2f5d99] font-semibold shadow-2xs'
                  : 'text-[#16233a] hover:bg-[#f1f5f9]'
              }`}
            >
              <Spline className="w-4 h-4 shrink-0" />
              <span>Đường cong Bezier</span>
            </button>

            {activeTool === 'bezier' && (
              <div className="p-2.5 bg-[#f8fafc] rounded-md border border-[#dbe4ee] space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="flex items-center justify-between text-xs text-[#16233a]">
                  <span>Số đoạn cong:</span>
                  <span className="font-semibold text-[#2f5d99]">{bezierSegments}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={bezierSegments}
                  onChange={(e) => onChangeBezierSegments(Number(e.target.value))}
                  className="w-full h-1.5 bg-[#dbe4ee] rounded-lg appearance-none cursor-pointer accent-[#2f5d99]"
                />
                <button
                  onClick={onToggleBezierClosed}
                  className={`w-full py-1 px-2 rounded text-[11px] font-medium border text-center transition-colors ${
                    bezierClosed
                      ? 'bg-[#e4ecf7] border-[#2f5d99] text-[#2f5d99]'
                      : 'bg-white border-[#dbe4ee] text-[#5b6b82] hover:bg-[#f1f5f9]'
                  }`}
                >
                  {bezierClosed ? '✓ Đóng thành vòng kín' : 'Đường cong hở'}
                </button>
              </div>
            )}
            <button
              id="tool-btn-intersection"
              onClick={() => onSelectTool('intersection')}
              title="Tìm giao điểm giữa 2 hình học đã vẽ"
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all text-left ${
                activeTool === 'intersection'
                  ? 'bg-[#e4ecf7] text-[#2f5d99] font-semibold shadow-2xs'
                  : 'text-[#16233a] hover:bg-[#f1f5f9]'
              }`}
            >
              <GitCommit className="w-4 h-4 shrink-0" />
              <span>Giao điểm hình học</span>
            </button>
          </div>
        </div>

        {/* Group 5: Quan hệ */}
        <div>
          <p className="text-[10px] font-semibold text-[#5b6b82] uppercase tracking-widest mb-1.5 px-1">
            Quan hệ
          </p>
          <div className="space-y-1">
            <button
              id="tool-btn-parallel"
              onClick={() => onSelectTool('parallel')}
              title="Vẽ đường song song"
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all text-left ${
                activeTool === 'parallel'
                  ? 'bg-[#e4ecf7] text-[#2f5d99] font-semibold shadow-2xs'
                  : 'text-[#16233a] hover:bg-[#f1f5f9]'
              }`}
            >
              <span className="font-bold text-sm leading-none w-4 text-center">∥</span>
              <span>Song song</span>
            </button>
            <button
              id="tool-btn-perpendicular"
              onClick={() => onSelectTool('perpendicular')}
              title="Vẽ đường vuông góc (tự động có ký hiệu vuông)"
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all text-left ${
                activeTool === 'perpendicular'
                  ? 'bg-[#e4ecf7] text-[#2f5d99] font-semibold shadow-2xs'
                  : 'text-[#16233a] hover:bg-[#f1f5f9]'
              }`}
            >
              <span className="font-bold text-sm leading-none w-4 text-center">⊥</span>
              <span>Vuông góc</span>
            </button>
          </div>
        </div>

        {/* Group 6: Ảnh nền để đồ hình */}
        <div>
          <p className="text-[10px] font-semibold text-[#5b6b82] uppercase tracking-widest mb-1.5 px-1">
            Ảnh nền đồ hình
          </p>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
            id="bg-image-upload-input"
          />

          {!bgImage?.dataUrl ? (
            <button
              id="upload-bg-image-btn"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-[#f8fafc] hover:bg-[#eef2f6] text-[#2f5d99] border border-dashed border-[#2f5d99]/40 rounded-md text-xs font-medium transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Tải ảnh lên đồ hình</span>
            </button>
          ) : (
            <div className="p-2.5 bg-[#f8fafc] rounded-md border border-[#dbe4ee] space-y-2.5">
              <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-[#e2e8f0]">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <ImageIcon className="w-3.5 h-3.5 text-[#2f5d99] shrink-0" />
                  <span className="text-[11px] font-semibold text-[#16233a] truncate">
                    {bgImage.fileName || 'Ảnh nền'}
                  </span>
                </div>
                <button
                  onClick={handleRemoveBgImage}
                  title="Gỡ ảnh nền"
                  className="p-1 text-[#5b6b82] hover:text-[#b91c1c] rounded hover:bg-[#fee2e2] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Move & Lock background buttons row */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  disabled={bgImage.locked}
                  onClick={() =>
                    onSelectTool(activeTool === 'move_background' ? 'select' : 'move_background')
                  }
                  className={`py-1.5 px-2 rounded text-xs font-medium flex items-center justify-center gap-1 border transition-all ${
                    bgImage.locked
                      ? 'opacity-50 cursor-not-allowed bg-white text-[#94a3b8] border-[#dbe4ee]'
                      : activeTool === 'move_background'
                      ? 'bg-[#2f5d99] text-white border-[#2f5d99] shadow-2xs font-semibold'
                      : 'bg-white text-[#16233a] border-[#dbe4ee] hover:bg-[#eef2f6]'
                  }`}
                  title={bgImage.locked ? 'Ảnh đang bị khoá' : 'Kéo thả chuột trên canvas để di chuyển vị trí ảnh nền'}
                >
                  <Move className="w-3.5 h-3.5" />
                  <span>{activeTool === 'move_background' ? 'Đang kéo' : 'Di chuyển'}</span>
                </button>

                <button
                  onClick={() => {
                    const willLock = !bgImage.locked;
                    onUpdateBgImage?.((prev) => ({
                      ...prev,
                      locked: willLock,
                    }));
                    if (willLock && activeTool === 'move_background') {
                      onSelectTool('select');
                    }
                  }}
                  className={`py-1.5 px-2 rounded text-xs font-medium flex items-center justify-center gap-1 border transition-all ${
                    bgImage.locked
                      ? 'bg-[#e4ecf7] border-[#2f5d99] text-[#2f5d99] font-semibold'
                      : 'bg-white text-[#16233a] border-[#dbe4ee] hover:bg-[#eef2f6]'
                  }`}
                  title={bgImage.locked ? 'Mở khoá để cho phép kéo di chuyển ảnh' : 'Khoá ảnh để tránh kéo nhầm khi vẽ hình'}
                >
                  {bgImage.locked ? (
                    <>
                      <Lock className="w-3.5 h-3.5 text-[#2f5d99]" />
                      <span>Đã khoá</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3.5 h-3.5 text-[#5b6b82]" />
                      <span>Khoá ảnh</span>
                    </>
                  )}
                </button>
              </div>

              <button
                id="tool-btn-eyedropper"
                onClick={() => onSelectTool('eyedropper')}
                title="Nhấp vào ảnh nền để lấy mã màu tại vị trí đó"
                className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all text-left mt-1.5 ${
                  activeTool === 'eyedropper'
                    ? 'bg-[#e4ecf7] text-[#2f5d99] font-semibold shadow-2xs'
                    : 'text-[#16233a] hover:bg-[#f1f5f9]'
                }`}
              >
                <Pipette className="w-4 h-4 shrink-0" />
                <span>Lấy mã màu ảnh</span>
              </button>

              {/* Opacity slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-[#5b6b82]">
                  <span>Độ mờ:</span>
                  <span className="font-semibold text-[#16233a]">
                    {Math.round((bgImage.opacity ?? 0.4) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round((bgImage.opacity ?? 0.4) * 100)}
                  onChange={(e) =>
                    onUpdateBgImage?.((prev) => ({
                      ...prev,
                      opacity: Number(e.target.value) / 100,
                    }))
                  }
                  className="w-full h-1.5 bg-[#dbe4ee] rounded-lg appearance-none cursor-pointer accent-[#2f5d99]"
                />
              </div>

              {/* Scale slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-[#5b6b82]">
                  <span>Tỉ lệ:</span>
                  <span className="font-semibold text-[#16233a]">
                    {Math.round((bgImage.scale ?? 1) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={400}
                  value={Math.round((bgImage.scale ?? 1) * 100)}
                  onChange={(e) =>
                    onUpdateBgImage?.((prev) => ({
                      ...prev,
                      scale: Number(e.target.value) / 100,
                    }))
                  }
                  className="w-full h-1.5 bg-[#dbe4ee] rounded-lg appearance-none cursor-pointer accent-[#2f5d99]"
                />
              </div>

              {/* Offset X and Y inputs (Vị trí góc dưới-trái của ảnh) */}
              <div className="space-y-1 pt-0.5">
                <div
                  className="text-[10px] text-[#5b6b82] truncate"
                  title="Vị trí góc dưới-trái của ảnh so với gốc toạ độ"
                >
                  Vị trí góc dưới-trái (cm):
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div
                    className="flex items-center gap-1 bg-white border border-[#dbe4ee] px-1.5 py-1 rounded text-[10px]"
                    title="Vị trí góc dưới-trái của ảnh so với gốc toạ độ (trục X)"
                  >
                    <span className="text-[#5b6b82] font-semibold">X:</span>
                    <input
                      type="number"
                      step="0.01"
                      title="Vị trí góc dưới-trái của ảnh so với gốc toạ độ (trục X)"
                      value={Math.round((bgImage.panX ?? 0) * 100) / 100}
                      onChange={(e) =>
                        onUpdateBgImage?.((prev) => ({
                          ...prev,
                          panX: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="w-full bg-transparent text-[#16233a] focus:outline-none font-mono"
                    />
                    <span className="text-[9px] text-[#94a3b8]">cm</span>
                  </div>
                  <div
                    className="flex items-center gap-1 bg-white border border-[#dbe4ee] px-1.5 py-1 rounded text-[10px]"
                    title="Vị trí góc dưới-trái của ảnh so với gốc toạ độ (trục Y)"
                  >
                    <span className="text-[#5b6b82] font-semibold">Y:</span>
                    <input
                      type="number"
                      step="0.01"
                      title="Vị trí góc dưới-trái của ảnh so với gốc toạ độ (trục Y)"
                      value={Math.round((bgImage.panY ?? 0) * 100) / 100}
                      onChange={(e) =>
                        onUpdateBgImage?.((prev) => ({
                          ...prev,
                          panY: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="w-full bg-transparent text-[#16233a] focus:outline-none font-mono"
                    />
                    <span className="text-[9px] text-[#94a3b8]">cm</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom utility controls */}
      <div className="p-3 border-t border-[#dbe4ee] bg-white space-y-2.5">
        <label className="flex items-center gap-2 text-xs text-[#5b6b82] cursor-pointer hover:text-[#16233a] select-none">
          <input
            id="toggle-grid-checkbox"
            type="checkbox"
            checked={settings.showGrid}
            onChange={(e) => onUpdateSettings({ showGrid: e.target.checked })}
            className="w-3.5 h-3.5 rounded border-[#cbd5e1] text-[#2f5d99] accent-[#2f5d99] focus:ring-[#2f5d99]"
          />
          <span>Hiện lưới tọa độ</span>
        </label>

        <label className="flex items-center gap-2 text-xs text-[#5b6b82] cursor-pointer hover:text-[#16233a] select-none">
          <input
            id="toggle-snap-checkbox"
            type="checkbox"
            checked={settings.snapToGrid}
            onChange={(e) => onUpdateSettings({ snapToGrid: e.target.checked })}
            className="w-3.5 h-3.5 rounded border-[#cbd5e1] text-[#2f5d99] accent-[#2f5d99] focus:ring-[#2f5d99]"
          />
          <span>Bắt dính lưới</span>
        </label>

        <label className="flex items-center gap-2 text-xs text-[#5b6b82] cursor-pointer hover:text-[#16233a] select-none">
          <input
            id="toggle-axes-checkbox"
            type="checkbox"
            checked={settings.showAxes}
            onChange={(e) => onUpdateSettings({ showAxes: e.target.checked })}
            className="w-3.5 h-3.5 rounded border-[#cbd5e1] text-[#2f5d99] accent-[#2f5d99] focus:ring-[#2f5d99]"
          />
          <span>Hiện trục Oxy</span>
        </label>

        <div className="space-y-1 pt-2 border-t border-[#dbe4ee]">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#5b6b82]">Khoảng cách nhãn (tất cả điểm)</span>
            <span className="font-semibold text-[#2f5d99]">{globalLabelDistance}pt</span>
          </div>
          <input
            type="range"
            min={4}
            max={40}
            step={2}
            value={globalLabelDistance}
            onChange={(e) => onSetGlobalLabelDistance(Number(e.target.value))}
            className="w-full h-1.5 bg-[#dbe4ee] rounded-lg appearance-none cursor-pointer accent-[#2f5d99]"
          />
        </div>

        {/* Undo, Redo, Clear All in Bento button row */}
        <div className="flex gap-1.5 pt-1">
          <button
            id="undo-btn"
            onClick={onUndo}
            disabled={!canUndo}
            title="Hoàn tác (Ctrl+Z)"
            className={`flex-1 py-1.5 rounded text-[10px] font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-1 ${
              canUndo
                ? 'bg-[#eef2f6] text-[#16233a] hover:bg-[#e4ecf7]'
                : 'bg-[#f8fafc] text-[#94a3b8] cursor-not-allowed'
            }`}
          >
            <Undo2 className="w-3 h-3" />
            <span>HOÀN TÁC</span>
          </button>

          {canRedo && (
            <button
              id="redo-btn"
              onClick={onRedo}
              title="Làm lại (Ctrl+Y)"
              className="py-1.5 px-2 bg-[#eef2f6] text-[#16233a] hover:bg-[#e4ecf7] rounded text-[10px] font-bold tracking-wider uppercase transition-all flex items-center justify-center"
            >
              <Redo2 className="w-3 h-3" />
            </button>
          )}

          <button
            id="clear-all-btn"
            onClick={onClearAll}
            title="Xoá toàn bộ hình vẽ"
            className="flex-1 py-1.5 bg-[#eef2f6] hover:bg-[#fee2e2] text-[#b91c1c] rounded text-[10px] font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            <span>XOÁ HẾT</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

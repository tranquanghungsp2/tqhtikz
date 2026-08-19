import React, { useRef } from 'react';
import {
  Undo2,
  Redo2,
  Trash2,
  Image as ImageIcon,
  Move,
  Lock,
  Unlock,
  X,
  Upload,
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
        {/* Tuỳ chọn công cụ hiện tại — chỉ hiện khi đang chọn đúng công cụ liên quan.
            Các nút CHỌN công cụ giờ nằm ở thanh ngang GeometryToolbar phía trên canvas. */}
        {(activeTool === 'polyline' && polylineStepCount > 0) ||
        activeTool === 'rectangle' ||
        activeTool === 'regular_polygon' ||
        activeTool === 'param_arc' ||
        activeTool === 'bezier' ? (
          <div>
            <p className="text-[10px] font-semibold text-[#5b6b82] uppercase tracking-widest mb-1.5 px-1">
              Tuỳ chọn công cụ hiện tại
            </p>
            <div className="space-y-2">
              {activeTool === 'polyline' && polylineStepCount > 0 && (
                <div className="p-2 bg-[#fef3c7] rounded-md border border-[#f59e0b]/40 space-y-1.5">
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

              {activeTool === 'rectangle' && (
                <div className="flex rounded-md border border-[#dbe4ee] overflow-hidden">
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

              {activeTool === 'regular_polygon' && (
                <div className="p-2.5 bg-[#f8fafc] rounded-md border border-[#dbe4ee] space-y-2">
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

              {activeTool === 'param_arc' && (
                <div className="p-2.5 bg-[#f8fafc] rounded-md border border-[#dbe4ee] space-y-2.5">
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

              {activeTool === 'bezier' && (
                <div className="p-2.5 bg-[#f8fafc] rounded-md border border-[#dbe4ee] space-y-2">
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
            </div>
          </div>
        ) : null}

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
        {/* Toggle Chế độ vẽ */}
        <div className="space-y-1.5 pb-2 border-b border-[#dbe4ee]">
          <span className="text-[10px] font-semibold text-[#5b6b82] uppercase tracking-wider">
            Chế độ vẽ
          </span>
          <div className="flex bg-[#f1f5f9] p-0.5 rounded-md">
            <button
              id="drawing-mode-geometry"
              onClick={() => onUpdateSettings({ drawingMode: 'geometry' })}
              className={`flex-1 py-1 text-center text-xs font-semibold rounded-md transition-all ${
                settings.drawingMode === 'geometry'
                  ? 'bg-white text-[#2f5d99] shadow-2xs'
                  : 'text-[#5b6b82] hover:text-[#16233a]'
              }`}
            >
              Hình học
            </button>
            <button
              id="drawing-mode-tracing"
              onClick={() => onUpdateSettings({ drawingMode: 'tracing' })}
              className={`flex-1 py-1 text-center text-xs font-semibold rounded-md transition-all ${
                settings.drawingMode === 'tracing'
                  ? 'bg-white text-[#2f5d99] shadow-2xs'
                  : 'text-[#5b6b82] hover:text-[#16233a]'
              }`}
            >
              Đồ hình (Tracing)
            </button>
          </div>
        </div>

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

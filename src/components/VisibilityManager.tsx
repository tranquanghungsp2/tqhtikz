import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Eye, EyeOff, Layers, Circle } from 'lucide-react';
import { GeoPoint, GeoShape } from '../types';

interface VisibilityManagerProps {
  points: GeoPoint[];
  shapes: GeoShape[];
  onUpdatePoint: (id: string, updates: Partial<GeoPoint>) => void;
  onUpdateShape: (id: string, updates: Partial<GeoShape>) => void;
  onClose: () => void;
}

const getShapeName = (shape: GeoShape, pointsMap: Map<string, GeoPoint>): string => {
  switch (shape.type) {
    case 'segment': {
      const p1 = pointsMap.get(shape.pointIds[0])?.label || '?';
      const p2 = pointsMap.get(shape.pointIds[1])?.label || '?';
      return `Đoạn thẳng [${p1}${p2}]`;
    }
    case 'polyline': {
      const labelList = shape.pointIds.map(id => pointsMap.get(id)?.label || '?').join('');
      return `${shape.isClosed ? 'Đa giác' : 'Đường gấp khúc'} [${labelList}]`;
    }
    case 'circle': {
      const center = pointsMap.get(shape.centerId)?.label || '?';
      const radPt = pointsMap.get(shape.radiusPointId)?.label || '?';
      return `Đường tròn tâm ${center} qua ${radPt}`;
    }
    case 'ellipse': {
      const center = pointsMap.get(shape.centerId)?.label || '?';
      return `Hình ellipse tâm ${center}`;
    }
    case 'rectangle': {
      const p1 = pointsMap.get(shape.pointIds[0])?.label || '?';
      const p2 = pointsMap.get(shape.pointIds[1])?.label || '?';
      return `Hình chữ nhật chéo [${p1}, ${p2}]`;
    }
    case 'square': {
      const p1 = pointsMap.get(shape.pointIds[0])?.label || '?';
      const p2 = pointsMap.get(shape.pointIds[1])?.label || '?';
      return `Hình vuông [${p1}, ${p2}]`;
    }
    case 'rounded_rectangle': {
      const p1 = pointsMap.get(shape.pointIds[0])?.label || '?';
      const p2 = pointsMap.get(shape.pointIds[1])?.label || '?';
      return `Hình chữ nhật bo góc [${p1}, ${p2}]`;
    }
    case 'semicircle': {
      const center = pointsMap.get(shape.centerId)?.label || '?';
      return `Nửa đường tròn tâm ${center}`;
    }
    case 'semi_ellipse': {
      const center = pointsMap.get(shape.centerId)?.label || '?';
      return `Nửa ellipse tâm ${center}`;
    }
    case 'parabola': {
      const v = pointsMap.get(shape.vertexId)?.label || '?';
      return `Đường Parabol đỉnh ${v}`;
    }
    case 'hyperbola': {
      const center = pointsMap.get(shape.centerId)?.label || '?';
      return `Đường Hyperbol tâm ${center}`;
    }
    case 'regular_polygon': {
      const center = pointsMap.get(shape.centerId)?.label || '?';
      return `Đa giác đều ${shape.sides} cạnh tâm ${center}`;
    }
    case 'arc_3p': {
      const p1 = pointsMap.get(shape.pointIds[0])?.label || '?';
      const p2 = pointsMap.get(shape.pointIds[1])?.label || '?';
      const p3 = pointsMap.get(shape.pointIds[2])?.label || '?';
      return `Cung tròn qua [${p1}, ${p2}, ${p3}]`;
    }
    case 'param_arc': {
      const start = pointsMap.get(shape.startPointId)?.label || '?';
      return `Cung tròn tham số từ ${start}`;
    }
    case 'bezier': {
      const anchors = shape.anchorIds.map(id => pointsMap.get(id)?.label || '?').join('');
      return `Đường cong Bezier qua [${anchors}]`;
    }
    case 'parallel_line': {
      const through = pointsMap.get(shape.throughPointId)?.label || '?';
      return `Đường thẳng qua ${through} song song`;
    }
    case 'perpendicular_line': {
      const through = pointsMap.get(shape.throughPointId)?.label || '?';
      return `Đường thẳng qua ${through} vuông góc`;
    }
    default:
      return 'Hình vẽ';
  }
};

export const VisibilityManager: React.FC<VisibilityManagerProps> = ({
  points,
  shapes,
  onUpdatePoint,
  onUpdateShape,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'points' | 'shapes'>('points');
  const [searchQuery, setSearchQuery] = useState('');

  const pointsMap = new Map<string, GeoPoint>();
  points.forEach((p) => pointsMap.set(p.id, p));

  const filteredPoints = points.filter((p) => {
    const labelMatch = p.label?.toLowerCase().includes(searchQuery.toLowerCase());
    const coordsMatch = `(${p.x},${p.y})`.includes(searchQuery);
    return labelMatch || coordsMatch;
  });

  const filteredShapes = shapes.filter((s) => {
    const name = getShapeName(s, pointsMap);
    return name.toLowerCase().includes(searchQuery.toLowerCase()) || s.type.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.15 }}
        className="bg-white border border-[#dbe4ee] rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col h-[520px]"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#dbe4ee] flex items-center justify-between bg-[#f8fafc]">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#2f5d99]" />
            <h3 className="text-sm font-semibold text-[#16233a]">Quản lý ẩn / hiện</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#e2e8f0] text-[#5b6b82] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search and Tabs Bar */}
        <div className="p-3 border-b border-[#eef2f6] space-y-3 bg-[#ffffff] shrink-0">
          <div className="flex gap-1.5 p-0.5 bg-[#f1f5f9] rounded-lg">
            <button
              onClick={() => {
                setActiveTab('points');
                setSearchQuery('');
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'points'
                  ? 'bg-white text-[#16233a] shadow-xs'
                  : 'text-[#5b6b82] hover:text-[#16233a]'
              }`}
            >
              Điểm số ({points.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('shapes');
                setSearchQuery('');
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'shapes'
                  ? 'bg-white text-[#16233a] shadow-xs'
                  : 'text-[#5b6b82] hover:text-[#16233a]'
              }`}
            >
              Hình vẽ ({shapes.length})
            </button>
          </div>

          <input
            type="text"
            placeholder={activeTab === 'points' ? 'Tìm điểm theo tên, tọa độ...' : 'Tìm hình vẽ...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 text-xs border border-[#dbe4ee] rounded-lg focus:outline-none focus:border-[#2f5d99]"
          />
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 bg-[#fafbfd]">
          {activeTab === 'points' ? (
            filteredPoints.length === 0 ? (
              <div className="text-center py-12 text-xs text-[#94a3b8] italic">
                {points.length === 0 ? 'Chưa có điểm nào trong dự án.' : 'Không tìm thấy điểm phù hợp.'}
              </div>
            ) : (
              filteredPoints.map((pt) => {
                const isHidden = !!pt.hidden;
                return (
                  <div
                    key={pt.id}
                    className="flex items-center justify-between p-2.5 bg-white border border-[#eef2f6] rounded-lg hover:border-[#cbd5e1] transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center font-mono-code text-[11px] font-bold"
                        style={{
                          backgroundColor: pt.style?.color ? `${pt.style.color}15` : '#e4ecf7',
                          color: pt.style?.color || '#2f5d99',
                        }}
                      >
                        {pt.label || pt.id}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[#16233a]">
                          Điểm {pt.label || pt.id}
                        </div>
                        <div className="text-[10px] text-[#94a3b8] font-mono-code">
                          Tọa độ: ({pt.x.toFixed(2)}, {pt.y.toFixed(2)})
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onUpdatePoint(pt.id, { hidden: !isHidden })}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isHidden
                          ? 'bg-[#fee2e2] text-[#ef4444] hover:bg-[#fecaca]'
                          : 'bg-[#e2e8f0] text-[#475569] hover:bg-[#cbd5e1]'
                      }`}
                      title={isHidden ? 'Bị ẩn khỏi mã TikZ xuất ra (vẫn mờ trên canvas)' : 'Hiển thị đầy đủ'}
                    >
                      {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                );
              })
            )
          ) : filteredShapes.length === 0 ? (
            <div className="text-center py-12 text-xs text-[#94a3b8] italic">
              {shapes.length === 0 ? 'Chưa có hình vẽ nào.' : 'Không tìm thấy hình vẽ phù hợp.'}
            </div>
          ) : (
            filteredShapes.map((shape) => {
              const isHidden = !!shape.hidden;
              return (
                <div
                  key={shape.id}
                  className="flex items-center justify-between p-2.5 bg-white border border-[#eef2f6] rounded-lg hover:border-[#cbd5e1] transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${shape.style.color}15` }}
                    >
                      <Circle className="w-3.5 h-3.5" style={{ color: shape.style.color }} />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#16233a]">
                        {getShapeName(shape, pointsMap)}
                      </div>
                      <div className="text-[10px] text-[#94a3b8]">
                        Kiểu: {shape.type} • Màu nét: {shape.style.color}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onUpdateShape(shape.id, { hidden: !isHidden })}
                    className={`p-1.5 rounded-lg transition-colors ${
                      isHidden
                        ? 'bg-[#fee2e2] text-[#ef4444] hover:bg-[#fecaca]'
                        : 'bg-[#e2e8f0] text-[#475569] hover:bg-[#cbd5e1]'
                    }`}
                    title={isHidden ? 'Bị ẩn khỏi mã TikZ xuất ra (vẫn mờ trên canvas)' : 'Hiển thị đầy đủ'}
                  >
                    {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[#f8fafc] border-t border-[#dbe4ee] flex justify-between items-center shrink-0">
          <p className="text-[10px] text-[#94a3b8] max-w-[70%]">
            Mục bị ẩn sẽ mờ đi (0.35 opacity) trên canvas nhưng không xuất hiện trong mã TikZ xuất ra.
          </p>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-[#2f5d99] hover:bg-[#254a7a] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            Đóng
          </button>
        </div>
      </motion.div>
    </div>
  );
};

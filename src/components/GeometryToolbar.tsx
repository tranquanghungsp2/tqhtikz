import React, { useState, useRef } from 'react';
import { ToolType } from '../types';
import {
  MousePointer,
  GitCommit,
  CornerDownRight,
  Hexagon,
  Compass,
  Spline,
  Pipette,
  ChevronDown,
} from 'lucide-react';

interface GeometryToolbarProps {
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
}

interface ToolDef {
  id: ToolType;
  label: string;
  title: string;
  icon: React.ReactNode;
}

interface GroupDef {
  key: string;
  groupLabel: string;
  tools: ToolDef[];
}

const dotIcon = <span className="w-2 h-2 rounded-full bg-current shrink-0" />;
const dotOnLineIcon = <span className="w-2 h-2 rounded-full bg-current ring-2 ring-[#f59e0b] ring-offset-1 shrink-0" />;
const lineIcon = <span className="w-4 h-[2px] bg-current shrink-0" />;
const squareIcon = <span className="w-3.5 h-3.5 border-2 border-current shrink-0" />;
const rectIcon = <span className="w-4 h-3 border-2 border-current shrink-0" />;
const roundedRectIcon = <span className="w-4 h-3 border-2 border-current rounded-xs shrink-0" />;
const circleIcon = <span className="w-3.5 h-3.5 rounded-full border-2 border-current shrink-0" />;
const semicircleIcon = <span className="w-4 h-2 border-t-2 border-l-2 border-r-2 border-current rounded-t-full shrink-0" />;
const ellipseIcon = <span className="w-4 h-3 border-2 border-current rounded-[50%] shrink-0" />;
const semiEllipseIcon = <span className="w-4 h-2.5 border-t-2 border-l-2 border-r-2 border-current rounded-t-[50%] shrink-0" />;

const GROUPS: GroupDef[] = [
  {
    key: 'select',
    groupLabel: 'Chọn',
    tools: [
      { id: 'select', label: 'Con trỏ chọn', title: 'Kéo thả điểm để di chuyển, nhấp vào hình để chọn (phím tắt: V)', icon: <MousePointer className="w-4 h-4" /> },
    ],
  },
  {
    key: 'points',
    groupLabel: 'Điểm',
    tools: [
      { id: 'point', label: 'Điểm tự do', title: 'Nhấp chuột vào canvas để tạo điểm tự do', icon: dotIcon },
      { id: 'point_on_line', label: 'Điểm trên đường', title: 'Nhấp vào 1 đường có sẵn để tạo điểm luôn ràng buộc nằm trên đường đó', icon: dotOnLineIcon },
      { id: 'intersection', label: 'Giao điểm hình học', title: 'Tìm giao điểm giữa 2 hình học đã vẽ', icon: <GitCommit className="w-4 h-4" /> },
      { id: 'anchor_point', label: 'Điểm neo (pic anchor)', title: 'Nhấp vào 1 điểm có sẵn để đặt tên điểm neo — dùng khi xuất bản vẽ dạng pic', icon: <span className="font-mono text-xs">⚓</span> },
    ],
  },
  {
    key: 'lines',
    groupLabel: 'Đoạn thẳng',
    tools: [
      { id: 'segment', label: 'Đoạn thẳng', title: 'Nhấp điểm đầu, nhấp điểm cuối để tạo đoạn thẳng · Giữ Shift để bắt ngang/dọc', icon: lineIcon },
      { id: 'polyline', label: 'Đường gấp khúc', title: 'Nhấp liên tiếp nhiều điểm, nhấp điểm đầu để đóng hoặc bấm Hoàn thành', icon: <CornerDownRight className="w-4 h-4" /> },
      { id: 'parallel', label: 'Song song', title: 'Vẽ đường song song', icon: <span className="font-bold text-sm leading-none w-4 text-center">∥</span> },
      { id: 'perpendicular', label: 'Vuông góc', title: 'Vẽ đường vuông góc (tự động có ký hiệu vuông)', icon: <span className="font-bold text-sm leading-none w-4 text-center">⊥</span> },
    ],
  },
  {
    key: 'polygons',
    groupLabel: 'Đa giác',
    tools: [
      { id: 'regular_polygon', label: 'Đa giác đều', title: 'Đa giác đều (chỉnh số cạnh ở khung "Tuỳ chọn công cụ" bên trái)', icon: <Hexagon className="w-4 h-4" /> },
      { id: 'rectangle', label: 'Hình chữ nhật', title: 'Hình chữ nhật: Nhấp 2 góc đối diện', icon: rectIcon },
      { id: 'square', label: 'Hình vuông', title: 'Hình vuông: Nhấp 2 góc đối diện', icon: squareIcon },
      { id: 'rounded_rectangle', label: 'HCN bo góc', title: 'Hình chữ nhật bo góc: Nhấp 2 góc đối diện', icon: roundedRectIcon },
    ],
  },
  {
    key: 'circles',
    groupLabel: 'Đường tròn',
    tools: [
      { id: 'circle', label: 'Đường tròn', title: 'Đường tròn: Nhấp tâm, nhấp điểm bán kính', icon: circleIcon },
      { id: 'semicircle', label: 'Nửa đường tròn', title: 'Nửa đường tròn: Nhấp tâm, nhấp điểm xác định bán kính và hướng cắt', icon: semicircleIcon },
      { id: 'ellipse', label: 'Elip', title: 'Elip: Nhấp tâm, nhấp bán trục ngang, nhấp bán trục dọc', icon: ellipseIcon },
      { id: 'semi_ellipse', label: 'Nửa elip', title: 'Nửa elip: Nhấp tâm, nhấp bán trục cắt, nhấp hướng phình', icon: semiEllipseIcon },
    ],
  },
  {
    key: 'curves',
    groupLabel: 'Cung / Bezier',
    tools: [
      { id: 'arc_3p', label: 'Cung tròn qua 3 điểm', title: 'Cung tròn ngoại tiếp qua 3 điểm', icon: <Compass className="w-4 h-4" /> },
      { id: 'param_arc', label: 'Cung tròn (góc, bán kính)', title: 'Cung tròn theo góc bắt đầu/kết thúc + bán kính (chỉnh ở khung bên trái)', icon: <span className="font-mono text-xs font-bold w-4 text-center">⌒</span> },
      { id: 'bezier', label: 'Đường cong Bezier', title: 'Đường cong Bezier với điểm uốn', icon: <Spline className="w-4 h-4" /> },
      { id: 'parabola', label: 'Parabol', title: 'Parabol: Nhấp đỉnh, nhấp 1 điểm parabol đi qua', icon: <span className="font-mono text-xs font-bold w-4 text-center">∪</span> },
      { id: 'hyperbola', label: 'Hypecbol', title: 'Hypecbol: Nhấp tâm đối xứng, nhấp điểm xác định độ mở 2 nhánh', icon: <span className="font-mono text-xs font-bold w-4 text-center">)(</span> },
    ],
  },
  {
    key: 'angles',
    groupLabel: 'Góc & nhãn',
    tools: [
      { id: 'right_angle_mark', label: 'Ký hiệu góc vuông (3 điểm)', title: 'Ký hiệu góc vuông: chọn điểm 1, đỉnh góc vuông, điểm 2', icon: <span className="font-mono text-xs font-bold w-4 text-center">⌐</span> },
      { id: 'path_segment_label', label: 'Nhãn trên đoạn (2 điểm)', title: 'Ghi nhãn dán trên đoạn thẳng giữa 2 điểm', icon: <span className="font-mono text-xs font-bold w-4 text-center">⇎</span> },
      { id: 'path_offset_label', label: 'Nhãn góc / lệch (1 điểm)', title: 'Ghi chú nhãn lệch / nhãn góc từ 1 điểm', icon: <span className="font-mono text-xs font-bold w-4 text-center">∡</span> },
    ],
  },
  {
    key: 'misc',
    groupLabel: 'Đo & khác',
    tools: [
      { id: 'measure', label: 'Đo & chia đoạn', title: 'Đo khoảng cách giữa 2 điểm, chia đôi/chia 3/chia 4', icon: <span className="font-mono text-xs font-bold w-4 text-center">↔</span> },
      { id: 'eyedropper', label: 'Lấy mã màu ảnh', title: 'Nhấp vào ảnh nền để lấy mã màu tại vị trí đó (cần đã tải ảnh nền)', icon: <Pipette className="w-4 h-4" /> },
      { id: 'toggle_visibility', label: 'Ẩn/Hiện đối tượng', title: 'Bấm vào 1 điểm hoặc hình để ẩn/hiện (ẩn = không xuất mã TikZ, vẫn mờ trên canvas)', icon: <span className="w-4 h-4 flex items-center justify-center">👁️</span> },
    ],
  },
];

export const GeometryToolbar: React.FC<GeometryToolbarProps> = ({ activeTool, onSelectTool }) => {
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [lastUsedByGroup, setLastUsedByGroup] = useState<Record<string, ToolType>>({});
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = (key: string) => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setHoveredGroup(key);
  };
  const handleLeave = () => {
    closeTimerRef.current = setTimeout(() => setHoveredGroup(null), 120);
  };

  const pickTool = (groupKey: string, tool: ToolType) => {
    setLastUsedByGroup((prev) => ({ ...prev, [groupKey]: tool }));
    onSelectTool(tool);
    setHoveredGroup(null);
  };

  return (
    <div className="h-12 shrink-0 bg-white border-b border-[#dbe4ee] flex items-center px-2 gap-1 select-none z-20 shadow-[0_1px_4px_rgba(22,35,58,0.03)]">
      {GROUPS.map((group) => {
        const activeInGroup = group.tools.find((t) => t.id === activeTool);
        const displayTool =
          activeInGroup || group.tools.find((t) => t.id === lastUsedByGroup[group.key]) || group.tools[0];
        const isGroupActive = !!activeInGroup;
        const hasFlyout = group.tools.length > 1;

        return (
          <div
            key={group.key}
            className="relative"
            onMouseEnter={() => hasFlyout && handleEnter(group.key)}
            onMouseLeave={() => hasFlyout && handleLeave()}
          >
            <button
              onClick={() => pickTool(group.key, displayTool.id)}
              title={displayTool.title}
              className={`flex items-center gap-1 px-2.5 h-9 rounded-md text-xs font-medium transition-all ${
                isGroupActive
                  ? 'bg-[#e4ecf7] text-[#2f5d99] font-semibold ring-1 ring-[#2f5d99]/20'
                  : 'text-[#16233a] hover:bg-[#f1f5f9]'
              }`}
            >
              <span className="flex items-center justify-center w-4 h-4">{displayTool.icon}</span>
              <span className="hidden lg:inline whitespace-nowrap">{group.groupLabel}</span>
              {hasFlyout && <ChevronDown className="w-3 h-3 text-[#94a3b8]" />}
            </button>

            {hasFlyout && hoveredGroup === group.key && (
              <div
                className="absolute top-full left-0 mt-0.5 w-56 bg-white border border-[#dbe4ee] rounded-md shadow-lg py-1 z-30 animate-in fade-in slide-in-from-top-1 duration-100"
                onMouseEnter={() => handleEnter(group.key)}
                onMouseLeave={handleLeave}
              >
                {group.tools.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => pickTool(group.key, tool.id)}
                    title={tool.title}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-medium text-left transition-colors ${
                      activeTool === tool.id
                        ? 'bg-[#e4ecf7] text-[#2f5d99] font-semibold'
                        : 'text-[#16233a] hover:bg-[#f1f5f9]'
                    }`}
                  >
                    <span className="flex items-center justify-center w-4 h-4 shrink-0">{tool.icon}</span>
                    <span>{tool.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

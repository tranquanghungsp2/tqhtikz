import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  RotateCcw,
  Pipette,
  Check,
  MousePointer,
  X,
} from 'lucide-react';
import {
  GeoPoint,
  GeoShape,
  ToolType,
  Viewport,
  AppSettings,
  BezierControlPoint,
  BackgroundImageState,
  PathAnnotation,
} from '../types';
import {
  worldToScreen,
  screenToWorld,
  snapCoord,
  dist,
  closestPointOnSegment,
  findNearestPoint,
  getArc3PSvgPath,
  getRegularPolygonVertices,
  computeParallelEndPoint,
  computePerpendicularEndPoint,
  getRightAngleMark,
  findShapeIntersections,
  getClickedEdge,
  getClickedEdgeIndex,
  getEdgeByIndex,
  getShapeEdges,
  findEdgeShapeIntersections,
  intersectEdgeEdge,
  generateDefaultBezierControls,
  getSemicirclePoints,
  getSemiEllipsePoints,
  getParabolaPoints,
  getHyperbolaPoints,
  getParamArcPoints,
  formatCm,
  ChainPieceInfo,
  findChainOrder,
  isChainClosed,
  getShapeChainEndpoints,
  generatePointLabel,
} from '../utils/geometry';
import { getMathLabel } from '../utils/tikzExport';
import { renderLatexToHtml } from '../utils/latexRender';

interface CanvasProps {
  points: GeoPoint[];
  shapes: GeoShape[];
  selectedPointId: string | null;
  selectedShapeId: string | null;
  activeTool: ToolType;
  settings: AppSettings;
  polygonSides: number;
  rectangleMode?: 'shape' | 'points';
  bezierSegments: number;
  bezierClosed: boolean;
  paramArcStartPointId: string | null;
  onSetParamArcStartPointId: (id: string | null) => void;
  arcStartAngle: number;
  arcEndAngle: number;
  arcRadius: number;
  pickingArcRadius: boolean;
  radiusPickPoints: GeoPoint[];
  onSetRadiusPickPoints: (pts: GeoPoint[]) => void;
  onSelectPoint: (id: string | null) => void;
  onSelectShape: (id: string | null) => void;
  onSelectTool: (tool: ToolType) => void;
  onAddPoint: (point: GeoPoint) => void;
  onUpdatePointCoord: (id: string, x: number, y: number) => void;
  onUpdatePoint: (id: string, updates: Partial<GeoPoint>) => void;
  onAddShape: (shape: GeoShape) => void;
  onUpdateShape: (id: string, updates: Partial<GeoShape>) => void;
  nextPointLabel: string;
  svgRef: React.RefObject<SVGSVGElement | null>;
  polylinePoints: string[];
  onSetPolylinePoints: (pts: string[]) => void;
  onFinishPolyline: () => void;
  bgImage?: BackgroundImageState;
  onUpdateBgImage?: React.Dispatch<React.SetStateAction<BackgroundImageState>>;
  globalLabelDistance: number;
  pathAnnotations: PathAnnotation[];
  selectedPathAnnotationId: string | null;
  onSelectPathAnnotation: (id: string | null) => void;
  onAddPathAnnotation: (ann: PathAnnotation) => void;
}

export const Canvas: React.FC<CanvasProps> = ({
  points,
  shapes,
  selectedPointId,
  selectedShapeId,
  activeTool,
  settings,
  polygonSides,
  rectangleMode = 'shape',
  bezierSegments,
  bezierClosed,
  paramArcStartPointId,
  onSetParamArcStartPointId,
  arcStartAngle,
  arcEndAngle,
  arcRadius,
  pickingArcRadius,
  radiusPickPoints,
  onSetRadiusPickPoints,
  onSelectPoint,
  onSelectShape,
  onSelectTool,
  onAddPoint,
  onUpdatePointCoord,
  onUpdatePoint,
  onAddShape,
  onUpdateShape,
  nextPointLabel,
  svgRef,
  polylinePoints,
  onSetPolylinePoints,
  onFinishPolyline,
  bgImage,
  onUpdateBgImage,
  globalLabelDistance,
  pathAnnotations,
  selectedPathAnnotationId,
  onSelectPathAnnotation,
  onAddPathAnnotation,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Viewport: panX, panY in px, scale in px/cm (default 40 px/cm)
  const [viewport, setViewport] = useState<Viewport>({
    panX: 0,
    panY: 0,
    scale: 40,
    width: 800,
    height: 600,
  });

  // Track mouse coordinates (both screen px and world cm)
  const [mousePos, setMousePos] = useState<{ sx: number; sy: number; wx: number; wy: number }>({
    sx: 0,
    sy: 0,
    wx: 0,
    wy: 0,
  });

  // Interaction States
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [pendingPanStart, setPendingPanStart] = useState<{
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);
  const [isDraggingBg, setIsDraggingBg] = useState(false);
  const [bgDragStart, setBgDragStart] = useState<{
    wx: number;
    wy: number;
    initialPanX: number;
    initialPanY: number;
  }>({ wx: 0, wy: 0, initialPanX: 0, initialPanY: 0 });
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
  const [draggingLabelPointId, setDraggingLabelPointId] = useState<string | null>(null);
  const [draggingControl, setDraggingControl] = useState<{
    shapeId: string;
    segIndex: number;
    cpIndex: 0 | 1;
  } | null>(null);
  const [draggingShapeId, setDraggingShapeId] = useState<string | null>(null);
  const [shapeDragStart, setShapeDragStart] = useState<{
    wx: number;
    wy: number;
    pointSnapshots: Array<{ id: string; x: number; y: number }>;
    controlsSnapshot?: Array<[BezierControlPoint, BezierControlPoint]>;
  } | null>(null);

  // Tool-specific creation step states
  const [tempPoints, setTempPoints] = useState<GeoPoint[]>([]);

  // Hộp nhập nội dung nhãn \path — hiện ra SAU KHI đã chọn xong điểm (2 điểm cho nhãn đoạn,
  // 1 điểm cho nhãn góc/lệch tâm), thay vì tạo nhãn ngay với text mặc định.
  const [pendingPathAnnotation, setPendingPathAnnotation] = useState<
    | { kind: 'segment_label'; point1Id: string; point2Id: string; screenX: number; screenY: number }
    | { kind: 'point_offset_label'; pointId: string; screenX: number; screenY: number }
    | null
  >(null);
  const [pendingLabelText, setPendingLabelText] = useState('');
  const pendingLabelInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (pendingPathAnnotation) {
      requestAnimationFrame(() => pendingLabelInputRef.current?.focus());
    }
  }, [pendingPathAnnotation]);

  const confirmPendingPathAnnotation = useCallback(() => {
    if (!pendingPathAnnotation) return;
    const text = pendingLabelText.trim();
    if (!text) {
      setPendingPathAnnotation(null);
      setPendingLabelText('');
      return;
    }
    if (pendingPathAnnotation.kind === 'segment_label') {
      onAddPathAnnotation({
        id: `pa_seg_${Date.now()}`,
        type: 'segment_label',
        point1Id: pendingPathAnnotation.point1Id,
        point2Id: pendingPathAnnotation.point2Id,
        text,
        pos: 0.5,
        positionOption: 'above',
      });
    } else {
      onAddPathAnnotation({
        id: `pa_off_${Date.now()}`,
        type: 'point_offset_label',
        pointId: pendingPathAnnotation.pointId,
        text,
        angle: 30,
        distancePt: 20,
      });
    }
    setPendingPathAnnotation(null);
    setPendingLabelText('');
    onSelectTool('select');
  }, [pendingPathAnnotation, pendingLabelText, onAddPathAnnotation, onSelectTool]);

  const cancelPendingPathAnnotation = useCallback(() => {
    setPendingPathAnnotation(null);
    setPendingLabelText('');
    onSelectTool('select');
  }, [onSelectTool]);
  const [selectedRefShapeId, setSelectedRefShapeId] = useState<string | null>(null);
  const [axisRef, setAxisRef] = useState<'x' | 'y' | null>(null);
  const [intersectionSelectedShape1, setIntersectionSelectedShape1] = useState<string | null>(null);
  const [intersectionEdgeIndex1, setIntersectionEdgeIndex1] = useState<number | null>(null);
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);
  const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>([]);
  const [pickedColor, setPickedColor] = useState<{ hex: string; r: number; g: number; b: number } | null>(null);
  const [colorCopied, setColorCopied] = useState(false);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const LEGACY_LABEL_POS_TO_ANGLE: Record<string, number> = {
    above: 90,
    below: -90,
    left: 180,
    right: 0,
    'above left': 135,
    'above right': 45,
    'below left': -135,
    'below right': -45,
    auto: 45,
  };

  // ----------------------------------------------------
  // Render Path Annotations (Nhãn ghi chú)
  // ----------------------------------------------------
  const renderPathAnnotations = () => {
    const pointsMap = new Map<string, GeoPoint>();
    points.forEach((p) => pointsMap.set(p.id, p));

    return pathAnnotations.map((item) => {
      const isSelected = selectedPathAnnotationId === item.id;
      
      if (item.type === 'segment_label') {
        const p1 = pointsMap.get(item.point1Id);
        const p2 = pointsMap.get(item.point2Id);
        if (!p1 || !p2) return null;

        const s1 = worldToScreen(p1.x, p1.y, viewport);
        const s2 = worldToScreen(p2.x, p2.y, viewport);

        const posVal = item.pos !== undefined ? item.pos : 0.5;
        const lx = s1.x + posVal * (s2.x - s1.x);
        const ly = s1.y + posVal * (s2.y - s1.y);

        const getDisplayOffset = (opt?: string) => {
          const distVal = 16;
          switch (opt) {
            case 'above': return { dx: 0, dy: -distVal };
            case 'below': return { dx: 0, dy: distVal };
            case 'left': return { dx: -distVal * 1.5, dy: 4 };
            case 'right': return { dx: distVal * 1.5, dy: 4 };
            case 'above left': return { dx: -distVal, dy: -distVal };
            case 'above right': return { dx: distVal, dy: -distVal };
            case 'below left': return { dx: -distVal, dy: distVal };
            case 'below right': return { dx: distVal, dy: distVal };
            default: return { dx: 0, dy: -distVal };
          }
        };

        const { dx, dy } = getDisplayOffset(item.positionOption);
        const tx = lx + dx;
        const ty = ly + dy;

        return (
          <g
            key={item.id}
            className="cursor-pointer select-none"
            onClick={(e) => {
              e.stopPropagation();
              onSelectPathAnnotation(item.id);
              onSelectPoint(null);
              onSelectShape(null);
            }}
          >
            <line
              x1={s1.x}
              y1={s1.y}
              x2={s2.x}
              y2={s2.y}
              stroke={isSelected ? '#3b82f6' : '#94a3b8'}
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.6}
            />

            <foreignObject
              x={tx - 40}
              y={ty - 12}
              width={80}
              height={24}
              style={{ pointerEvents: 'none', overflow: 'visible' }}
            >
              <div
                {...({ xmlns: 'http://www.w3.org/1999/xhtml' } as any)}
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                  color: isSelected ? '#1d4ed8' : '#334155',
                }}
                dangerouslySetInnerHTML={{ __html: renderLatexToHtml(item.text) }}
              />
            </foreignObject>
          </g>
        );
      } else if (item.type === 'point_offset_label') {
        const pt = pointsMap.get(item.pointId);
        if (!pt) return null;

        const s = worldToScreen(pt.x, pt.y, viewport);
        const rad = (item.angle * Math.PI) / 180;
        const distPx = item.distancePt ?? 20;

        const tx = s.x + distPx * Math.cos(rad);
        const ty = s.y - distPx * Math.sin(rad);

        return (
          <g
            key={item.id}
            className="cursor-pointer select-none"
            onClick={(e) => {
              e.stopPropagation();
              onSelectPathAnnotation(item.id);
              onSelectPoint(null);
              onSelectShape(null);
            }}
          >
            <line
              x1={s.x}
              y1={s.y}
              x2={tx}
              y2={ty}
              stroke={isSelected ? '#3b82f6' : '#94a3b8'}
              strokeWidth={1}
              strokeDasharray="2 2"
              opacity={0.6}
            />

            <circle
              cx={tx}
              cy={ty}
              r={3}
              fill={isSelected ? '#3b82f6' : '#94a3b8'}
            />

            <foreignObject
              x={tx - 36}
              y={ty - 12}
              width={72}
              height={24}
              style={{ pointerEvents: 'none', overflow: 'visible' }}
            >
              <div
                {...({ xmlns: 'http://www.w3.org/1999/xhtml' } as any)}
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                  color: isSelected ? '#1d4ed8' : '#334155',
                }}
                dangerouslySetInnerHTML={{ __html: renderLatexToHtml(item.text) }}
              />
            </foreignObject>
          </g>
        );
      }

      return null;
    });
  };

  const getPointLabelAngleDistance = (pt: GeoPoint): { angle: number; distance: number } => {
    const angle =
      pt.labelAngleDeg !== undefined
        ? pt.labelAngleDeg
        : LEGACY_LABEL_POS_TO_ANGLE[pt.labelPos || 'auto'] ?? 45;
    const distance = pt.labelDistance !== undefined ? pt.labelDistance : globalLabelDistance;
    return { angle, distance };
  };

  // Measure container size
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setViewport((prev) => ({
          ...prev,
          width: clientWidth,
          height: clientHeight,
        }));
      }
    };
    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!bgImage?.dataUrl) return;
    const img = new Image();
    img.onload = () => {
      if (!sampleCanvasRef.current) sampleCanvasRef.current = document.createElement('canvas');
      sampleCanvasRef.current.width = img.naturalWidth;
      sampleCanvasRef.current.height = img.naturalHeight;
      const ctx = sampleCanvasRef.current.getContext('2d');
      ctx?.drawImage(img, 0, 0);
    };
    img.src = bgImage.dataUrl;
  }, [bgImage?.dataUrl]);

  // Reset temp creation states when tool changes
  useEffect(() => {
    setTempPoints([]);
    setSelectedRefShapeId(null);
    setAxisRef(null);
    setIntersectionSelectedShape1(null);
    setIntersectionEdgeIndex1(null);
    setMultiSelectedIds([]);
    setPickedColor(null);
    setColorCopied(false);
    onSetParamArcStartPointId(null);
    onSetRadiusPickPoints([]);
  }, [activeTool, onSetParamArcStartPointId, onSetRadiusPickPoints]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMultiSelectedIds([]);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Points map for fast lookup
  const pointsMap = new Map<string, GeoPoint>();
  points.forEach((p) => pointsMap.set(p.id, p));

  // ----------------------------------------------------
  // Coordinate & Snapping Helpers
  // ----------------------------------------------------
  const getPointerWorldCoord = useCallback(
    (e: React.MouseEvent<SVGSVGElement>): { wx: number; wy: number; sx: number; sy: number } => {
      if (!svgRef.current) return { wx: 0, wy: 0, sx: 0, sy: 0 };
      const rect = svgRef.current.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = screenToWorld(sx, sy, viewport);
      let wx = world.x;
      let wy = world.y;
      if (settings.snapToGrid) {
        wx = snapCoord(wx, settings.gridStep);
        wy = snapCoord(wy, settings.gridStep);
      }
      return { wx, wy, sx, sy };
    },
    [viewport, settings.snapToGrid, settings.gridStep, svgRef]
  );

  // Helper to obtain or create a point at clicked location
  const getOrCreatePoint = useCallback(
    (sx: number, sy: number, wx: number, wy: number): GeoPoint => {
      const nearest = findNearestPoint(sx, sy, points, viewport, 12);
      if (nearest) return nearest;

      const newPoint: GeoPoint = {
        id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        label: nextPointLabel,
        x: wx,
        y: wy,
        labelPos: 'auto',
        style: { color: '#16233a', pointStyle: 'dot' },
      };
      onAddPoint(newPoint);
      return newPoint;
    },
    [points, viewport, nextPointLabel, onAddPoint]
  );

  // Trả về id các điểm định nghĩa hình — dùng để kéo cả hình.
  // Với parallel_line/perpendicular_line: CHỈ trả throughPointId, vì endPointId luôn
  // được App.tsx tự tính lại theo ràng buộc song song/vuông góc mỗi khi throughPoint
  // di chuyển — không cần (và không nên) tự set endPointId ở đây.
  // Với bezier: không trả anchor kèm control point ở đây — control points là toạ độ
  // nhúng thẳng trong shape (không phải id điểm riêng), xử lý tách trong controlsSnapshot.
  const getShapeDefiningPointIds = (shape: GeoShape): string[] => {
    switch (shape.type) {
      case 'segment':
      case 'rectangle':
      case 'rounded_rectangle':
      case 'square':
        return [...shape.pointIds];
      case 'polyline':
        return [...shape.pointIds];
      case 'circle':
      case 'semicircle':
        return [shape.centerId, shape.radiusPointId];
      case 'ellipse':
      case 'semi_ellipse':
        return [shape.centerId, shape.rxPointId, shape.ryPointId];
      case 'parabola':
        return [shape.vertexId, shape.throughId];
      case 'hyperbola':
        return [shape.centerId, shape.pointId];
      case 'regular_polygon':
        return [shape.centerId, shape.vertexId];
      case 'arc_3p':
        return [...shape.pointIds];
      case 'param_arc':
        return [shape.startPointId, shape.endPointId];
      case 'bezier':
        return [...shape.anchorIds];
      case 'parallel_line':
      case 'perpendicular_line':
        return [shape.throughPointId];
      default:
        return [];
    }
  };

  // Trả về 2 điểm định hướng của đường chuẩn hiện tại — hỗ trợ cả trục Ox/Oy
  // lẫn bất kỳ loại đường nào có 2 điểm (segment, parallel_line, perpendicular_line).
  const resolveRefLinePoints = (): { p1: { x: number; y: number }; p2: { x: number; y: number } } | null => {
    if (axisRef === 'x') return { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } };
    if (axisRef === 'y') return { p1: { x: 0, y: 0 }, p2: { x: 0, y: 1 } };
    if (!selectedRefShapeId) return null;
    const refShape = shapes.find((s) => s.id === selectedRefShapeId);
    if (!refShape) return null;
    if (refShape.type === 'segment') {
      const p1 = pointsMap.get(refShape.pointIds[0]);
      const p2 = pointsMap.get(refShape.pointIds[1]);
      if (p1 && p2) return { p1, p2 };
    }
    if (refShape.type === 'parallel_line' || refShape.type === 'perpendicular_line') {
      const p1 = pointsMap.get(refShape.throughPointId);
      const p2 = pointsMap.get(refShape.endPointId);
      if (p1 && p2) return { p1, p2 };
    }
    return null;
  };

  // Quy đổi toạ độ world (cm) sang vị trí tương đối trong ảnh nền, rồi đọc đúng pixel
  // từ canvas ẩn đã vẽ sẵn ảnh gốc. Trả về null nếu bấm ra ngoài vùng ảnh.
  const sampleBgColorAt = (wx: number, wy: number): { hex: string; r: number; g: number; b: number } | null => {
    if (!bgImage?.dataUrl || !sampleCanvasRef.current) return null;
    const baseWidthCm = 10 * (bgImage.scale ?? 1);
    const baseHeightCm = baseWidthCm * (bgImage.naturalAspect || 1);
    const relX = (wx - (bgImage.panX ?? 0)) / baseWidthCm;
    const relY = (wy - (bgImage.panY ?? 0)) / baseHeightCm;
    if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return null;

    const canvas = sampleCanvasRef.current;
    const px = Math.min(canvas.width - 1, Math.max(0, Math.floor(relX * canvas.width)));
    const py = Math.min(canvas.height - 1, Math.max(0, Math.floor((1 - relY) * canvas.height)));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const data = ctx.getImageData(px, py, 1, 1).data;
    const r = data[0];
    const g = data[1];
    const b = data[2];
    const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
    return { hex, r, g, b };
  };

  const MERGEABLE_TYPES = new Set(['segment', 'parallel_line', 'perpendicular_line', 'polyline', 'bezier', 'arc_3p', 'param_arc']);

  const checkMergeEligibility = (): { canMerge: boolean; reason?: string; joiningExisting?: boolean } => {
    if (multiSelectedIds.length < 2) return { canMerge: false };
    const selected = multiSelectedIds.map((id) => shapes.find((s) => s.id === id)).filter(Boolean) as GeoShape[];
    if (selected.length !== multiSelectedIds.length) return { canMerge: false, reason: 'Có hình không hợp lệ' };
    if (!selected.every((s) => MERGEABLE_TYPES.has(s.type))) {
      return { canMerge: false, reason: 'Chỉ gộp được các đường thẳng, đường gấp khúc, Bezier, hoặc cung tròn' };
    }
    const first = selected[0];
    const sameStyle = selected.every(
      (s) =>
        s.style.color === first.style.color &&
        s.style.strokeWidth === first.style.strokeWidth &&
        s.style.dashPattern === first.style.dashPattern
    );
    if (!sameStyle) return { canMerge: false, reason: 'Các đường phải cùng màu, độ dày và kiểu nét' };
    const joiningExisting = selected.some((s) => !!s.mergeGroupId);
    return { canMerge: true, joiningExisting };
  };

  const handleMergeSelected = () => {
    const selectedShapesObjs = multiSelectedIds
      .map((id) => shapes.find((s) => s.id === id))
      .filter(Boolean) as GeoShape[];
    // Nếu trong lựa chọn hiện tại đã có sẵn 1 hình thuộc 1 nhóm gộp cũ, TÁI SỬ DỤNG đúng
    // mergeGroupId đó thay vì tạo nhóm mới — nhờ vậy chỉ cần Ctrl+click 1 đại diện của nhóm
    // cũ + (các) đường mới muốn thêm vào, không cần tick lại toàn bộ thành viên cũ.
    const existingGroupId = selectedShapesObjs.find((s) => s.mergeGroupId)?.mergeGroupId;
    const groupId = existingGroupId ?? `merge_${Date.now()}`;
    multiSelectedIds.forEach((id) => onUpdateShape(id, { mergeGroupId: groupId }));
    setMultiSelectedIds([]);
  };

  const handleUnmergeShape = (shapeId: string) => {
    onUpdateShape(shapeId, { mergeGroupId: undefined });
  };

  const CHAINABLE_TYPES = new Set(['segment', 'parallel_line', 'perpendicular_line', 'polyline', 'bezier', 'arc_3p', 'param_arc']);

  const checkChainEligibility = (): { canChain: boolean; reason?: string; closed?: boolean } => {
    if (multiSelectedIds.length < 2) return { canChain: false };
    const selected = multiSelectedIds.map((id) => shapes.find((s) => s.id === id)).filter(Boolean) as GeoShape[];
    if (selected.length !== multiSelectedIds.length) return { canChain: false, reason: 'Có hình không hợp lệ' };
    if (!selected.every((s) => CHAINABLE_TYPES.has(s.type))) {
      return { canChain: false, reason: 'Chỉ nối được đoạn thẳng / Bezier hở / cung tròn / gấp khúc hở' };
    }
    const first = selected[0];
    const sameStyle = selected.every(
      (s) =>
        s.style.color === first.style.color &&
        s.style.strokeWidth === first.style.strokeWidth &&
        s.style.dashPattern === first.style.dashPattern
    );
    if (!sameStyle) return { canChain: false, reason: 'Các mảnh phải cùng màu, độ dày và kiểu nét' };

    const pieces = selected
      .map((s) => {
        const ep = getShapeChainEndpoints(s, pointsMap);
        return ep ? { id: s.id, start: ep.start, end: ep.end } : null;
      })
      .filter(Boolean) as ChainPieceInfo[];
    if (pieces.length !== selected.length) return { canChain: false, reason: 'Có mảnh không xác định được 2 đầu' };

    const order = findChainOrder(pieces);
    if (!order) return { canChain: false, reason: 'Các đầu mút không khớp nhau — không nối được thành 1 chuỗi' };

    return { canChain: true, closed: isChainClosed(pieces, order) };
  };

  const handleChainSelected = () => {
    const selectedShapesObjs = multiSelectedIds.map((id) => shapes.find((s) => s.id === id)).filter(Boolean) as GeoShape[];
    const existingChainId = selectedShapesObjs.find((s) => s.chainGroupId)?.chainGroupId;
    const groupId = existingChainId ?? `chain_${Date.now()}`;
    multiSelectedIds.forEach((id) => onUpdateShape(id, { chainGroupId: groupId }));
    setMultiSelectedIds([]);
  };

  // Tìm điểm gần nhất TRÊN các đường có sẵn (segment/parallel_line/perpendicular_line),
  // trong bán kính 14px màn hình. Dùng khi chọn "điểm đi qua" cho tool song song/vuông góc.
  const findPointOnAnyLine = (sx: number, sy: number): { x: number; y: number } | null => {
    const rawWorld = screenToWorld(sx, sy, viewport);
    let best: { x: number; y: number } | null = null;
    let bestDistPx = 14;
    for (const s of shapes) {
      let a: GeoPoint | undefined;
      let b: GeoPoint | undefined;
      if (s.type === 'segment') {
        a = pointsMap.get(s.pointIds[0]);
        b = pointsMap.get(s.pointIds[1]);
      } else if (s.type === 'parallel_line' || s.type === 'perpendicular_line') {
        a = pointsMap.get(s.throughPointId);
        b = pointsMap.get(s.endPointId);
      }
      if (!a || !b) continue;
      const proj = closestPointOnSegment(rawWorld, a, b);
      const sProj = worldToScreen(proj.x, proj.y, viewport);
      const d = Math.hypot(sProj.x - sx, sProj.y - sy);
      if (d < bestDistPx) {
        bestDistPx = d;
        best = proj;
      }
    }
    return best;
  };

  const EDGE_SHAPE_TYPES = new Set(['rectangle', 'rounded_rectangle', 'square', 'polyline']);

  // Giống findPointOnAnyLine, nhưng trả thêm shapeId và tham số t để tạo điểm RÀNG BUỘC
  // (dùng riêng cho tool "Điểm trên đường", khác với snap một lần của tool song song/vuông góc).
  const findLineForConstrainedPoint = (
    sx: number,
    sy: number
  ): { x: number; y: number; shapeId: string; t: number; edgeIndex?: number } | null => {
    // Cố ý KHÔNG dùng wx/wy đã bị snap lưới — điểm trên đường luôn cần bám chính xác
    // theo vị trí chuột thật, việc bắt lưới ở đây sẽ làm sai lệch phép chiếu lên đường.
    const rawWorld = screenToWorld(sx, sy, viewport);
    let best: { x: number; y: number; shapeId: string; t: number; edgeIndex?: number } | null = null;
    let bestDistPx = 14; // đồng bộ ngưỡng với findNearestPoint (14px) cho dễ bắt hơn

    const evaluateSegment = (a: { x: number; y: number }, b: { x: number; y: number }, shapeId: string, edgeIndex?: number) => {
      const proj = closestPointOnSegment(rawWorld, a, b);
      const sProj = worldToScreen(proj.x, proj.y, viewport);
      const d = Math.hypot(sProj.x - sx, sProj.y - sy);
      if (d < bestDistPx) {
        const abx = b.x - a.x;
        const aby = b.y - a.y;
        const len2 = abx * abx + aby * aby || 1;
        const t = ((proj.x - a.x) * abx + (proj.y - a.y) * aby) / len2;
        bestDistPx = d;
        best = { x: proj.x, y: proj.y, shapeId, t, edgeIndex };
      }
    };

    for (const s of shapes) {
      if (s.type === 'segment') {
        const a = pointsMap.get(s.pointIds[0]);
        const b = pointsMap.get(s.pointIds[1]);
        if (a && b) evaluateSegment(a, b, s.id);
      } else if (s.type === 'parallel_line' || s.type === 'perpendicular_line') {
        const a = pointsMap.get(s.throughPointId);
        const b = pointsMap.get(s.endPointId);
        if (a && b) evaluateSegment(a, b, s.id);
      } else if (EDGE_SHAPE_TYPES.has(s.type)) {
        const edges = getShapeEdges(s, pointsMap);
        edges.forEach((edge, idx) => evaluateSegment(edge.p1, edge.p2, s.id, idx));
      }
    }
    return best;
  };

  // Giống getOrCreatePoint, nhưng nếu nhấp gần 1 đường có sẵn (không trúng điểm),
  // điểm mới được ép nằm chính xác trên đường đó.
  const getOrCreatePointOnLine = (sx: number, sy: number, wx: number, wy: number): GeoPoint => {
    const nearest = findNearestPoint(sx, sy, points, viewport, 12);
    if (nearest) return nearest;
    const onLine = findPointOnAnyLine(sx, sy);
    const finalX = onLine ? onLine.x : wx;
    const finalY = onLine ? onLine.y : wy;
    const newPoint: GeoPoint = {
      id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label: nextPointLabel,
      x: finalX,
      y: finalY,
      labelPos: 'auto',
      style: { color: '#16233a', pointStyle: 'dot' },
    };
    onAddPoint(newPoint);
    return newPoint;
  };

  // ----------------------------------------------------
  // Zoom & Pan Handlers
  // ----------------------------------------------------
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const newScale = Math.max(10, Math.min(250, viewport.scale * zoomFactor));

    // Zoom around cursor position:
    // Screen = W/2 + pan + World * Scale
    // World_cursor must remain identical before and after zoom
    const wx = (cursorX - viewport.width / 2 - viewport.panX) / viewport.scale;
    const wy = -(cursorY - viewport.height / 2 - viewport.panY) / viewport.scale;

    const newPanX = cursorX - viewport.width / 2 - wx * newScale;
    const newPanY = cursorY - viewport.height / 2 + wy * newScale;

    setViewport((prev) => ({
      ...prev,
      scale: newScale,
      panX: newPanX,
      panY: newPanY,
    }));
  };

  const handleZoomIn = () => {
    setViewport((prev) => ({
      ...prev,
      scale: Math.min(250, prev.scale * 1.25),
    }));
  };

  const handleZoomOut = () => {
    setViewport((prev) => ({
      ...prev,
      scale: Math.max(10, prev.scale / 1.25),
    }));
  };

  const handleResetView = () => {
    setViewport((prev) => ({
      ...prev,
      panX: 0,
      panY: 0,
      scale: 40,
    }));
  };

  // ----------------------------------------------------
  // Mouse Event Handlers for Canvas SVG
  // ----------------------------------------------------
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    // Check if middle click, or Shift held, or Space held for panning
    if (e.button === 1 || e.shiftKey) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - viewport.panX, y: e.clientY - viewport.panY });
      return;
    }

    if (e.button !== 0) return; // Left click only for drawing

    const { wx, wy, sx, sy } = getPointerWorldCoord(e);

    // If Move Background tool:
    if (activeTool === 'move_background') {
      if (bgImage?.locked) return;
      setIsDraggingBg(true);
      setBgDragStart({
        wx,
        wy,
        initialPanX: bgImage?.panX ?? 0,
        initialPanY: bgImage?.panY ?? 0,
      });
      return;
    }

    // If Eyedropper tool: lấy mã màu tại pixel ảnh nền, dùng toạ độ world THÔ (không snap lưới)
    if (activeTool === 'eyedropper') {
      const rawWorld = screenToWorld(sx, sy, viewport);
      const result = sampleBgColorAt(rawWorld.x, rawWorld.y);
      setPickedColor(result);
      return;
    }

    // If Select tool:
    if (activeTool === 'select') {
      const nearestPt = findNearestPoint(sx, sy, points, viewport, 14);
      if (nearestPt) {
        onSelectPoint(nearestPt.id);
        onSelectShape(null);
        setMultiSelectedIds([]);
        // Điểm phụ thuộc (giao điểm) không cho kéo tay — vị trí luôn được tính tự động
        // từ 2 hình gốc, kéo tay sẽ bị ghi đè ngay lập tức nên không cho phép để tránh gây khó hiểu.
        if (!nearestPt.derivedFrom || nearestPt.derivedFrom.type === 'pointOnLine') {
          setDraggingPointId(nearestPt.id);
        }
        return;
      }
      // If clicked on canvas background without hitting any point or shape: wait for drag threshold before panning
      onSelectPoint(null);
      onSelectShape(null);
      setMultiSelectedIds([]);
      setPendingPanStart({
        x: e.clientX,
        y: e.clientY,
        panX: viewport.panX,
        panY: viewport.panY,
      });
      return;
    }

    // ----------------- TOOL: POINT -----------------
    if (activeTool === 'point') {
      const pt: GeoPoint = {
        id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        label: nextPointLabel,
        x: wx,
        y: wy,
        labelPos: 'auto',
        style: { color: '#16233a', pointStyle: 'dot' },
      };
      onAddPoint(pt);
      return;
    }

    // ----------------- TOOL: POINT ON LINE (điểm phụ thuộc) -----------------
    if (activeTool === 'point_on_line') {
      const hit = findLineForConstrainedPoint(sx, sy);
      if (!hit) return; // phải nhấp gần 1 đường có sẵn, không tạo điểm tự do
      const pt: GeoPoint = {
        id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        label: nextPointLabel,
        x: hit.x,
        y: hit.y,
        labelPos: 'auto',
        style: { color: '#f59e0b', pointStyle: 'dot' },
        derivedFrom: { type: 'pointOnLine', shapeId: hit.shapeId, t: hit.t, edgeIndex: hit.edgeIndex },
      };
      onAddPoint(pt);
      return;
    }

    // ----------------- TOOL: MEASURE (Đo & chia đoạn) -----------------
    if (activeTool === 'measure') {
      const pt = getOrCreatePoint(sx, sy, wx, wy);
      if (tempPoints.length === 0) {
        setTempPoints([pt]);
      } else if (tempPoints.length === 1) {
        if (pt.id !== tempPoints[0].id) setTempPoints([tempPoints[0], pt]);
      } else {
        // Đã đo xong 1 cặp — nhấp thêm để bắt đầu đo cặp mới từ điểm vừa nhấp
        setTempPoints([pt]);
      }
      return;
    }

    // ----------------- TOOL: SEGMENT -----------------
    if (activeTool === 'segment') {
      const pt = getOrCreatePoint(sx, sy, wx, wy);
      if (tempPoints.length === 0) {
        setTempPoints([pt]);
      } else {
        const p1 = tempPoints[0];
        if (p1.id !== pt.id) {
          const newShape: GeoShape = {
            id: `s_seg_${Date.now()}`,
            type: 'segment',
            pointIds: [p1.id, pt.id],
            style: { color: '#16233a', strokeWidth: 1.5, dashPattern: 'solid' },
          };
          onAddShape(newShape);
        }
        setTempPoints([]);
      }
      return;
    }

    // ----------------- TOOL: PATH_SEGMENT_LABEL -----------------
    if (activeTool === 'path_segment_label') {
      const pt = getOrCreatePoint(sx, sy, wx, wy);
      if (tempPoints.length === 0) {
        setTempPoints([pt]);
      } else {
        const p1 = tempPoints[0];
        if (p1.id !== pt.id) {
          // Đã chọn đủ 2 điểm — hiện hộp nhập nội dung nhãn tại trung điểm, CHƯA tạo nhãn.
          const s1 = worldToScreen(p1.x, p1.y, viewport);
          const s2 = worldToScreen(pt.x, pt.y, viewport);
          setPendingPathAnnotation({
            kind: 'segment_label',
            point1Id: p1.id,
            point2Id: pt.id,
            screenX: (s1.x + s2.x) / 2,
            screenY: (s1.y + s2.y) / 2,
          });
          setPendingLabelText('');
        }
        setTempPoints([]);
      }
      return;
    }

    // ----------------- TOOL: PATH_OFFSET_LABEL -----------------
    if (activeTool === 'path_offset_label') {
      const pt = getOrCreatePoint(sx, sy, wx, wy);
      // Đã chọn xong điểm — hiện hộp nhập nội dung nhãn ngay cạnh điểm đó, CHƯA tạo nhãn.
      const s = worldToScreen(pt.x, pt.y, viewport);
      setPendingPathAnnotation({
        kind: 'point_offset_label',
        pointId: pt.id,
        screenX: s.x,
        screenY: s.y,
      });
      setPendingLabelText('');
      return;
    }

    // ----------------- TOOL: POLYLINE -----------------
    if (activeTool === 'polyline') {
      // Double-click (2 cú click liên tiếp gần nhau) tại điểm cuối = kết thúc nét HỞ ngay tại đó,
      // không cần khép kín về điểm đầu, không cần bấm nút hay phím Enter.
      if (e.detail === 2 && polylinePoints.length >= 2) {
        onFinishPolyline();
        return;
      }
      const pt = getOrCreatePoint(sx, sy, wx, wy);
      if (polylinePoints.length > 0 && pt.id === polylinePoints[0]) {
        // Closed polyline
        const newShape: GeoShape = {
          id: `s_poly_${Date.now()}`,
          type: 'polyline',
          pointIds: [...polylinePoints],
          isClosed: true,
          style: { color: '#16233a', strokeWidth: 1.5, dashPattern: 'solid' },
        };
        onAddShape(newShape);
        onSetPolylinePoints([]);
      } else {
        onSetPolylinePoints([...polylinePoints, pt.id]);
      }
      return;
    }

    // ----------------- TOOL: CIRCLE -----------------
    if (activeTool === 'circle') {
      const pt = getOrCreatePoint(sx, sy, wx, wy);
      if (tempPoints.length === 0) {
        setTempPoints([pt]);
      } else {
        const center = tempPoints[0];
        if (center.id !== pt.id) {
          const newShape: GeoShape = {
            id: `s_circ_${Date.now()}`,
            type: 'circle',
            centerId: center.id,
            radiusPointId: pt.id,
            style: { color: '#16233a', strokeWidth: 1.5, dashPattern: 'solid' },
          };
          onAddShape(newShape);
        }
        setTempPoints([]);
      }
      return;
    }

    // ----------------- TOOL: SEMICIRCLE -----------------
    if (activeTool === 'semicircle') {
      const pt = getOrCreatePoint(sx, sy, wx, wy);
      if (tempPoints.length === 0) {
        setTempPoints([pt]);
      } else {
        const center = tempPoints[0];
        if (center.id !== pt.id) {
          const newShape: GeoShape = {
            id: `s_semicirc_${Date.now()}`,
            type: 'semicircle',
            centerId: center.id,
            radiusPointId: pt.id,
            style: { color: '#16233a', strokeWidth: 1.5, dashPattern: 'solid' },
          };
          onAddShape(newShape);
        }
        setTempPoints([]);
      }
      return;
    }

    // ----------------- TOOL: ELLIPSE -----------------
    if (activeTool === 'ellipse') {
      const pt = getOrCreatePoint(sx, sy, wx, wy);
      if (tempPoints.length === 0) {
        setTempPoints([pt]); // center
      } else if (tempPoints.length === 1) {
        setTempPoints([tempPoints[0], pt]); // center, rxPt
      } else {
        const [center, rxPt] = tempPoints;
        const newShape: GeoShape = {
          id: `s_ell_${Date.now()}`,
          type: 'ellipse',
          centerId: center.id,
          rxPointId: rxPt.id,
          ryPointId: pt.id,
          style: { color: '#16233a', strokeWidth: 1.5, dashPattern: 'solid' },
        };
        onAddShape(newShape);
        setTempPoints([]);
      }
      return;
    }

    // ----------------- TOOL: SEMI-ELLIPSE -----------------
    if (activeTool === 'semi_ellipse') {
      const pt = getOrCreatePoint(sx, sy, wx, wy);
      if (tempPoints.length === 0) {
        setTempPoints([pt]); // center
      } else if (tempPoints.length === 1) {
        setTempPoints([tempPoints[0], pt]); // center, rxPt
      } else {
        const [center, rxPt] = tempPoints;
        const newShape: GeoShape = {
          id: `s_semiell_${Date.now()}`,
          type: 'semi_ellipse',
          centerId: center.id,
          rxPointId: rxPt.id,
          ryPointId: pt.id,
          style: { color: '#16233a', strokeWidth: 1.5, dashPattern: 'solid' },
        };
        onAddShape(newShape);
        setTempPoints([]);
      }
      return;
    }

    // ----------------- TOOL: RECTANGLE -----------------
    if (activeTool === 'rectangle') {
      const pt = getOrCreatePoint(sx, sy, wx, wy);
      if (tempPoints.length === 0) {
        setTempPoints([pt]);
      } else {
        const p1 = tempPoints[0];

        if (rectangleMode === 'points') {
          // Chỉ tạo đủ 4 điểm góc, KHÔNG vẽ hình/nét nối
          const corner3: GeoPoint = {
            id: `p_${Date.now()}_rc3`,
            label: generatePointLabel(points.length),
            x: p1.x,
            y: pt.y,
            labelPos: 'auto',
            style: { color: '#16233a', pointStyle: 'dot' },
            derivedFrom: { type: 'rectangleCorner', xSourceId: p1.id, ySourceId: pt.id },
          };
          const corner4: GeoPoint = {
            id: `p_${Date.now()}_rc4`,
            label: generatePointLabel(points.length + 1),
            x: pt.x,
            y: p1.y,
            labelPos: 'auto',
            style: { color: '#16233a', pointStyle: 'dot' },
            derivedFrom: { type: 'rectangleCorner', xSourceId: pt.id, ySourceId: p1.id },
          };
          onAddPoint(corner3);
          onAddPoint(corner4);
        } else {
          const newShape: GeoShape = {
            id: `s_rect_${Date.now()}`,
            type: 'rectangle',
            pointIds: [p1.id, pt.id],
            isSquare: false,
            style: { color: '#16233a', strokeWidth: 1.5, dashPattern: 'solid' },
          };
          onAddShape(newShape);
        }
        setTempPoints([]);
      }
      return;
    }

    // ----------------- TOOL: ROUNDED RECTANGLE -----------------
    if (activeTool === 'rounded_rectangle') {
      const pt = getOrCreatePoint(sx, sy, wx, wy);
      if (tempPoints.length === 0) {
        setTempPoints([pt]);
      } else {
        const p1 = tempPoints[0];
        const newShape: GeoShape = {
          id: `s_rrect_${Date.now()}`,
          type: 'rounded_rectangle',
          pointIds: [p1.id, pt.id],
          cornerRadius: 0.3,
          style: { color: '#16233a', strokeWidth: 1.5, dashPattern: 'solid' },
        };
        onAddShape(newShape);
        setTempPoints([]);
      }
      return;
    }

    // ----------------- TOOL: SQUARE -----------------
    if (activeTool === 'square') {
      const pt = getOrCreatePoint(sx, sy, wx, wy);
      if (tempPoints.length === 0) {
        setTempPoints([pt]);
      } else {
        const p1 = tempPoints[0];
        const dx = pt.x - p1.x;
        const dy = pt.y - p1.y;
        const side = Math.max(Math.abs(dx), Math.abs(dy)) || 2;
        const sqPt: GeoPoint = {
          id: `p_${Date.now()}_sq`,
          label: nextPointLabel,
          x: p1.x + (dx >= 0 ? side : -side),
          y: p1.y + (dy >= 0 ? side : -side),
          labelPos: 'auto',
          style: { color: '#16233a', pointStyle: 'dot' },
        };
        onAddPoint(sqPt);
        const newShape: GeoShape = {
          id: `s_sq_${Date.now()}`,
          type: 'square',
          pointIds: [p1.id, sqPt.id],
          style: { color: '#16233a', strokeWidth: 1.5, dashPattern: 'solid' },
        };
        onAddShape(newShape);
        setTempPoints([]);
      }
      return;
    }

    // ----------------- TOOL: PARABOLA -----------------
    if (activeTool === 'parabola') {
      const pt = getOrCreatePoint(sx, sy, wx, wy);
      if (tempPoints.length === 0) {
        setTempPoints([pt]);
      } else {
        const vertex = tempPoints[0];
        if (vertex.id !== pt.id) {
          const newShape: GeoShape = {
            id: `s_parab_${Date.now()}`,
            type: 'parabola',
            vertexId: vertex.id,
            throughId: pt.id,
            style: { color: '#16233a', strokeWidth: 1.5, dashPattern: 'solid' },
          };
          onAddShape(newShape);
        }
        setTempPoints([]);
      }
      return;
    }

    // ----------------- TOOL: HYPERBOLA -----------------
    if (activeTool === 'hyperbola') {
      const pt = getOrCreatePoint(sx, sy, wx, wy);
      if (tempPoints.length === 0) {
        setTempPoints([pt]);
      } else {
        const center = tempPoints[0];
        if (center.id !== pt.id) {
          const newShape: GeoShape = {
            id: `s_hyperb_${Date.now()}`,
            type: 'hyperbola',
            centerId: center.id,
            pointId: pt.id,
            style: { color: '#16233a', strokeWidth: 1.5, dashPattern: 'solid' },
          };
          onAddShape(newShape);
        }
        setTempPoints([]);
      }
      return;
    }

    // ----------------- TOOL: REGULAR POLYGON -----------------
    if (activeTool === 'regular_polygon') {
      const pt = getOrCreatePoint(sx, sy, wx, wy);
      if (tempPoints.length === 0) {
        setTempPoints([pt]); // center
      } else {
        const center = tempPoints[0];
        const newShape: GeoShape = {
          id: `s_poly_${Date.now()}`,
          type: 'regular_polygon',
          centerId: center.id,
          vertexId: pt.id,
          sides: polygonSides,
          style: { color: '#16233a', strokeWidth: 1.5, dashPattern: 'solid' },
        };
        onAddShape(newShape);
        setTempPoints([]);
      }
      return;
    }

    // ----------------- TOOL: ARC 3 POINTS -----------------
    if (activeTool === 'arc_3p') {
      const pt = getOrCreatePoint(sx, sy, wx, wy);
      if (tempPoints.length < 2) {
        setTempPoints([...tempPoints, pt]);
      } else {
        const [p1, p2] = tempPoints;
        const newShape: GeoShape = {
          id: `s_arc_${Date.now()}`,
          type: 'arc_3p',
          pointIds: [p1.id, p2.id, pt.id],
          style: { color: '#16233a', strokeWidth: 1.5, dashPattern: 'solid' },
        };
        onAddShape(newShape);
        setTempPoints([]);
      }
      return;
    }

    // ----------------- TOOL: PARAM ARC (góc + bán kính, cú pháp arc(start:end:radius)) -----------------
    if (activeTool === 'param_arc') {
      if (pickingArcRadius) {
        const pt = getOrCreatePoint(sx, sy, wx, wy);
        if (radiusPickPoints.length === 0) {
          onSetRadiusPickPoints([pt]);
        } else if (radiusPickPoints.length === 1 && pt.id !== radiusPickPoints[0].id) {
          onSetRadiusPickPoints([radiusPickPoints[0], pt]);
        }
        return;
      }
      const pt = getOrCreatePoint(sx, sy, wx, wy);
      onSetParamArcStartPointId(pt.id);
      return;
    }

    // ----------------- TOOL: BEZIER CURVE -----------------
    if (activeTool === 'bezier') {
      const pt = getOrCreatePoint(sx, sy, wx, wy);
      const updated = [...tempPoints, pt];
      const requiredCount = bezierClosed ? bezierSegments : bezierSegments + 1;

      if (updated.length >= requiredCount) {
        const anchors = updated.map((p) => ({ x: p.x, y: p.y }));
        const controls = generateDefaultBezierControls(anchors, bezierClosed);
        const newShape: GeoShape = {
          id: `s_bez_${Date.now()}`,
          type: 'bezier',
          anchorIds: updated.map((p) => p.id),
          controls,
          isClosed: bezierClosed,
          style: { color: '#16233a', strokeWidth: 1.5, dashPattern: 'solid' },
        };
        onAddShape(newShape);
        setTempPoints([]);
      } else {
        setTempPoints(updated);
      }
      return;
    }

    // ----------------- TOOL: PARALLEL LINE -----------------
    if (activeTool === 'parallel') {
      if (!selectedRefShapeId && !axisRef) {
        // Bước 1: chọn đường chuẩn — qua click 1 hình (handleShapeClick) hoặc click trục (xử lý riêng ở phần trục Oxy)
        return;
      }
      const refPts = resolveRefLinePoints();
      if (!refPts) return;

      if (tempPoints.length === 0) {
        // Bước 2: chọn điểm đi qua — snap lên đường có sẵn nếu nhấp gần
        const pt = getOrCreatePointOnLine(sx, sy, wx, wy);
        setTempPoints([pt]);
      } else {
        // Bước 3: chốt điểm cuối (đã chiếu song song)
        const through = tempPoints[0];
        const endCoord = computeParallelEndPoint(refPts.p1, refPts.p2, through, { x: wx, y: wy });
        const endPt: GeoPoint = {
          id: `p_${Date.now()}_par`,
          label: nextPointLabel,
          x: endCoord.x,
          y: endCoord.y,
          labelPos: 'auto',
          style: { color: '#16233a', pointStyle: 'dot' },
        };
        onAddPoint(endPt);
        const newShape: GeoShape = {
          id: `s_par_${Date.now()}`,
          type: 'parallel_line',
          referenceShapeId: selectedRefShapeId ?? (axisRef === 'x' ? 'axis-x' : 'axis-y'),
          throughPointId: through.id,
          endPointId: endPt.id,
          style: { color: '#2f5d99', strokeWidth: 1.5, dashPattern: 'solid' },
        };
        onAddShape(newShape);
        setTempPoints([]);
        setSelectedRefShapeId(null);
        setAxisRef(null);
      }
      return;
    }

    // ----------------- TOOL: PERPENDICULAR LINE -----------------
    if (activeTool === 'perpendicular') {
      if (!selectedRefShapeId && !axisRef) {
        return;
      }
      const refPts = resolveRefLinePoints();
      if (!refPts) return;

      if (tempPoints.length === 0) {
        // Bước 2: chọn điểm đi qua — snap lên đường có sẵn nếu nhấp gần
        const pt = getOrCreatePointOnLine(sx, sy, wx, wy);
        setTempPoints([pt]);
      } else {
        // Bước 3: chốt điểm cuối (đã chiếu vuông góc)
        const through = tempPoints[0];
        const { endPoint } = computePerpendicularEndPoint(refPts.p1, refPts.p2, through, { x: wx, y: wy });
        const endPt: GeoPoint = {
          id: `p_${Date.now()}_perp`,
          label: nextPointLabel,
          x: endPoint.x,
          y: endPoint.y,
          labelPos: 'auto',
          style: { color: '#16233a', pointStyle: 'dot' },
        };
        onAddPoint(endPt);
        const newShape: GeoShape = {
          id: `s_perp_${Date.now()}`,
          type: 'perpendicular_line',
          referenceShapeId: selectedRefShapeId ?? (axisRef === 'x' ? 'axis-x' : 'axis-y'),
          throughPointId: through.id,
          endPointId: endPt.id,
          showRightAngleMark: true,
          style: { color: '#059669', strokeWidth: 1.5, dashPattern: 'solid' },
        };
        onAddShape(newShape);
        setTempPoints([]);
        setSelectedRefShapeId(null);
        setAxisRef(null);
      }
      return;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (pendingPanStart && !isPanning) {
      const distMoved = Math.hypot(e.clientX - pendingPanStart.x, e.clientY - pendingPanStart.y);
      if (distMoved > 4) {
        setIsPanning(true);
        const startX = pendingPanStart.x - pendingPanStart.panX;
        const startY = pendingPanStart.y - pendingPanStart.panY;
        setPanStart({ x: startX, y: startY });
        setViewport((prev) => ({
          ...prev,
          panX: e.clientX - startX,
          panY: e.clientY - startY,
        }));
        return;
      } else {
        return; // Chưa vượt ngưỡng kéo (4px), coi như đứng yên để tránh giật tọa độ
      }
    }

    if (isPanning) {
      setViewport((prev) => ({
        ...prev,
        panX: e.clientX - panStart.x,
        panY: e.clientY - panStart.y,
      }));
      return;
    }

    const { wx, wy, sx, sy } = getPointerWorldCoord(e);
    setMousePos({ sx, sy, wx, wy });

    // Handle whole-shape dragging (kéo cả hình)
    // Tôn trọng đúng settings.snapToGrid — nếu bật, độ dời dx/dy được snap để điểm ĐẦU TIÊN
    // của hình luôn rơi đúng mốc lưới (các điểm còn lại dịch theo cùng dx/dy đã snap đó,
    // nên hình giữ nguyên hình dạng, chỉ vị trí tổng thể bắt đúng lưới).
    if (draggingShapeId && shapeDragStart) {
      const rawNow = screenToWorld(sx, sy, viewport);
      let dx = rawNow.x - shapeDragStart.wx;
      let dy = rawNow.y - shapeDragStart.wy;

      if (settings.snapToGrid && shapeDragStart.pointSnapshots.length > 0) {
        const anchor = shapeDragStart.pointSnapshots[0];
        const snappedX = snapCoord(anchor.x + dx, settings.gridStep);
        const snappedY = snapCoord(anchor.y + dy, settings.gridStep);
        dx = snappedX - anchor.x;
        dy = snappedY - anchor.y;
      }

      shapeDragStart.pointSnapshots.forEach((snap) => {
        onUpdatePointCoord(snap.id, snap.x + dx, snap.y + dy);
      });

      if (shapeDragStart.controlsSnapshot) {
        const newControls = shapeDragStart.controlsSnapshot.map(
          ([cp1, cp2]) =>
            [
              { x: cp1.x + dx, y: cp1.y + dy },
              { x: cp2.x + dx, y: cp2.y + dy },
            ] as [BezierControlPoint, BezierControlPoint]
        );
        onUpdateShape(draggingShapeId, { controls: newControls });
      }
      return;
    }

    // Handle background image dragging
    if (isDraggingBg && activeTool === 'move_background') {
      const deltaX = wx - bgDragStart.wx;
      const deltaY = wy - bgDragStart.wy;
      onUpdateBgImage?.((prev) => ({
        ...prev,
        panX: bgDragStart.initialPanX + deltaX,
        panY: bgDragStart.initialPanY + deltaY,
      }));
      return;
    }

    // Handle label dragging (kéo nhãn quanh điểm) — CHỈ đổi góc, khoảng cách dùng chung toàn bộ điểm
    if (draggingLabelPointId) {
      const pt = points.find((p) => p.id === draggingLabelPointId);
      if (pt) {
        const ptScreen = worldToScreen(pt.x, pt.y, viewport);
        const dx = sx - ptScreen.x;
        const dy = sy - ptScreen.y;
        const rawAngle = (Math.atan2(-dy, dx) * 180) / Math.PI;
        const angle = Math.round(rawAngle);
        onUpdatePoint(draggingLabelPointId, { labelAngleDeg: angle });
      }
      return;
    }

    // Handle point dragging
    if (draggingPointId) {
      onUpdatePointCoord(draggingPointId, wx, wy);
      return;
    }

    // Handle Bezier control point dragging
    if (draggingControl) {
      const shape = shapes.find((s) => s.id === draggingControl.shapeId);
      if (shape && shape.type === 'bezier') {
        const newControls = shape.controls.map((seg, sIdx) => {
          if (sIdx === draggingControl.segIndex) {
            const pair: [BezierControlPoint, BezierControlPoint] = [
              draggingControl.cpIndex === 0 ? { x: wx, y: wy } : seg[0],
              draggingControl.cpIndex === 1 ? { x: wx, y: wy } : seg[1],
            ];
            return pair;
          }
          return seg;
        });
        onUpdateShape(shape.id, { controls: newControls });
      }
      return;
    }

    // Hover detection for points
    const nearPt = findNearestPoint(sx, sy, points, viewport, 12);
    setHoveredPointId(nearPt ? nearPt.id : null);
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setPendingPanStart(null);
    setIsDraggingBg(false);
    setDraggingPointId(null);
    setDraggingLabelPointId(null);
    setDraggingControl(null);
    setDraggingShapeId(null);
    setShapeDragStart(null);
  };

  // Shape click handler for selection and multi-step reference selection
  const handleShapeClick = (shapeId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (activeTool === 'toggle_visibility') {
      const shape = shapes.find((s) => s.id === shapeId);
      if (shape) onUpdateShape(shapeId, { hidden: !shape.hidden });
      return;
    }

    if (activeTool === 'select') {
      if (e.ctrlKey || e.metaKey) {
        setMultiSelectedIds((prev) =>
          prev.includes(shapeId) ? prev.filter((id) => id !== shapeId) : [...prev, shapeId]
        );
        onSelectShape(null);
        onSelectPoint(null);
        return;
      }
      setMultiSelectedIds([]);
      onSelectShape(shapeId);
      onSelectPoint(null);
      return;
    }

    if (activeTool === 'parallel' || activeTool === 'perpendicular') {
      if (!selectedRefShapeId && !axisRef) {
        setSelectedRefShapeId(shapeId);
        return;
      }
    }

    if (activeTool === 'intersection') {
      const rect = svgRef.current?.getBoundingClientRect();
      const clickWorld = rect ? screenToWorld(e.clientX - rect.left, e.clientY - rect.top, viewport) : null;
      const clickedShape = shapes.find((s) => s.id === shapeId);
      const edgeIdx = clickWorld && clickedShape ? getClickedEdgeIndex(clickedShape, clickWorld, pointsMap) : null;

      if (!intersectionSelectedShape1) {
        setIntersectionSelectedShape1(shapeId);
        setIntersectionEdgeIndex1(edgeIdx);
      } else if (intersectionSelectedShape1 !== shapeId) {
        const s1 = shapes.find((s) => s.id === intersectionSelectedShape1);
        const s2 = shapes.find((s) => s.id === shapeId);
        if (s1 && s2) {
          const e1 = intersectionEdgeIndex1 !== null ? getEdgeByIndex(s1, intersectionEdgeIndex1, pointsMap) : null;
          const e2 = edgeIdx !== null ? getEdgeByIndex(s2, edgeIdx, pointsMap) : null;

          let interPoints: Array<{ x: number; y: number }> = [];
          if (e1 && e2) {
            const r = intersectEdgeEdge(e1, e2);
            interPoints = r ? [r] : [];
          } else if (e1) {
            interPoints = findEdgeShapeIntersections(e1, s2, pointsMap);
          } else if (e2) {
            interPoints = findEdgeShapeIntersections(e2, s1, pointsMap);
          } else {
            interPoints = findShapeIntersections(s1, s2, pointsMap);
          }

          interPoints.forEach((ip, idx) => {
            const pt: GeoPoint = {
              id: `p_${Date.now()}_inter_${idx}`,
              label: nextPointLabel,
              x: ip.x,
              y: ip.y,
              labelPos: 'above right',
              style: { color: '#b91c1c', pointStyle: 'dot' },
              derivedFrom: {
                type: 'intersection',
                shapeId1: s1.id,
                shapeId2: s2.id,
                index: idx,
                edgeIndex1: intersectionEdgeIndex1 ?? undefined,
                edgeIndex2: edgeIdx ?? undefined,
              },
            };
            onAddPoint(pt);
          });
        }
        setIntersectionSelectedShape1(null);
        setIntersectionEdgeIndex1(null);
      }
    }
  };

  const handleDivideSegment = (parts: number) => {
    if (tempPoints.length !== 2) return;
    const [p1, p2] = tempPoints;
    for (let i = 1; i < parts; i++) {
      const t = i / parts;
      const pt: GeoPoint = {
        id: `p_${Date.now()}_div_${i}_${Math.random().toString(36).substring(2, 5)}`,
        label: generatePointLabel(points.length + i - 1),
        x: p1.x + t * (p2.x - p1.x),
        y: p1.y + t * (p2.y - p1.y),
        labelPos: 'auto',
        style: { color: '#7c3aed', pointStyle: 'dot' },
        derivedFrom: { type: 'segmentDivision', pointId1: p1.id, pointId2: p2.id, t },
      };
      onAddPoint(pt);
    }
  };

  // ----------------------------------------------------
  // Dynamic Rulers Calculation
  // ----------------------------------------------------
  const renderRulers = () => {
    const { width, height, panX, panY, scale } = viewport;
    const originSx = width / 2 + panX;
    const originSy = height / 2 + panY;

    // Top ruler (horizontal X cm marks)
    const minWx = Math.floor((-originSx) / scale);
    const maxWx = Math.ceil((width - originSx) / scale);
    const xTicks: Array<{ wx: number; sx: number }> = [];
    for (let w = minWx; w <= maxWx; w++) {
      xTicks.push({ wx: w, sx: originSx + w * scale });
    }

    // Left ruler (vertical Y cm marks)
    const minWy = Math.floor((originSy - height) / scale);
    const maxWy = Math.ceil(originSy / scale);
    const yTicks: Array<{ wy: number; sy: number }> = [];
    for (let w = minWy; w <= maxWy; w++) {
      yTicks.push({ wy: w, sy: originSy - w * scale });
    }

    return (
      <>
        {/* Top-Left Corner Box "cm" */}
        <div className="absolute top-0 left-0 w-6 h-6 bg-[#f8fafc] border-r border-b border-[#dbe4ee] flex items-center justify-center text-[10px] font-mono-code text-[#5b6b82] select-none pointer-events-none z-20">
          cm
        </div>

        {/* Top Ruler Bar */}
        <div className="absolute top-0 left-0 right-0 h-6 bg-[#ffffff]/90 backdrop-blur-xs border-b border-[#dbe4ee] select-none pointer-events-none z-10 overflow-hidden">
          {xTicks.map(({ wx, sx }) => {
            if (sx < 24 || sx > width) return null;
            return (
              <div
                key={`xtick-${wx}`}
                className="absolute bottom-0 flex flex-col items-center -translate-x-1/2"
                style={{ left: `${sx}px` }}
              >
                <span className="text-[9px] font-mono-code text-[#5b6b82] leading-none mb-0.5">
                  {wx}
                </span>
                <div className="w-[1px] h-1.5 bg-[#5b6b82]" />
              </div>
            );
          })}
        </div>

        {/* Left Ruler Bar */}
        <div className="absolute top-0 left-0 bottom-0 w-6 bg-[#ffffff]/90 backdrop-blur-xs border-r border-[#dbe4ee] select-none pointer-events-none z-10 overflow-hidden">
          {yTicks.map(({ wy, sy }) => {
            if (sy < 24 || sy > height) return null;
            return (
              <div
                key={`ytick-${wy}`}
                className="absolute right-0 flex items-center -translate-y-1/2"
                style={{ top: `${sy}px` }}
              >
                <span className="text-[9px] font-mono-code text-[#5b6b82] leading-none mr-1">
                  {wy}
                </span>
                <div className="w-1.5 h-[1px] bg-[#5b6b82]" />
              </div>
            );
          })}
        </div>
      </>
    );
  };

  // ----------------------------------------------------
  // Dynamic Tool Instructions Hint
  // ----------------------------------------------------
  const getToolHint = (): string => {
    switch (activeTool) {
      case 'toggle_visibility':
        return 'Nhấp vào 1 điểm hoặc hình để đảo trạng thái ẩn/hiện — ẩn nghĩa là loại khỏi mã TikZ xuất ra, vẫn hiện mờ trên canvas để bạn còn nhìn thấy.';
      case 'eyedropper':
        return bgImage?.dataUrl
          ? 'Nhấp vào ảnh nền để lấy mã màu tại đúng vị trí đó.'
          : 'Chưa có ảnh nền — tải ảnh lên ở thanh công cụ bên trái trước.';
      case 'select':
        return 'Kéo thả điểm để di chuyển hình · Nhấp vào hình/điểm để chỉnh thuộc tính bên phải';
      case 'move_background':
        return 'Kéo thả chuột trên canvas để di chuyển vị trí ảnh nền đồ hình';
      case 'point':
        return 'Nhấp chuột vào canvas để đặt điểm mới';
      case 'point_on_line':
        return 'Nhấp vào 1 đường thẳng, hoặc 1 cạnh của hình chữ nhật/đường gấp khúc để tạo điểm luôn ràng buộc nằm trên đó.';
      case 'segment':
        return tempPoints.length === 0
          ? 'Bước 1/2: Nhấp chọn điểm đầu'
          : 'Bước 2/2: Nhấp chọn điểm cuối (đường màu cam là nét đang vẽ)';
      case 'path_segment_label':
        return tempPoints.length === 0
          ? 'Nhãn đoạn: Bước 1/2: Nhấp chọn điểm thứ nhất'
          : 'Nhãn đoạn: Bước 2/2: Nhấp chọn điểm thứ hai để gắn nhãn nối';
      case 'path_offset_label':
        return 'Nhãn góc / lệch: Nhấp chọn 1 điểm để đặt nhãn góc/vị trí lệch tâm';
      case 'polyline':
        return `Đã chọn ${polylinePoints.length} điểm · Nhấp điểm tiếp theo, nhấp lại điểm đầu để đóng hoặc bấm Hoàn thành`;
      case 'circle':
        return tempPoints.length === 0
          ? 'Bước 1/2: Nhấp chọn tâm đường tròn'
          : 'Bước 2/2: Nhấp chọn điểm xác định bán kính';
      case 'semicircle':
        return tempPoints.length === 0
          ? 'Bước 1/2: Nhấp chọn tâm nửa đường tròn'
          : 'Bước 2/2: Nhấp chọn điểm xác định bán kính và hướng đường kính cắt';
      case 'ellipse':
        if (tempPoints.length === 0) return 'Bước 1/3: Nhấp chọn tâm elip';
        if (tempPoints.length === 1) return 'Bước 2/3: Nhấp xác định bán trục ngang';
        return 'Bước 3/3: Nhấp xác định bán trục dọc';
      case 'semi_ellipse':
        if (tempPoints.length === 0) return 'Bước 1/3: Nhấp chọn tâm nửa elip';
        if (tempPoints.length === 1) return 'Bước 2/3: Nhấp chọn điểm trục cắt';
        return 'Bước 3/3: Nhấp hướng phình của nửa elip';
      case 'rectangle':
        if (tempPoints.length === 0) return 'Bước 1/2: Nhấp góc thứ nhất';
        return rectangleMode === 'points'
          ? 'Bước 2/2: Nhấp góc đối diện — CHỈ tạo 4 điểm góc, không vẽ nét'
          : 'Bước 2/2: Nhấp góc đối diện để hoàn thành hình chữ nhật';
      case 'rounded_rectangle':
        return tempPoints.length === 0
          ? 'Bước 1/2: Nhấp góc thứ nhất'
          : 'Bước 2/2: Nhấp góc đối diện để tạo hình chữ nhật bo góc';
      case 'square':
        return tempPoints.length === 0
          ? 'Bước 1/2: Nhấp góc thứ nhất'
          : 'Bước 2/2: Nhấp góc đối diện (tự động ép vuông)';
      case 'parabola':
        return tempPoints.length === 0
          ? 'Bước 1/2: Nhấp chọn đỉnh của Parabol'
          : 'Bước 2/2: Nhấp 1 điểm mà Parabol đi qua';
      case 'hyperbola':
        return tempPoints.length === 0
          ? 'Bước 1/2: Nhấp chọn tâm đối xứng của Hypecbol'
          : 'Bước 2/2: Nhấp điểm xác định đỉnh / độ mở 2 nhánh';
      case 'regular_polygon':
        return tempPoints.length === 0
          ? `Bước 1/2: Nhấp chọn tâm đa giác đều ${polygonSides} cạnh`
          : 'Bước 2/2: Nhấp chọn đỉnh đầu tiên để xác định bán kính';
      case 'arc_3p':
        if (tempPoints.length === 0) return 'Bước 1/3: Nhấp điểm thứ 1 của cung tròn';
        if (tempPoints.length === 1) return 'Bước 2/3: Nhấp điểm thứ 2 (điểm giữa)';
        return 'Bước 3/3: Nhấp điểm thứ 3 để hoàn thành cung tròn';
      case 'param_arc':
        return paramArcStartPointId
          ? 'Chỉnh góc bắt đầu/kết thúc và bán kính ở thanh công cụ bên trái, xem trước rồi bấm "Vẽ cung" (hoặc Enter).'
          : 'Nhấp 1 điểm trên canvas làm điểm bắt đầu cung.';
      case 'bezier':
        return `Bước ${tempPoints.length + 1}/${bezierClosed ? bezierSegments : bezierSegments + 1}: Nhấp các điểm neo cho đường cong Bezier`;
      case 'measure':
        if (tempPoints.length < 2) {
          return tempPoints.length === 0
            ? 'Bước 1/2: Nhấp điểm đầu cần đo'
            : 'Bước 2/2: Nhấp điểm cuối để đo khoảng cách';
        }
        return 'Xem khoảng cách và chia đoạn ở thanh nổi phía trên, hoặc nhấp 1 điểm mới để đo cặp khác';
      case 'intersection':
        return !intersectionSelectedShape1
          ? 'Bước 1/2: Nhấp chọn hình (hoặc 1 cạnh của HCN/gấp khúc) thứ nhất'
          : 'Bước 2/2: Nhấp chọn hình (hoặc 1 cạnh) thứ hai để tự động tính giao điểm';
      case 'parallel':
        if (!selectedRefShapeId && !axisRef) return 'Bước 1/3: Nhấp chọn 1 đường có sẵn, hoặc nhấp vào trục Ox/Oy làm chuẩn';
        if (tempPoints.length === 0) return 'Bước 2/3: Nhấp chọn điểm đi qua (nhấp gần 1 đường có sẵn để điểm nằm đúng trên đường đó)';
        return 'Bước 3/3: Di chuột để chỉnh độ dài song song và nhấp để chốt';
      case 'perpendicular':
        if (!selectedRefShapeId && !axisRef) return 'Bước 1/3: Nhấp chọn 1 đường có sẵn, hoặc nhấp vào trục Ox/Oy làm chuẩn';
        if (tempPoints.length === 0) return 'Bước 2/3: Nhấp chọn điểm đi qua (nhấp gần 1 đường có sẵn để điểm nằm đúng trên đường đó)';
        return 'Bước 3/3: Di chuột để chỉnh độ dài vuông góc (có dấu vuông góc) và nhấp để chốt';
    }
  };

  // ----------------------------------------------------
  // Render Shapes
  // ----------------------------------------------------
  const renderShapeElement = (shape: GeoShape) => {
    const isSelected = selectedShapeId === shape.id;
    const isRefSelected = selectedRefShapeId === shape.id || intersectionSelectedShape1 === shape.id;
    const isMultiSelected = multiSelectedIds.includes(shape.id);
    const strokeColor = isSelected || isRefSelected ? '#2f5d99' : isMultiSelected ? '#f59e0b' : shape.style.color;
    const strokeWidthPx = shape.style.strokeWidth * 1.5;
    const strokeDash =
      shape.style.dashPattern === 'dashed'
        ? '6 4'
        : shape.style.dashPattern === 'dotted'
        ? '2 3'
        : shape.style.dashPattern === 'dashdotted'
        ? '8 3 2 3'
        : undefined;

    const fillVal =
      shape.style.fillColor && shape.style.fillColor !== 'transparent'
        ? shape.style.fillColor
        : 'none';
    const fillOpacity = shape.style.fillOpacity || 0.15;

    const content = (() => {
      switch (shape.type) {
        case 'segment': {
          const p1 = pointsMap.get(shape.pointIds[0]);
          const p2 = pointsMap.get(shape.pointIds[1]);
          if (!p1 || !p2) return null;
          const s1 = worldToScreen(p1.x, p1.y, viewport);
          const s2 = worldToScreen(p2.x, p2.y, viewport);

          return (
            <>
              {/* Wider transparent stroke for easy clicking */}
              <line
                x1={s1.x}
                y1={s1.y}
                x2={s2.x}
                y2={s2.y}
                stroke="transparent"
                strokeWidth={16}
              />
              {/* Visual stroke */}
              <line
                x1={s1.x}
                y1={s1.y}
                x2={s2.x}
                y2={s2.y}
                stroke={strokeColor}
                strokeWidth={isSelected || isMultiSelected ? strokeWidthPx + 1.5 : strokeWidthPx}
                strokeDasharray={strokeDash}
                strokeLinecap="round"
              />
            </>
          );
        }

        case 'polyline': {
          const pts = shape.pointIds.map((id) => pointsMap.get(id)).filter(Boolean) as GeoPoint[];
          if (pts.length < 2) return null;
          const pointsStr = pts
            .map((p) => {
              const s = worldToScreen(p.x, p.y, viewport);
              return `${s.x},${s.y}`;
            })
            .join(' ');

          return shape.isClosed ? (
            <polygon
              points={pointsStr}
              stroke={strokeColor}
              strokeWidth={isSelected ? strokeWidthPx + 1.5 : strokeWidthPx}
              strokeDasharray={strokeDash}
              fill={fillVal}
              fillOpacity={fillOpacity}
              strokeLinejoin="round"
            />
          ) : (
            <polyline
              points={pointsStr}
              stroke={strokeColor}
              strokeWidth={isSelected ? strokeWidthPx + 1.5 : strokeWidthPx}
              strokeDasharray={strokeDash}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        }

        case 'circle': {
          const center = pointsMap.get(shape.centerId);
          const radPt = pointsMap.get(shape.radiusPointId);
          if (!center || !radPt) return null;
          const sCenter = worldToScreen(center.x, center.y, viewport);
          const rWorld = dist(center, radPt);
          const rPx = rWorld * viewport.scale;

          return (
            <circle
              cx={sCenter.x}
              cy={sCenter.y}
              r={rPx}
              stroke={strokeColor}
              strokeWidth={isSelected ? strokeWidthPx + 1.5 : strokeWidthPx}
              strokeDasharray={strokeDash}
              fill={fillVal}
              fillOpacity={fillOpacity}
            />
          );
        }

        case 'semicircle': {
          const center = pointsMap.get(shape.centerId);
          const radPt = pointsMap.get(shape.radiusPointId);
          if (!center || !radPt) return null;
          const pts = getSemicirclePoints(center, radPt, 48);
          const pointsStr = pts
            .map((p) => {
              const s = worldToScreen(p.x, p.y, viewport);
              return `${s.x},${s.y}`;
            })
            .join(' ');

          return (
            <polygon
              points={pointsStr}
              stroke={strokeColor}
              strokeWidth={isSelected ? strokeWidthPx + 1.5 : strokeWidthPx}
              strokeDasharray={strokeDash}
              fill={fillVal}
              fillOpacity={fillOpacity}
              strokeLinejoin="round"
            />
          );
        }

        case 'ellipse': {
          const center = pointsMap.get(shape.centerId);
          const rxPt = pointsMap.get(shape.rxPointId);
          const ryPt = pointsMap.get(shape.ryPointId);
          if (!center || !rxPt || !ryPt) return null;
          const sCenter = worldToScreen(center.x, center.y, viewport);
          const rx = (Math.abs(rxPt.x - center.x) || dist(center, rxPt)) * viewport.scale;
          const ry = (Math.abs(ryPt.y - center.y) || dist(center, ryPt)) * viewport.scale;

          return (
            <ellipse
              cx={sCenter.x}
              cy={sCenter.y}
              rx={rx}
              ry={ry}
              stroke={strokeColor}
              strokeWidth={isSelected ? strokeWidthPx + 1.5 : strokeWidthPx}
              strokeDasharray={strokeDash}
              fill={fillVal}
              fillOpacity={fillOpacity}
            />
          );
        }

        case 'semi_ellipse': {
          const center = pointsMap.get(shape.centerId);
          const rxPt = pointsMap.get(shape.rxPointId);
          const ryPt = pointsMap.get(shape.ryPointId);
          if (!center || !rxPt || !ryPt) return null;
          const ptsResult = getSemiEllipsePoints(center, rxPt, ryPt, 48);
          const pointsStr = ptsResult.points
            .map((p) => {
              const s = worldToScreen(p.x, p.y, viewport);
              return `${s.x},${s.y}`;
            })
            .join(' ');

          return (
            <polygon
              points={pointsStr}
              stroke={strokeColor}
              strokeWidth={isSelected ? strokeWidthPx + 1.5 : strokeWidthPx}
              strokeDasharray={strokeDash}
              fill={fillVal}
              fillOpacity={fillOpacity}
              strokeLinejoin="round"
            />
          );
        }

        case 'rectangle':
        case 'square': {
          const p1 = pointsMap.get(shape.pointIds[0]);
          const p2 = pointsMap.get(shape.pointIds[1]);
          if (!p1 || !p2) return null;
          const s1 = worldToScreen(p1.x, p1.y, viewport);
          const s2 = worldToScreen(p2.x, p2.y, viewport);
          const x = Math.min(s1.x, s2.x);
          const y = Math.min(s1.y, s2.y);
          const w = Math.abs(s2.x - s1.x);
          const h = Math.abs(s2.y - s1.y);

          return (
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              stroke={strokeColor}
              strokeWidth={isSelected ? strokeWidthPx + 1.5 : strokeWidthPx}
              strokeDasharray={strokeDash}
              fill={fillVal}
              fillOpacity={fillOpacity}
            />
          );
        }

        case 'rounded_rectangle': {
          const p1 = pointsMap.get(shape.pointIds[0]);
          const p2 = pointsMap.get(shape.pointIds[1]);
          if (!p1 || !p2) return null;
          const s1 = worldToScreen(p1.x, p1.y, viewport);
          const s2 = worldToScreen(p2.x, p2.y, viewport);
          const x = Math.min(s1.x, s2.x);
          const y = Math.min(s1.y, s2.y);
          const w = Math.abs(s2.x - s1.x);
          const h = Math.abs(s2.y - s1.y);
          const rx = (shape.cornerRadius ?? 0.3) * viewport.scale;
          const ry = rx;

          return (
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              rx={rx}
              ry={ry}
              stroke={strokeColor}
              strokeWidth={isSelected ? strokeWidthPx + 1.5 : strokeWidthPx}
              strokeDasharray={strokeDash}
              fill={fillVal}
              fillOpacity={fillOpacity}
            />
          );
        }

        case 'parabola': {
          const vertex = pointsMap.get(shape.vertexId);
          const through = pointsMap.get(shape.throughId);
          if (!vertex || !through) return null;
          const ptsResult = getParabolaPoints(vertex, through, 60);
          const pointsStr = ptsResult.points
            .map((p) => {
              const s = worldToScreen(p.x, p.y, viewport);
              return `${s.x},${s.y}`;
            })
            .join(' ');

          return (
            <polyline
              points={pointsStr}
              stroke={strokeColor}
              strokeWidth={isSelected ? strokeWidthPx + 1.5 : strokeWidthPx}
              strokeDasharray={strokeDash}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        }

        case 'hyperbola': {
          const center = pointsMap.get(shape.centerId);
          const pt = pointsMap.get(shape.pointId);
          if (!center || !pt) return null;
          const { branch1, branch2 } = getHyperbolaPoints(center, pt, 40);
          const b1Str = branch1
            .map((p) => {
              const s = worldToScreen(p.x, p.y, viewport);
              return `${s.x},${s.y}`;
            })
            .join(' ');
          const b2Str = branch2
            .map((p) => {
              const s = worldToScreen(p.x, p.y, viewport);
              return `${s.x},${s.y}`;
            })
            .join(' ');

          return (
            <>
              <polyline
                points={b1Str}
                stroke={strokeColor}
                strokeWidth={isSelected ? strokeWidthPx + 1.5 : strokeWidthPx}
                strokeDasharray={strokeDash}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points={b2Str}
                stroke={strokeColor}
                strokeWidth={isSelected ? strokeWidthPx + 1.5 : strokeWidthPx}
                strokeDasharray={strokeDash}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          );
        }

        case 'regular_polygon': {
          const center = pointsMap.get(shape.centerId);
          const vertex = pointsMap.get(shape.vertexId);
          if (!center || !vertex) return null;
          const vertices = getRegularPolygonVertices(center, vertex, shape.sides);
          const pointsStr = vertices
            .map((v) => {
              const s = worldToScreen(v.x, v.y, viewport);
              return `${s.x},${s.y}`;
            })
            .join(' ');

          return (
            <polygon
              points={pointsStr}
              stroke={strokeColor}
              strokeWidth={isSelected ? strokeWidthPx + 1.5 : strokeWidthPx}
              strokeDasharray={strokeDash}
              fill={fillVal}
              fillOpacity={fillOpacity}
              strokeLinejoin="round"
            />
          );
        }

        case 'arc_3p': {
          const p1 = pointsMap.get(shape.pointIds[0]);
          const p2 = pointsMap.get(shape.pointIds[1]);
          const p3 = pointsMap.get(shape.pointIds[2]);
          if (!p1 || !p2 || !p3) return null;
          const arcInfo = getArc3PSvgPath(p1, p2, p3, viewport);

          return (
            <path
              d={arcInfo.path}
              stroke={strokeColor}
              strokeWidth={isSelected ? strokeWidthPx + 1.5 : strokeWidthPx}
              strokeDasharray={strokeDash}
              fill="none"
              strokeLinecap="round"
            />
          );
        }

        case 'param_arc': {
          const startPt = pointsMap.get(shape.startPointId);
          if (!startPt) return null;
          const pts = getParamArcPoints(startPt, shape.startAngle, shape.endAngle, shape.radius, 60);
          const pointsStr = pts
            .map((p) => {
              const s = worldToScreen(p.x, p.y, viewport);
              return `${s.x},${s.y}`;
            })
            .join(' ');
          return (
            <polyline
              points={pointsStr}
              stroke={strokeColor}
              strokeWidth={isSelected ? strokeWidthPx + 1.5 : strokeWidthPx}
              strokeDasharray={strokeDash}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        }

        case 'bezier': {
          const anchors = shape.anchorIds.map((id) => pointsMap.get(id)).filter(Boolean) as GeoPoint[];
          if (anchors.length < 2 || shape.controls.length === 0) return null;

          const sStart = worldToScreen(anchors[0].x, anchors[0].y, viewport);
          let pathD = `M ${sStart.x} ${sStart.y}`;

          for (let i = 0; i < shape.controls.length; i++) {
            const nextAnchor = anchors[(i + 1) % anchors.length];
            const [cp1, cp2] = shape.controls[i];
            const scp1 = worldToScreen(cp1.x, cp1.y, viewport);
            const scp2 = worldToScreen(cp2.x, cp2.y, viewport);
            const sNext = worldToScreen(nextAnchor.x, nextAnchor.y, viewport);
            pathD += ` C ${scp1.x} ${scp1.y}, ${scp2.x} ${scp2.y}, ${sNext.x} ${sNext.y}`;
          }
          if (shape.isClosed) {
            pathD += ' Z';
          }

          const isBezierSelected = isSelected || activeTool === 'bezier';

          return (
            <>
              <path
                d={pathD}
                stroke={strokeColor}
                strokeWidth={isSelected ? strokeWidthPx + 1.5 : strokeWidthPx}
                strokeDasharray={strokeDash}
                fill={shape.isClosed ? fillVal : 'none'}
                fillOpacity={fillOpacity}
                strokeLinecap="round"
              />

              {/* Bezier control handles when selected */}
              {isBezierSelected && (
                <g className="pointer-events-auto">
                  {shape.controls.map(([cp1, cp2], sIdx) => {
                    const a1 = anchors[sIdx];
                    const a2 = anchors[(sIdx + 1) % anchors.length];
                    const sa1 = worldToScreen(a1.x, a1.y, viewport);
                    const sa2 = worldToScreen(a2.x, a2.y, viewport);
                    const scp1 = worldToScreen(cp1.x, cp1.y, viewport);
                    const scp2 = worldToScreen(cp2.x, cp2.y, viewport);

                    return (
                      <g key={`bez-handles-${sIdx}`}>
                        {/* Connection dashed line */}
                        <line
                          x1={sa1.x}
                          y1={sa1.y}
                          x2={scp1.x}
                          y2={scp1.y}
                          stroke="#b45309"
                          strokeWidth={1}
                          strokeDasharray="3 3"
                        />
                        <line
                          x1={sa2.x}
                          y1={sa2.y}
                          x2={scp2.x}
                          y2={scp2.y}
                          stroke="#b45309"
                          strokeWidth={1}
                          strokeDasharray="3 3"
                        />
                        {/* CP1 handle */}
                        <circle
                          cx={scp1.x}
                          cy={scp1.y}
                          r={
                            draggingControl?.shapeId === shape.id &&
                            draggingControl.segIndex === sIdx &&
                            draggingControl.cpIndex === 0
                              ? 7
                              : 5
                          }
                          fill="#f59e0b"
                          stroke="#b45309"
                          strokeWidth={1.5}
                          className="cursor-move"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setDraggingControl({ shapeId: shape.id, segIndex: sIdx, cpIndex: 0 });
                          }}
                        />
                        {/* CP2 handle */}
                        <circle
                          cx={scp2.x}
                          cy={scp2.y}
                          r={
                            draggingControl?.shapeId === shape.id &&
                            draggingControl.segIndex === sIdx &&
                            draggingControl.cpIndex === 1
                              ? 7
                              : 5
                          }
                          fill="#f59e0b"
                          stroke="#b45309"
                          strokeWidth={1.5}
                          className="cursor-move"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setDraggingControl({ shapeId: shape.id, segIndex: sIdx, cpIndex: 1 });
                          }}
                        />
                      </g>
                    );
                  })}
                </g>
              )}
            </>
          );
        }

        case 'parallel_line': {
          const p1 = pointsMap.get(shape.throughPointId);
          const p2 = pointsMap.get(shape.endPointId);
          if (!p1 || !p2) return null;
          const s1 = worldToScreen(p1.x, p1.y, viewport);
          const s2 = worldToScreen(p2.x, p2.y, viewport);

          return (
            <line
              x1={s1.x}
              y1={s1.y}
              x2={s2.x}
              y2={s2.y}
              stroke={strokeColor}
              strokeWidth={isSelected || isMultiSelected ? strokeWidthPx + 1.5 : strokeWidthPx}
              strokeDasharray={strokeDash}
              strokeLinecap="round"
            />
          );
        }

        case 'perpendicular_line': {
          const p1 = pointsMap.get(shape.throughPointId);
          const p2 = pointsMap.get(shape.endPointId);
          if (!p1 || !p2) return null;
          const s1 = worldToScreen(p1.x, p1.y, viewport);
          const s2 = worldToScreen(p2.x, p2.y, viewport);

          // Right angle mark
          const refShape = shapes.find((s) => s.id === shape.referenceShapeId);
          let rightAngleEl = null;
          if (shape.showRightAngleMark !== false && refShape && refShape.type === 'segment') {
            const refP1 = pointsMap.get(refShape.pointIds[0]);
            const refP2 = pointsMap.get(refShape.pointIds[1]);
            if (refP1 && refP2) {
              const { dirU, dirV } = computePerpendicularEndPoint(refP1, refP2, p1, p2);
              const mark = getRightAngleMark(p1, dirU, dirV, 0.35);
              const sm1 = worldToScreen(mark.p1.x, mark.p1.y, viewport);
              const sm2 = worldToScreen(mark.p2.x, mark.p2.y, viewport);
              const sm3 = worldToScreen(mark.p3.x, mark.p3.y, viewport);
              rightAngleEl = (
                <polyline
                  points={`${sm1.x},${sm1.y} ${sm2.x},${sm2.y} ${sm3.x},${sm3.y}`}
                  stroke="#059669"
                  strokeWidth={1.5}
                  fill="none"
                />
              );
            }
          }

          return (
            <>
              <line
                x1={s1.x}
                y1={s1.y}
                x2={s2.x}
                y2={s2.y}
                stroke={strokeColor}
                strokeWidth={isSelected || isMultiSelected ? strokeWidthPx + 1.5 : strokeWidthPx}
                strokeDasharray={strokeDash}
                strokeLinecap="round"
              />
              {rightAngleEl}
            </>
          );
        }
      }
    })();

    if (!content) return null;

    // Tính tâm xoay (world coords) + góc xoay áp dụng cho 5 loại hình hỗ trợ rotation.
    // Lưu ý chiều: SVG rotate() dương = xoay theo chiều kim đồng hồ trên màn hình,
    // nhưng world coords có trục Y hướng lên (ngược màn hình) — nên muốn góc xoay
    // người dùng nhập vào có nghĩa "dương = ngược kim đồng hồ" đúng theo quy ước
    // toán học thông thường, phải đảo dấu khi áp dụng vào transform màn hình.
    let rotatePivotWorld: { x: number; y: number } | null = null;
    let rotateDeg = 0;
    if (shape.type === 'ellipse' || shape.type === 'semi_ellipse') {
      const center = pointsMap.get(shape.centerId);
      if (center && shape.rotation) {
        rotatePivotWorld = center;
        rotateDeg = shape.rotation;
      }
    } else if (
      shape.type === 'rectangle' ||
      shape.type === 'square' ||
      shape.type === 'rounded_rectangle'
    ) {
      const p1 = pointsMap.get(shape.pointIds[0]);
      const p2 = pointsMap.get(shape.pointIds[1]);
      if (p1 && p2 && shape.rotation) {
        rotatePivotWorld = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        rotateDeg = shape.rotation;
      }
    }

    let transformAttr: string | undefined;
    if (rotatePivotWorld && rotateDeg) {
      const pivotScreen = worldToScreen(rotatePivotWorld.x, rotatePivotWorld.y, viewport);
      transformAttr = `rotate(${-rotateDeg}, ${pivotScreen.x}, ${pivotScreen.y})`;
    }

    const handleShapeMouseDown = (e: React.MouseEvent) => {
      if (activeTool !== 'select') return; // các tool khác giữ nguyên hành vi cũ, không can thiệp
      e.stopPropagation();
      if (e.ctrlKey || e.metaKey) return; // đang multi-select để gộp, không khởi động kéo hình

      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const rawWorld = screenToWorld(sx, sy, viewport);

      const pointIds = getShapeDefiningPointIds(shape);
      const pointSnapshots = pointIds
        .map((id) => pointsMap.get(id))
        .filter(Boolean)
        .map((p) => ({ id: p!.id, x: p!.x, y: p!.y }));

      const controlsSnapshot =
        shape.type === 'bezier'
          ? shape.controls.map(([cp1, cp2]) => [{ ...cp1 }, { ...cp2 }] as [BezierControlPoint, BezierControlPoint])
          : undefined;

      setDraggingShapeId(shape.id);
      setShapeDragStart({ wx: rawWorld.x, wy: rawWorld.y, pointSnapshots, controlsSnapshot });
    };

    const shapeOpacity = shape.hidden ? 0.35 : 1;

    return (
      <g
        key={shape.id}
        onClick={(e) => handleShapeClick(shape.id, e)}
        onMouseDown={handleShapeMouseDown}
        className={activeTool === 'select' ? 'cursor-move' : activeTool === 'toggle_visibility' ? 'cursor-help' : 'cursor-pointer'}
        transform={transformAttr}
        opacity={shapeOpacity}
      >
        {content}
      </g>
    );
  };

  // ----------------------------------------------------
  // Render Dynamic Preview during creation
  // ----------------------------------------------------
  const renderPreview = () => {
    const previewColor = '#b45309'; // requirement: màu nét preview đang vẽ nét đứt
    const mouseW = { x: mousePos.wx, y: mousePos.wy };
    const mouseS = { x: mousePos.sx, y: mousePos.sy };

    if (activeTool === 'measure' && tempPoints.length === 2) {
      const [p1, p2] = tempPoints;
      const s1 = worldToScreen(p1.x, p1.y, viewport);
      const s2 = worldToScreen(p2.x, p2.y, viewport);
      const midS = { x: (s1.x + s2.x) / 2, y: (s1.y + s2.y) / 2 };
      return (
        <g>
          <line x1={s1.x} y1={s1.y} x2={s2.x} y2={s2.y} stroke="#7c3aed" strokeWidth={1.5} strokeDasharray="4 3" />
          <text
            x={midS.x}
            y={midS.y - 8}
            textAnchor="middle"
            className="text-[11px] font-mono-code fill-[#7c3aed] font-semibold"
            style={{ paintOrder: 'stroke', stroke: 'white', strokeWidth: 3 }}
          >
            {formatCm(dist(p1, p2))} cm
          </text>
        </g>
      );
    }

    if (activeTool === 'segment' && tempPoints.length === 1) {
      const s1 = worldToScreen(tempPoints[0].x, tempPoints[0].y, viewport);
      return (
        <line
          x1={s1.x}
          y1={s1.y}
          x2={mouseS.x}
          y2={mouseS.y}
          stroke={previewColor}
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
      );
    }

    // Nhãn đoạn thẳng (\path): chỉ tô sáng điểm A đã chọn, KHÔNG kéo đường ra theo chuột
    // (tránh gây cảm giác đang vẽ một đoạn thẳng thật).
    if (activeTool === 'path_segment_label' && tempPoints.length === 1) {
      const s1 = worldToScreen(tempPoints[0].x, tempPoints[0].y, viewport);
      return (
        <circle
          cx={s1.x}
          cy={s1.y}
          r={7}
          fill="none"
          stroke={previewColor}
          strokeWidth={2}
          strokeDasharray="3 2"
        />
      );
    }

    if (activeTool === 'polyline' && polylinePoints.length > 0) {
      const placedPts = polylinePoints.map((id) => pointsMap.get(id)).filter(Boolean) as GeoPoint[];
      if (placedPts.length > 0) {
        const confirmedStr = placedPts
          .map((p) => {
            const s = worldToScreen(p.x, p.y, viewport);
            return `${s.x},${s.y}`;
          })
          .join(' ');
        const lastPt = placedPts[placedPts.length - 1];
        const sLast = worldToScreen(lastPt.x, lastPt.y, viewport);
        return (
          <g>
            {placedPts.length > 1 && (
              <polyline
                points={confirmedStr}
                stroke={previewColor}
                strokeWidth={1.5}
                fill="none"
                strokeLinejoin="round"
              />
            )}
            <line
              x1={sLast.x}
              y1={sLast.y}
              x2={mouseS.x}
              y2={mouseS.y}
              stroke={previewColor}
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
          </g>
        );
      }
    }

    if (activeTool === 'circle' && tempPoints.length === 1) {
      const center = tempPoints[0];
      const sCenter = worldToScreen(center.x, center.y, viewport);
      const rPx = dist(center, mouseW) * viewport.scale;
      return (
        <circle
          cx={sCenter.x}
          cy={sCenter.y}
          r={rPx}
          stroke={previewColor}
          strokeWidth={1.5}
          strokeDasharray="5 4"
          fill="none"
        />
      );
    }

    if (activeTool === 'semicircle' && tempPoints.length === 1) {
      const center = tempPoints[0];
      const pts = getSemicirclePoints(center, mouseW, 36);
      const pointsStr = pts
        .map((p) => {
          const s = worldToScreen(p.x, p.y, viewport);
          return `${s.x},${s.y}`;
        })
        .join(' ');
      return (
        <polygon
          points={pointsStr}
          stroke={previewColor}
          strokeWidth={1.5}
          strokeDasharray="5 4"
          fill="none"
        />
      );
    }

    if (activeTool === 'ellipse' && tempPoints.length === 1) {
      const center = tempPoints[0];
      const sCenter = worldToScreen(center.x, center.y, viewport);
      const rx = Math.abs(mouseW.x - center.x) * viewport.scale || 10;
      return (
        <ellipse
          cx={sCenter.x}
          cy={sCenter.y}
          rx={rx}
          ry={rx * 0.6}
          stroke={previewColor}
          strokeWidth={1.5}
          strokeDasharray="5 4"
          fill="none"
        />
      );
    }

    if (activeTool === 'ellipse' && tempPoints.length === 2) {
      const [center, rxPt] = tempPoints;
      const sCenter = worldToScreen(center.x, center.y, viewport);
      const rx = (Math.abs(rxPt.x - center.x) || dist(center, rxPt)) * viewport.scale;
      const ry = Math.abs(mouseW.y - center.y) * viewport.scale || 10;
      return (
        <ellipse
          cx={sCenter.x}
          cy={sCenter.y}
          rx={rx}
          ry={ry}
          stroke={previewColor}
          strokeWidth={1.5}
          strokeDasharray="5 4"
          fill="none"
        />
      );
    }

    if (activeTool === 'semi_ellipse' && tempPoints.length === 1) {
      const center = tempPoints[0];
      const ptsResult = getSemiEllipsePoints(center, mouseW, { x: center.x, y: center.y + 1 }, 36);
      const pointsStr = ptsResult.points
        .map((p) => {
          const s = worldToScreen(p.x, p.y, viewport);
          return `${s.x},${s.y}`;
        })
        .join(' ');
      return (
        <polygon
          points={pointsStr}
          stroke={previewColor}
          strokeWidth={1.5}
          strokeDasharray="5 4"
          fill="none"
        />
      );
    }

    if (activeTool === 'semi_ellipse' && tempPoints.length === 2) {
      const [center, rxPt] = tempPoints;
      const ptsResult = getSemiEllipsePoints(center, rxPt, mouseW, 36);
      const pointsStr = ptsResult.points
        .map((p) => {
          const s = worldToScreen(p.x, p.y, viewport);
          return `${s.x},${s.y}`;
        })
        .join(' ');
      return (
        <polygon
          points={pointsStr}
          stroke={previewColor}
          strokeWidth={1.5}
          strokeDasharray="5 4"
          fill="none"
        />
      );
    }

    if (activeTool === 'rectangle' && tempPoints.length === 1) {
      const s1 = worldToScreen(tempPoints[0].x, tempPoints[0].y, viewport);
      const x = Math.min(s1.x, mouseS.x);
      const y = Math.min(s1.y, mouseS.y);
      const w = Math.abs(mouseS.x - s1.x);
      const h = Math.abs(mouseS.y - s1.y);
      return (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          stroke={previewColor}
          strokeWidth={1.5}
          strokeDasharray="5 4"
          fill="none"
        />
      );
    }

    if (activeTool === 'rounded_rectangle' && tempPoints.length === 1) {
      const s1 = worldToScreen(tempPoints[0].x, tempPoints[0].y, viewport);
      const x = Math.min(s1.x, mouseS.x);
      const y = Math.min(s1.y, mouseS.y);
      const w = Math.abs(mouseS.x - s1.x);
      const h = Math.abs(mouseS.y - s1.y);
      const rx = 0.3 * viewport.scale;
      return (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={rx}
          ry={rx}
          stroke={previewColor}
          strokeWidth={1.5}
          strokeDasharray="5 4"
          fill="none"
        />
      );
    }

    if (activeTool === 'square' && tempPoints.length === 1) {
      const p1 = tempPoints[0];
      const s1 = worldToScreen(p1.x, p1.y, viewport);
      const dx = mouseW.x - p1.x;
      const dy = mouseW.y - p1.y;
      const side = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
      const p2World = {
        x: p1.x + (dx >= 0 ? side : -side),
        y: p1.y + (dy >= 0 ? side : -side),
      };
      const s2 = worldToScreen(p2World.x, p2World.y, viewport);
      const x = Math.min(s1.x, s2.x);
      const y = Math.min(s1.y, s2.y);
      const w = Math.abs(s2.x - s1.x);
      const h = Math.abs(s2.y - s1.y);
      return (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          stroke={previewColor}
          strokeWidth={1.5}
          strokeDasharray="5 4"
          fill="none"
        />
      );
    }

    if (activeTool === 'parabola' && tempPoints.length === 1) {
      const vertex = tempPoints[0];
      const ptsResult = getParabolaPoints(vertex, mouseW, 40);
      const pointsStr = ptsResult.points
        .map((p) => {
          const s = worldToScreen(p.x, p.y, viewport);
          return `${s.x},${s.y}`;
        })
        .join(' ');
      return (
        <polyline
          points={pointsStr}
          stroke={previewColor}
          strokeWidth={1.5}
          strokeDasharray="5 4"
          fill="none"
        />
      );
    }

    if (activeTool === 'hyperbola' && tempPoints.length === 1) {
      const center = tempPoints[0];
      const { branch1, branch2 } = getHyperbolaPoints(center, mouseW, 30);
      const b1Str = branch1
        .map((p) => {
          const s = worldToScreen(p.x, p.y, viewport);
          return `${s.x},${s.y}`;
        })
        .join(' ');
      const b2Str = branch2
        .map((p) => {
          const s = worldToScreen(p.x, p.y, viewport);
          return `${s.x},${s.y}`;
        })
        .join(' ');
      return (
        <g>
          <polyline
            points={b1Str}
            stroke={previewColor}
            strokeWidth={1.5}
            strokeDasharray="5 4"
            fill="none"
          />
          <polyline
            points={b2Str}
            stroke={previewColor}
            strokeWidth={1.5}
            strokeDasharray="5 4"
            fill="none"
          />
        </g>
      );
    }

    if (activeTool === 'regular_polygon' && tempPoints.length === 1) {
      const center = tempPoints[0];
      const vertices = getRegularPolygonVertices(center, mouseW, polygonSides);
      const pointsStr = vertices
        .map((v) => {
          const s = worldToScreen(v.x, v.y, viewport);
          return `${s.x},${s.y}`;
        })
        .join(' ');
      return (
        <polygon
          points={pointsStr}
          stroke={previewColor}
          strokeWidth={1.5}
          strokeDasharray="5 4"
          fill="none"
        />
      );
    }

    if (activeTool === 'arc_3p' && tempPoints.length === 2) {
      const [p1, p2] = tempPoints;
      const arcInfo = getArc3PSvgPath(p1, p2, mouseW, viewport);
      return (
        <path
          d={arcInfo.path}
          stroke={previewColor}
          strokeWidth={1.5}
          strokeDasharray="5 4"
          fill="none"
        />
      );
    }

    if (activeTool === 'param_arc' && pickingArcRadius && radiusPickPoints.length >= 1) {
      const p1 = radiusPickPoints[0];
      const s1 = worldToScreen(p1.x, p1.y, viewport);
      const s2 =
        radiusPickPoints.length === 2
          ? worldToScreen(radiusPickPoints[1].x, radiusPickPoints[1].y, viewport)
          : mouseS;
      return <line x1={s1.x} y1={s1.y} x2={s2.x} y2={s2.y} stroke="#0284c7" strokeWidth={1.5} strokeDasharray="4 3" />;
    }

    if (activeTool === 'param_arc' && paramArcStartPointId) {
      const startPt = pointsMap.get(paramArcStartPointId);
      if (startPt) {
        const pts = getParamArcPoints(startPt, arcStartAngle, arcEndAngle, arcRadius, 48);
        const pointsStr = pts
          .map((p) => {
            const s = worldToScreen(p.x, p.y, viewport);
            return `${s.x},${s.y}`;
          })
          .join(' ');
        return (
          <polyline points={pointsStr} stroke={previewColor} strokeWidth={1.5} strokeDasharray="5 4" fill="none" />
        );
      }
    }

    if (activeTool === 'parallel' && (selectedRefShapeId || axisRef) && tempPoints.length === 1) {
      const refPts = resolveRefLinePoints();
      if (refPts) {
        const through = tempPoints[0];
        const endPt = computeParallelEndPoint(refPts.p1, refPts.p2, through, mouseW);
        const sThrough = worldToScreen(through.x, through.y, viewport);
        const sEnd = worldToScreen(endPt.x, endPt.y, viewport);
        return (
          <line
            x1={sThrough.x}
            y1={sThrough.y}
            x2={sEnd.x}
            y2={sEnd.y}
            stroke={previewColor}
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
        );
      }
    }

    if (activeTool === 'perpendicular' && (selectedRefShapeId || axisRef) && tempPoints.length === 1) {
      const refPts = resolveRefLinePoints();
      if (refPts) {
        const through = tempPoints[0];
        const { endPoint, dirU, dirV } = computePerpendicularEndPoint(refPts.p1, refPts.p2, through, mouseW);
        const sThrough = worldToScreen(through.x, through.y, viewport);
        const sEnd = worldToScreen(endPoint.x, endPoint.y, viewport);
        const mark = getRightAngleMark(through, dirU, dirV, 0.35);
        const sm1 = worldToScreen(mark.p1.x, mark.p1.y, viewport);
        const sm2 = worldToScreen(mark.p2.x, mark.p2.y, viewport);
        const sm3 = worldToScreen(mark.p3.x, mark.p3.y, viewport);

        return (
          <g>
            <line
              x1={sThrough.x}
              y1={sThrough.y}
              x2={sEnd.x}
              y2={sEnd.y}
              stroke={previewColor}
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
            <polyline
              points={`${sm1.x},${sm1.y} ${sm2.x},${sm2.y} ${sm3.x},${sm3.y}`}
              stroke="#059669"
              strokeWidth={1.5}
              fill="none"
            />
          </g>
        );
      }
    }

    return null;
  };

  // ----------------------------------------------------
  // Render Points and LaTeX-like Labels
  // ----------------------------------------------------
  const renderPoints = () => {
    return points.map((pt) => {
      const isSelected = selectedPointId === pt.id;
      const isHovered = hoveredPointId === pt.id;
      const s = worldToScreen(pt.x, pt.y, viewport);

      // Label offset positioning using custom angle and distance
      const { angle: labelAngle, distance: labelDist } = getPointLabelAngleDistance(pt);
      const labelAngleRad = (labelAngle * Math.PI) / 180;
      const labelX = s.x + Math.cos(labelAngleRad) * labelDist;
      const labelY = s.y - Math.sin(labelAngleRad) * labelDist; // trừ vì màn hình Y hướng xuống
      const textAnchor: 'start' | 'middle' | 'end' =
        Math.cos(labelAngleRad) > 0.3 ? 'start' : Math.cos(labelAngleRad) < -0.3 ? 'end' : 'middle';

      const isHidden = pt.style?.pointStyle === 'hidden';
      const pointOpacity = pt.hidden ? 0.35 : 1;

      return (
        <g
          key={pt.id}
          className={activeTool === 'toggle_visibility' ? 'cursor-help select-none' : 'cursor-move select-none'}
          opacity={pointOpacity}
          onClick={(e) => {
            e.stopPropagation();
            if (activeTool === 'toggle_visibility') {
              onUpdatePoint(pt.id, { hidden: !pt.hidden });
              return;
            }
            onSelectPoint(pt.id);
            onSelectShape(null);
          }}
        >
          {/* Outer selection or hover ring */}
          {(isSelected || isHovered) && (
            <circle
              cx={s.x}
              cy={s.y}
              r={9}
              fill="none"
              stroke="#2f5d99"
              strokeWidth={1.5}
              strokeDasharray={isSelected ? undefined : '2 2'}
              className="animate-pulse"
            />
          )}

          {/* Point Dot */}
          {!isHidden && (
            <>
              {pt.style?.pointStyle === 'circle' ? (
                <circle
                  cx={s.x}
                  cy={s.y}
                  r={4}
                  fill="#ffffff"
                  stroke={pt.style?.color || '#16233a'}
                  strokeWidth={1.5}
                />
              ) : pt.style?.pointStyle === 'cross' ? (
                <g stroke={pt.style?.color || '#16233a'} strokeWidth={1.5}>
                  <line x1={s.x - 3.5} y1={s.y - 3.5} x2={s.x + 3.5} y2={s.y + 3.5} />
                  <line x1={s.x - 3.5} y1={s.y + 3.5} x2={s.x + 3.5} y2={s.y - 3.5} />
                </g>
              ) : (
                /* Default solid filled dot */
                <circle
                  cx={s.x}
                  cy={s.y}
                  r={3.5}
                  fill={isSelected ? '#2f5d99' : pt.style?.color || '#16233a'}
                />
              )}
            </>
          )}

          {/* Math Label in EB Garamond Italic */}
          {pt.label && (
            <>
              <text
                x={labelX}
                y={labelY}
                textAnchor={textAnchor}
                className="font-math text-[15px] font-medium fill-[#16233a] pointer-events-none select-none drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]"
              >
                {pt.label.includes('_') ? (
                  <>
                    <tspan>{pt.label.split('_')[0]}</tspan>
                    <tspan dy="3" fontSize="10px">
                      {pt.label.split('_')[1]}
                    </tspan>
                  </>
                ) : (
                  pt.label
                )}
              </text>
              {/* Vùng bấm kéo nhãn — vòng tròn vô hình lớn hơn xung quanh vị trí nhãn */}
              <circle
                cx={labelX}
                cy={labelY}
                r={12}
                fill="transparent"
                className="cursor-move"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  if (activeTool !== 'select') return;
                  setDraggingLabelPointId(pt.id);
                }}
              />
            </>
          )}
        </g>
      );
    });
  };

  return (
    <div
      ref={containerRef}
      id="geometry-canvas-container"
      className={`relative flex-1 h-full bg-[#eef2f6] overflow-hidden select-none ${
        isPanning
          ? 'cursor-grabbing'
          : activeTool === 'select'
          ? 'cursor-default'
          : activeTool === 'toggle_visibility'
          ? 'cursor-help'
          : activeTool === 'move_background'
          ? (bgImage?.locked ? 'cursor-not-allowed' : 'cursor-move')
          : 'cursor-crosshair'
      }`}
      onWheel={handleWheel}
    >
      {/* Rulers */}
      {renderRulers()}

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        id="geo-svg-stage"
        className="w-full h-full block"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <defs>
          {/* Subtle Grid Pattern */}
          <pattern
            id="canvas-grid-pattern"
            width={viewport.scale}
            height={viewport.scale}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${viewport.width / 2 + viewport.panX}, ${
              viewport.height / 2 + viewport.panY
            })`}
          >
            {/* 0.5cm sub-grid */}
            <path
              d={`M ${viewport.scale / 2} 0 L ${viewport.scale / 2} ${viewport.scale} M 0 ${
                viewport.scale / 2
              } L ${viewport.scale} ${viewport.scale / 2}`}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="0.5"
              strokeDasharray="2 2"
            />
            {/* 1.0cm main grid line */}
            <path
              d={`M ${viewport.scale} 0 L 0 0 0 ${viewport.scale}`}
              fill="none"
              stroke="#dbe4ee"
              strokeWidth="1"
            />
          </pattern>
        </defs>

        {/* Paper Grid background */}
        {settings.showGrid && (
          <rect width="100%" height="100%" fill="url(#canvas-grid-pattern)" />
        )}

        {/* Coordinate Axes (Oxy) if enabled */}
        {settings.showAxes && (
          <g className="opacity-60">
            {(activeTool === 'parallel' || activeTool === 'perpendicular') && !selectedRefShapeId && !axisRef && (
              <>
                <line
                  x1={0}
                  y1={viewport.height / 2 + viewport.panY}
                  x2={viewport.width}
                  y2={viewport.height / 2 + viewport.panY}
                  stroke="transparent"
                  strokeWidth={14}
                  className="cursor-pointer"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setAxisRef('x');
                  }}
                />
                <line
                  x1={viewport.width / 2 + viewport.panX}
                  y1={0}
                  x2={viewport.width / 2 + viewport.panX}
                  y2={viewport.height}
                  stroke="transparent"
                  strokeWidth={14}
                  className="cursor-pointer"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setAxisRef('y');
                  }}
                />
              </>
            )}
            {/* X Axis */}
            <line
              x1={0}
              y1={viewport.height / 2 + viewport.panY}
              x2={viewport.width}
              y2={viewport.height / 2 + viewport.panY}
              stroke={axisRef === 'x' ? '#2f5d99' : '#5b6b82'}
              strokeWidth={axisRef === 'x' ? 2.5 : 1.5}
              className="pointer-events-none"
            />
            {/* Y Axis */}
            <line
              x1={viewport.width / 2 + viewport.panX}
              y1={0}
              x2={viewport.width / 2 + viewport.panX}
              y2={viewport.height}
              stroke={axisRef === 'y' ? '#2f5d99' : '#5b6b82'}
              strokeWidth={axisRef === 'y' ? 2.5 : 1.5}
              className="pointer-events-none"
            />
            {/* Origin O label */}
            <text
              x={viewport.width / 2 + viewport.panX + 5}
              y={viewport.height / 2 + viewport.panY + 14}
              className="text-[11px] font-math font-medium fill-[#5b6b82]"
            >
              O
            </text>
          </g>
        )}

        {/* Layer 0: Background Image for Tracing (Anchored at Bottom-Left corner) */}
        {bgImage?.dataUrl && (
          <g id="background-image-layer">
            {(() => {
              const baseWidthCm = 10 * (bgImage.scale ?? 1);
              const baseHeightCm = baseWidthCm * (bgImage.naturalAspect || 1);
              const widthPx = baseWidthCm * viewport.scale;
              const heightPx = baseHeightCm * viewport.scale;

              // Anchor is bottom-left (panX, panY). Top-left corner in Cartesian world coordinates is (panX, panY + baseHeightCm)
              const topLeftS = worldToScreen(
                bgImage.panX ?? 0,
                (bgImage.panY ?? 0) + baseHeightCm,
                viewport
              );
              const x = topLeftS.x;
              const y = topLeftS.y;

              return (
                <image
                  href={bgImage.dataUrl}
                  x={x}
                  y={y}
                  width={widthPx}
                  height={heightPx}
                  opacity={bgImage.opacity ?? 0.4}
                  preserveAspectRatio="none"
                  className={activeTool === 'move_background' ? 'cursor-move' : 'pointer-events-none'}
                />
              );
            })()}
          </g>
        )}

        {/* Layer 1: Geometric Shapes */}
        <g id="shapes-layer">{shapes.map((s) => renderShapeElement(s))}</g>

        {/* Layer 2: Dynamic Live Preview (nét đứt #b45309) */}
        <g id="preview-layer">{renderPreview()}</g>

        {/* Layer 2.5: Path Annotations (Nhãn ghi chú) */}
        <g id="path-annotations-layer">{renderPathAnnotations()}</g>

        {/* Layer 3: Geometric Points & Labels */}
        <g id="points-layer">{renderPoints()}</g>
      </svg>

      {/* Top-Left Zoom Controls */}
      <div className="absolute top-8 left-8 z-20 flex items-center bg-white/95 backdrop-blur-xs border border-[#dbe4ee] rounded-md shadow-xs p-1 space-x-1">
        <button
          onClick={handleZoomIn}
          title="Phóng to (+)"
          className="p-1.5 rounded hover:bg-[#f1f5f9] text-[#16233a] transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          title="Thu nhỏ (-)"
          className="p-1.5 rounded hover:bg-[#f1f5f9] text-[#16233a] transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="w-[1px] h-4 bg-[#dbe4ee]" />
        <button
          onClick={handleResetView}
          title="Tỉ lệ chuẩn 1:1 & Về gốc (0,0)"
          className="p-1.5 rounded hover:bg-[#f1f5f9] text-[#16233a] text-xs font-semibold px-2 transition-colors flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" />
          <span>{Math.round((viewport.scale / 40) * 100)}%</span>
        </button>
      </div>

      {activeTool === 'eyedropper' && pickedColor && (() => {
        const rgbStr = `{rgb,255:red,${pickedColor.r};green,${pickedColor.g};blue,${pickedColor.b}}`;
        const selectedShape = shapes.find((s) => s.id === selectedShapeId);
        return (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20 bg-white/95 backdrop-blur-xs border border-[#dbe4ee] rounded-md shadow-xs p-3 flex flex-col gap-2 min-w-[240px]">
            <div className="flex items-center gap-2">
              <span
                className="w-7 h-7 rounded border border-[#dbe4ee] shrink-0"
                style={{ backgroundColor: pickedColor.hex }}
              />
              <span className="text-xs font-mono-code text-[#16233a] font-semibold">
                {pickedColor.hex.toUpperCase()}
              </span>
              <span className="text-[10px] text-[#5b6b82] font-mono-code">
                rgb({pickedColor.r},{pickedColor.g},{pickedColor.b})
              </span>
            </div>
            <div className="text-[10px] font-mono-code text-[#5b6b82] bg-[#f8fafc] p-1.5 rounded border border-[#dbe4ee] break-all leading-relaxed">
              {rgbStr}
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(rgbStr);
                  setColorCopied(true);
                  setTimeout(() => setColorCopied(false), 1500);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold px-2 py-1.5 rounded transition-colors ${
                  colorCopied
                    ? 'text-white bg-[#059669]'
                    : 'text-white bg-[#2f5d99] hover:bg-[#254a7a]'
                }`}
              >
                {colorCopied ? (
                  <>
                    <Check className="w-3 h-3" />
                    <span>Đã chép!</span>
                  </>
                ) : (
                  'Sao chép mã TikZ'
                )}
              </button>
            </div>
            {selectedShape ? (
              <div className="flex gap-1.5">
                <button
                  onClick={() =>
                    onUpdateShape(selectedShape.id, { style: { ...selectedShape.style, color: pickedColor.hex } })
                  }
                  className="flex-1 text-[11px] font-medium text-[#16233a] bg-white border border-[#dbe4ee] hover:bg-[#f1f5f9] px-2 py-1.5 rounded transition-colors"
                >
                  Đặt màu nét
                </button>
                <button
                  onClick={() =>
                    onUpdateShape(selectedShape.id, { style: { ...selectedShape.style, fillColor: pickedColor.hex } })
                  }
                  className="flex-1 text-[11px] font-medium text-[#16233a] bg-white border border-[#dbe4ee] hover:bg-[#f1f5f9] px-2 py-1.5 rounded transition-colors"
                >
                  Đặt màu tô
                </button>
              </div>
            ) : (
              <p className="text-[10px] text-[#94a3b8] italic">Chọn 1 hình bằng tool "Chọn" để áp màu này trực tiếp.</p>
            )}
          </div>
        );
      })()}

      {multiSelectedIds.length >= 2 && (() => {
        const mergeCheck = checkMergeEligibility();
        const chainCheck = checkChainEligibility();
        return (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20 bg-white/95 backdrop-blur-xs border border-[#dbe4ee] rounded-md shadow-xs px-3 py-2 flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#16233a]">{multiSelectedIds.length} hình đã chọn</span>
            <div className="flex items-center gap-2 flex-wrap">
              {mergeCheck.canMerge && (
                <button
                  onClick={handleMergeSelected}
                  className="text-xs font-semibold text-white bg-[#2f5d99] hover:bg-[#254a7a] px-3 py-1 rounded transition-colors"
                >
                  {mergeCheck.joiningExisting ? 'Thêm vào nhóm gộp' : 'Gộp thành 1 dòng mã'}
                </button>
              )}
              {chainCheck.canChain && (
                <button
                  onClick={handleChainSelected}
                  className="text-xs font-semibold text-white bg-[#059669] hover:bg-[#047857] px-3 py-1 rounded transition-colors"
                >
                  Nối liên tục{chainCheck.closed ? ' (khép kín)' : ''}
                </button>
              )}
              {!mergeCheck.canMerge && !chainCheck.canChain && (
                <span className="text-[11px] text-[#b91c1c]">
                  {chainCheck.reason || mergeCheck.reason}
                </span>
              )}
              <button
                onClick={() => setMultiSelectedIds([])}
                className="text-xs text-[#5b6b82] hover:text-[#16233a] px-2 py-1"
              >
                Huỷ chọn (Esc)
              </button>
            </div>
          </div>
        );
      })()}

      {activeTool === 'measure' && tempPoints.length === 2 && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20 bg-white/95 backdrop-blur-xs border border-[#dbe4ee] rounded-md shadow-xs px-3 py-2.5 flex flex-col gap-2 min-w-[220px]">
          <div className="text-xs text-[#16233a]">
            Khoảng cách: <span className="font-semibold text-[#7c3aed]">{formatCm(dist(tempPoints[0], tempPoints[1]))} cm</span>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => handleDivideSegment(2)} className="flex-1 text-[11px] font-medium text-[#16233a] bg-white border border-[#dbe4ee] hover:bg-[#f1f5f9] px-2 py-1.5 rounded transition-colors">
              Chia đôi
            </button>
            <button onClick={() => handleDivideSegment(3)} className="flex-1 text-[11px] font-medium text-[#16233a] bg-white border border-[#dbe4ee] hover:bg-[#f1f5f9] px-2 py-1.5 rounded transition-colors">
              Chia 3
            </button>
            <button onClick={() => handleDivideSegment(4)} className="flex-1 text-[11px] font-medium text-[#16233a] bg-white border border-[#dbe4ee] hover:bg-[#f1f5f9] px-2 py-1.5 rounded transition-colors">
              Chia 4
            </button>
          </div>
          <button onClick={() => setTempPoints([])} className="text-[11px] text-[#5b6b82] hover:text-[#16233a]">
            Đo cặp khác
          </button>
        </div>
      )}

      {activeTool !== 'select' && (
        <button
          onClick={() => onSelectTool('select')}
          title="Về công cụ Chọn (phím tắt: V)"
          className="absolute bottom-14 left-8 z-20 w-10 h-10 rounded-full bg-[#2f5d99] hover:bg-[#254a7a] text-white shadow-md flex items-center justify-center transition-colors cursor-pointer"
        >
          <MousePointer className="w-4 h-4" />
        </button>
      )}

      {/* Hộp nhập nội dung nhãn \path — hiện ra ngay sau khi đã chọn xong điểm/2 điểm */}
      {pendingPathAnnotation && (
        <div
          className="absolute z-30 bg-white border border-[#2f5d99] rounded-md shadow-md p-2 flex items-center gap-1.5"
          style={{
            left: pendingPathAnnotation.screenX,
            top: pendingPathAnnotation.screenY,
            transform: 'translate(-50%, -140%)',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <input
            ref={pendingLabelInputRef}
            type="text"
            value={pendingLabelText}
            onChange={(e) => setPendingLabelText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmPendingPathAnnotation();
              if (e.key === 'Escape') cancelPendingPathAnnotation();
            }}
            placeholder={pendingPathAnnotation.kind === 'segment_label' ? 'VD: $7\\,m$' : 'VD: $30^\\circ$'}
            className="text-xs w-36 px-2 py-1.5 border border-[#dbe4ee] rounded outline-none focus:border-[#2f5d99]"
          />
          <button
            onClick={confirmPendingPathAnnotation}
            title="Xác nhận (Enter)"
            className="w-7 h-7 shrink-0 rounded bg-[#2f5d99] hover:bg-[#254a7a] text-white flex items-center justify-center transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={cancelPendingPathAnnotation}
            title="Hủy (Esc)"
            className="w-7 h-7 shrink-0 rounded bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#5b6b82] flex items-center justify-center transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Bottom-Left Tool Instruction Hint */}
      <div className="absolute bottom-3 left-8 z-20 max-w-md bg-white/95 backdrop-blur-xs border border-[#dbe4ee] rounded-md shadow-xs px-3 py-1.5 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#2f5d99] animate-ping shrink-0" />
        <span className="text-xs text-[#16233a] font-medium leading-tight">
          {getToolHint()}
        </span>
      </div>

      {/* Bottom-Right Live Coordinates Readout */}
      <div className="absolute bottom-3 right-4 z-20 bg-white/95 backdrop-blur-xs border border-[#dbe4ee] rounded-md shadow-xs px-2.5 py-1 text-xs font-mono-code text-[#16233a] tracking-tight">
        <span>x: {formatCm(mousePos.wx)} cm</span>
        <span className="mx-1 text-[#5b6b82]">·</span>
        <span>y: {formatCm(mousePos.wy)} cm</span>
      </div>
    </div>
  );
};

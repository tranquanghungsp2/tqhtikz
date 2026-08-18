export type ToolType =
  | 'select'
  | 'point'
  | 'point_on_line'
  | 'measure'
  | 'segment'
  | 'polyline'
  | 'circle'
  | 'ellipse'
  | 'rectangle'
  | 'square'
  | 'rounded_rectangle'
  | 'semicircle'
  | 'semi_ellipse'
  | 'parabola'
  | 'hyperbola'
  | 'regular_polygon'
  | 'arc_3p'
  | 'param_arc'
  | 'bezier'
  | 'intersection'
  | 'parallel'
  | 'perpendicular'
  | 'move_background'
  | 'eyedropper'
  | 'toggle_visibility'
  | 'path_segment_label'
  | 'path_offset_label';

export type LabelPosition =
  | 'auto'
  | 'above'
  | 'below'
  | 'left'
  | 'right'
  | 'above left'
  | 'above right'
  | 'below left'
  | 'below right';

export type PointStyle = 'dot' | 'circle' | 'cross' | 'hidden';

export interface GeoPoint {
  id: string;
  label: string;
  x: number; // world x in cm
  y: number; // world y in cm
  labelPos?: LabelPosition;
  labelAngleDeg?: number; // góc nhãn tự do (độ, 0=phải, 90=trên, quy ước toán học), nếu có thì ƯU TIÊN hơn labelPos
  labelDistance?: number; // khoảng cách nhãn tới điểm, đơn vị pt (typographic point, khớp TikZ), mặc định 8
  hidden?: boolean; // true = ẩn khỏi mã TikZ xuất ra (dùng toạ độ thô), vẫn hiện mờ trên canvas
  style?: {
    color?: string;
    pointStyle?: PointStyle;
    radius?: number; // visual radius in px
  };
  // If this point is constrained (derived from other shapes, not freely draggable off its constraint)
  derivedFrom?:
    | {
        type: 'intersection';
        shapeId1: string;
        shapeId2: string;
        index?: number;
        edgeIndex1?: number; // nếu shapeId1 là hình nhiều cạnh (HCN/gấp khúc), lưu đúng cạnh nào đã chọn
        edgeIndex2?: number; // tương tự cho shapeId2
      }
    | {
        type: 'pointOnLine';
        shapeId: string; // id của đường chứa điểm này (segment / parallel_line / perpendicular_line)
        t: number; // tham số vị trí: point = p1 + t*(p2 - p1), không giới hạn 0..1
        edgeIndex?: number;
      }
    | {
        type: 'segmentDivision';
        pointId1: string;
        pointId2: string;
        t: number; // t: 0..1 tính từ pointId1 đến pointId2
      }
    | {
        type: 'paramArcEnd';
        shapeId: string; // điểm cuối của param_arc, tự tính lại theo shape
      }
    | {
        type: 'rectangleCorner';
        xSourceId: string;
        ySourceId: string;
      };
}

export type DashPattern = 'solid' | 'dashed' | 'dotted' | 'dashdotted';

export interface ShapeStyle {
  color: string;
  strokeWidth: number; // in pt (e.g. 1 = 1pt, 1.5, 2)
  dashPattern: DashPattern;
  fillColor?: string; // transparent or rgba or hex
  fillOpacity?: number;
}

export type ShapeType =
  | 'segment'
  | 'polyline'
  | 'circle'
  | 'ellipse'
  | 'rectangle'
  | 'square'
  | 'rounded_rectangle'
  | 'semicircle'
  | 'semi_ellipse'
  | 'parabola'
  | 'hyperbola'
  | 'regular_polygon'
  | 'arc_3p'
  | 'param_arc'
  | 'bezier'
  | 'parallel_line'
  | 'perpendicular_line';

export interface BaseShape {
  id: string;
  type: ShapeType;
  style: ShapeStyle;
  name?: string;
  mergeGroupId?: string; // các shape cùng mergeGroupId sẽ được gộp thành 1 dòng \draw khi xuất TikZ (nếu cùng style)
  chainGroupId?: string; // các shape cùng chainGroupId được nối liên tục thành 1 path khi xuất TikZ
  hidden?: boolean; // true = loại bỏ hoàn toàn khỏi mã TikZ xuất ra, vẫn hiện mờ trên canvas
}

export interface SegmentShape extends BaseShape {
  type: 'segment';
  pointIds: [string, string];
}

export interface PolylineShape extends BaseShape {
  type: 'polyline';
  pointIds: string[];
  isClosed: boolean;
}

export interface CircleShape extends BaseShape {
  type: 'circle';
  centerId: string;
  radiusPointId: string; // radius = distance(center, radiusPoint)
}

export interface EllipseShape extends BaseShape {
  type: 'ellipse';
  centerId: string;
  rxPointId: string; // defines horizontal semi-axis
  ryPointId: string; // defines vertical semi-axis
  rotation?: number; // độ (degree), mặc định 0, chiều dương = ngược kim đồng hồ
}

export interface RectangleShape extends BaseShape {
  type: 'rectangle';
  pointIds: [string, string]; // corner 1 and opposite corner 2
  isSquare?: boolean;
  rotation?: number; // độ (degree), mặc định 0, chiều dương = ngược kim đồng hồ
}

export interface SquareShape extends BaseShape {
  type: 'square';
  pointIds: [string, string]; // corner 1 and opposite corner 2 (clamped to square)
  rotation?: number; // độ (degree), mặc định 0, chiều dương = ngược kim đồng hồ
}

export interface RoundedRectangleShape extends BaseShape {
  type: 'rounded_rectangle';
  pointIds: [string, string]; // corner 1 and opposite corner 2
  cornerRadius?: number; // corner radius in cm (default 0.3cm)
  rotation?: number; // độ (degree), mặc định 0, chiều dương = ngược kim đồng hồ
}

export interface SemicircleShape extends BaseShape {
  type: 'semicircle';
  centerId: string;
  radiusPointId: string; // defines radius and cut direction
}

export interface SemiEllipseShape extends BaseShape {
  type: 'semi_ellipse';
  centerId: string;
  rxPointId: string; // defines cut axis
  ryPointId: string; // defines bulging direction & vertical radius
  rotation?: number; // độ (degree), mặc định 0, chiều dương = ngược kim đồng hồ
}

export interface ParabolaShape extends BaseShape {
  type: 'parabola';
  vertexId: string; // vertex of parabola
  throughId: string; // point that parabola passes through
}

export interface HyperbolaShape extends BaseShape {
  type: 'hyperbola';
  centerId: string; // center of symmetry
  pointId: string; // point defining opening/vertices of branches
}

export interface RegularPolygonShape extends BaseShape {
  type: 'regular_polygon';
  centerId: string;
  vertexId: string; // first vertex defining radius & rotation
  sides: number; // 3 to 12
}

export interface Arc3PShape extends BaseShape {
  type: 'arc_3p';
  pointIds: [string, string, string]; // P1 (start), P2 (through), P3 (end)
}

export interface ParamArcShape extends BaseShape {
  type: 'param_arc';
  startPointId: string; // điểm (x,y) trong cú pháp arc(...) — nằm TRÊN đường tròn tại góc bắt đầu
  endPointId: string; // điểm THẬT tại vị trí kết thúc cung — có thể click nối vào hình khác
  startAngle: number; // độ
  endAngle: number; // độ
  radius: number; // cm
  radiusSource?: { pointId1: string; pointId2: string; divisor: number }; // nếu có, bán kính tự cập nhật theo khoảng cách 2 điểm này
}

export interface BezierControlPoint {
  x: number; // world x in cm
  y: number; // world y in cm
}

export interface BezierShape extends BaseShape {
  type: 'bezier';
  anchorIds: string[]; // Anchor points on the curve
  // For each segment i between anchor[i] and anchor[i+1], two control points [cp1, cp2]
  controls: Array<[BezierControlPoint, BezierControlPoint]>;
  isClosed: boolean;
}

export interface ParallelLineShape extends BaseShape {
  type: 'parallel_line';
  referenceShapeId: string; // ID of the line/segment to be parallel with
  throughPointId: string; // Anchor point
  endPointId: string; // End point locked parallel
}

export interface PerpendicularLineShape extends BaseShape {
  type: 'perpendicular_line';
  referenceShapeId: string; // ID of the line/segment to be perpendicular with
  throughPointId: string; // Anchor point
  endPointId: string; // End point locked perpendicular
  showRightAngleMark?: boolean;
}

export type GeoShape =
  | SegmentShape
  | PolylineShape
  | CircleShape
  | EllipseShape
  | RectangleShape
  | SquareShape
  | RoundedRectangleShape
  | SemicircleShape
  | SemiEllipseShape
  | ParabolaShape
  | HyperbolaShape
  | RegularPolygonShape
  | Arc3PShape
  | ParamArcShape
  | BezierShape
  | ParallelLineShape
  | PerpendicularLineShape;

export interface BackgroundImageState {
  dataUrl: string | null;
  fileName: string;
  opacity: number; // 0 to 1 (default 0.4)
  scale: number; // multiplier (default 1)
  panX: number; // world X in cm of bottom-left corner (default 0)
  panY: number; // world Y in cm of bottom-left corner (default 0)
  naturalAspect: number; // height / width of image
  locked?: boolean; // when true, canvas dragging is locked
}

export interface Viewport {
  panX: number; // in pixels
  panY: number; // in pixels
  scale: number; // pixels per cm (default e.g. 40)
  width: number;
  height: number;
}

export interface HistoryState {
  points: GeoPoint[];
  shapes: GeoShape[];
  pointCounter: number;
  pathAnnotations?: PathAnnotation[];
}

export interface AppSettings {
  showGrid: boolean;
  snapToGrid: boolean;
  gridStep: number; // in cm (e.g. 0.5 or 1)
  showAxes: boolean;
  rulerStep: number; // in cm (1cm)
  autoLabel: boolean;
}

export interface TikZExportOptions {
  standalone: boolean;
  includeLabels: boolean;
  includePoints: boolean;
  scale: number;
  useColorDefinitions: boolean;
  pathAnnotations?: PathAnnotation[];
}

export type PathAnnotation =
  | {
      id: string;
      type: 'segment_label';
      point1Id: string;
      point2Id: string;
      text: string;           // Ví dụ: $7\,m$ hoặc Mặt đê
      pos?: number;           // Vị trí (mặc định 0.5)
      positionOption?: string;// above, below, left, right, above left, ...
    }
  | {
      id: string;
      type: 'point_offset_label';
      pointId: string;
      text: string;           // Ví dụ: $\alpha^\circ$ hoặc $30^\circ$
      angle: number;          // Góc độ (độ)
      distancePt: number;     // Khoảng cách (pt)
    };

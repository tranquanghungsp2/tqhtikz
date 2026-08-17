import { GeoPoint, GeoShape, Viewport, BezierControlPoint } from '../types';

export function worldToScreen(
  wx: number,
  wy: number,
  vp: Viewport
): { x: number; y: number } {
  return {
    x: vp.width / 2 + vp.panX + wx * vp.scale,
    y: vp.height / 2 + vp.panY - wy * vp.scale,
  };
}

export function screenToWorld(
  sx: number,
  sy: number,
  vp: Viewport
): { x: number; y: number } {
  return {
    x: (sx - vp.width / 2 - vp.panX) / vp.scale,
    y: -(sy - vp.height / 2 - vp.panY) / vp.scale,
  };
}

export function snapCoord(val: number, step: number = 0.5): number {
  return Math.round(val / step) * step;
}

export function formatCm(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

export function generatePointLabel(index: number): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (index < 26) {
    return letters[index];
  }
  const letter = letters[index % 26];
  const subscript = Math.floor(index / 26);
  return `${letter}_${subscript}`;
}

export function dist(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

export function closestPointOnSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): { x: number; y: number } {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-9) return { x: a.x, y: a.y };
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + t * abx, y: a.y + t * aby };
}

export function midpoint(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): { x: number; y: number } {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}

// Find circumcircle of 3 non-collinear points
export function circumcircle3P(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number }
): { center: { x: number; y: number }; radius: number } | null {
  const d = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y));
  if (Math.abs(d) < 1e-6) return null; // Collinear

  const p1Sq = p1.x * p1.x + p1.y * p1.y;
  const p2Sq = p2.x * p2.x + p2.y * p2.y;
  const p3Sq = p3.x * p3.x + p3.y * p3.y;

  const cx =
    (p1Sq * (p2.y - p3.y) + p2Sq * (p3.y - p1.y) + p3Sq * (p1.y - p2.y)) / d;
  const cy =
    (p1Sq * (p3.x - p2.x) + p2Sq * (p1.x - p3.x) + p3Sq * (p2.x - p1.x)) / d;

  const center = { x: cx, y: cy };
  const radius = dist(center, p1);
  return { center, radius };
}

// Helper to determine SVG arc path for 3 points in world coords converted to screen coords
export function getArc3PSvgPath(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  vp: Viewport
): { path: string; center?: { x: number; y: number }; radius?: number; startAngle?: number; endAngle?: number } {
  const circle = circumcircle3P(p1, p2, p3);
  if (!circle || circle.radius < 1e-4) {
    const s1 = worldToScreen(p1.x, p1.y, vp);
    const s2 = worldToScreen(p2.x, p2.y, vp);
    const s3 = worldToScreen(p3.x, p3.y, vp);
    return { path: `M ${s1.x} ${s1.y} L ${s2.x} ${s2.y} L ${s3.x} ${s3.y}` };
  }

  const s1 = worldToScreen(p1.x, p1.y, vp);
  const s2 = worldToScreen(p2.x, p2.y, vp);
  const s3 = worldToScreen(p3.x, p3.y, vp);
  const sCenter = worldToScreen(circle.center.x, circle.center.y, vp);
  const screenRadius = circle.radius * vp.scale;

  // Angles in screen coordinate system (y goes down)
  const a1 = Math.atan2(s1.y - sCenter.y, s1.x - sCenter.x);
  const a2 = Math.atan2(s2.y - sCenter.y, s2.x - sCenter.x);
  const a3 = Math.atan2(s3.y - sCenter.y, s3.x - sCenter.x);

  // Normalize angle difference to [0, 2pi)
  const normalizeAngle = (a: number) => {
    while (a < 0) a += 2 * Math.PI;
    while (a >= 2 * Math.PI) a -= 2 * Math.PI;
    return a;
  };

  const diff13_CW = normalizeAngle(a3 - a1);
  const diff12_CW = normalizeAngle(a2 - a1);

  // If p2 is on the CW path from p1 to p3
  const isSweepCW = diff12_CW <= diff13_CW;
  const sweepFlag = isSweepCW ? 1 : 0;
  const angleSpan = isSweepCW ? diff13_CW : (2 * Math.PI - diff13_CW);
  const largeArcFlag = angleSpan > Math.PI ? 1 : 0;

  // For TikZ: math angles in world coords (Y goes UP)
  const mathA1 = normalizeAngle(Math.atan2(p1.y - circle.center.y, p1.x - circle.center.x));
  const mathA2 = normalizeAngle(Math.atan2(p2.y - circle.center.y, p2.x - circle.center.x));
  const mathA3 = normalizeAngle(Math.atan2(p3.y - circle.center.y, p3.x - circle.center.x));

  const path = `M ${s1.x} ${s1.y} A ${screenRadius} ${screenRadius} 0 ${largeArcFlag} ${sweepFlag} ${s3.x} ${s3.y}`;
  return {
    path,
    center: circle.center,
    radius: circle.radius,
    startAngle: (mathA1 * 180) / Math.PI,
    endAngle: (mathA3 * 180) / Math.PI,
  };
}

// Calculate regular polygon vertices given center and first vertex
export function getRegularPolygonVertices(
  center: { x: number; y: number },
  vertex: { x: number; y: number },
  sides: number
): Array<{ x: number; y: number }> {
  const r = dist(center, vertex);
  const startAngle = Math.atan2(vertex.y - center.y, vertex.x - center.x);
  const vertices: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < sides; i++) {
    const angle = startAngle + (i * 2 * Math.PI) / sides;
    vertices.push({
      x: center.x + r * Math.cos(angle),
      y: center.y + r * Math.sin(angle),
    });
  }
  return vertices;
}

// Parallel line projection: given reference line P1->P2, through-point P, mouse M
export function computeParallelEndPoint(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  through: { x: number; y: number },
  mouse: { x: number; y: number }
): { x: number; y: number } {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-5) {
    return { x: through.x + 2, y: through.y };
  }
  const ux = dx / len;
  const uy = dy / len;

  // Project vector (mouse - through) onto direction (ux, uy)
  const mx = mouse.x - through.x;
  const my = mouse.y - through.y;
  let proj = mx * ux + my * uy;

  // If mouse is too close to through point, default to reference line length
  if (Math.abs(proj) < 0.2) {
    proj = len;
  }

  return {
    x: through.x + proj * ux,
    y: through.y + proj * uy,
  };
}

// Perpendicular line projection: given reference line P1->P2, through-point P, mouse M
export function computePerpendicularEndPoint(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  through: { x: number; y: number },
  mouse: { x: number; y: number }
): { endPoint: { x: number; y: number }; dirU: { x: number; y: number }; dirV: { x: number; y: number } } {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-5) {
    return {
      endPoint: { x: through.x, y: through.y + 2 },
      dirU: { x: 1, y: 0 },
      dirV: { x: 0, y: 1 },
    };
  }
  const ux = dx / len;
  const uy = dy / len;

  // Perpendicular unit vector (rotated +90 degrees)
  const vx = -uy;
  const vy = ux;

  // Project vector (mouse - through) onto (vx, vy)
  const mx = mouse.x - through.x;
  const my = mouse.y - through.y;
  let proj = mx * vx + my * vy;

  if (Math.abs(proj) < 0.2) {
    proj = len;
  }

  return {
    endPoint: {
      x: through.x + proj * vx,
      y: through.y + proj * vy,
    },
    dirU: { x: ux, y: uy },
    dirV: { x: vx * Math.sign(proj || 1), y: vy * Math.sign(proj || 1) },
  };
}

// Calculate right angle symbol corners for SVG rendering
export function getRightAngleMark(
  origin: { x: number; y: number },
  dir1: { x: number; y: number },
  dir2: { x: number; y: number },
  sizeCm: number = 0.35
): { p1: { x: number; y: number }; p2: { x: number; y: number }; p3: { x: number; y: number } } {
  const len1 = Math.hypot(dir1.x, dir1.y) || 1;
  const len2 = Math.hypot(dir2.x, dir2.y) || 1;
  const u1 = { x: (dir1.x / len1) * sizeCm, y: (dir1.y / len1) * sizeCm };
  const u2 = { x: (dir2.x / len2) * sizeCm, y: (dir2.y / len2) * sizeCm };

  const p1 = { x: origin.x + u1.x, y: origin.y + u1.y };
  const p2 = { x: origin.x + u1.x + u2.x, y: origin.y + u1.y + u2.y };
  const p3 = { x: origin.x + u2.x, y: origin.y + u2.y };

  return { p1, p2, p3 };
}

// Semicircle sampling: arc from baseAngle to baseAngle + 180 degrees
export function getSemicirclePoints(
  center: { x: number; y: number },
  radiusPoint: { x: number; y: number },
  numSamples: number = 48
): Array<{ x: number; y: number }> {
  const r = dist(center, radiusPoint);
  const baseAngle = Math.atan2(radiusPoint.y - center.y, radiusPoint.x - center.x);
  const points: Array<{ x: number; y: number }> = [];

  for (let i = 0; i <= numSamples; i++) {
    const theta = baseAngle + (i * Math.PI) / numSamples;
    points.push({
      x: center.x + r * Math.cos(theta),
      y: center.y + r * Math.sin(theta),
    });
  }
  return points;
}

// Semi-ellipse sampling: semi-axis rx along (center -> rxPoint), semi-axis ry along perpendicular
export function getSemiEllipsePoints(
  center: { x: number; y: number },
  rxPoint: { x: number; y: number },
  ryPoint: { x: number; y: number },
  numSamples: number = 48
): { points: Array<{ x: number; y: number }>; rx: number; ry: number; baseAngleDeg: number; isFlipped: boolean } {
  const rx = dist(center, rxPoint) || 1;
  const ry = dist(center, ryPoint) || (0.6 * rx);

  const dx = rxPoint.x - center.x;
  const dy = rxPoint.y - center.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  // v is perpendicular rotated +90 deg CCW: (-uy, ux)
  let vx = -uy;
  let vy = ux;

  // Check if ryPoint is in direction of v or -v
  const dot = (ryPoint.x - center.x) * vx + (ryPoint.y - center.y) * vy;
  const isFlipped = dot < 0;
  if (isFlipped) {
    vx = -vx;
    vy = -vy;
  }

  const baseAngleDeg = (Math.atan2(uy, ux) * 180) / Math.PI;

  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= numSamples; i++) {
    const t = (i * Math.PI) / numSamples;
    const cosT = Math.cos(t);
    const sinT = Math.sin(t);
    points.push({
      x: center.x + rx * cosT * ux + ry * sinT * vx,
      y: center.y + rx * cosT * uy + ry * sinT * vy,
    });
  }

  return { points, rx, ry, baseAngleDeg, isFlipped };
}

// Parabola sampling: vertex (h, k), passes through (x0, y0), vertical axis
export function getParabolaPoints(
  vertex: { x: number; y: number },
  through: { x: number; y: number },
  numSamples: number = 60
): { points: Array<{ x: number; y: number }>; a: number; span: number } {
  const dx = through.x - vertex.x;
  const dy = through.y - vertex.y;
  const denom = Math.abs(dx) > 1e-4 ? dx * dx : 1;
  const a = dy / denom;

  const span = Math.max(Math.abs(dx) * 1.25, 2.5);
  const xMin = vertex.x - span;
  const xMax = vertex.x + span;

  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= numSamples; i++) {
    const x = xMin + (i * (xMax - xMin)) / numSamples;
    const y = vertex.y + a * (x - vertex.x) * (x - vertex.x);
    points.push({ x, y });
  }

  return { points, a, span };
}

// Hyperbola sampling: center (h, k), point (x0, y0) defining a and b
export function getHyperbolaPoints(
  center: { x: number; y: number },
  point: { x: number; y: number },
  numSamples: number = 40
): {
  branch1: Array<{ x: number; y: number }>;
  branch2: Array<{ x: number; y: number }>;
  a: number;
  b: number;
} {
  const a = Math.abs(point.x - center.x) || 1;
  const b = Math.abs(point.y - center.y) || 0.6 * a;

  const tMin = -1.5;
  const tMax = 1.5;

  const branch1: Array<{ x: number; y: number }> = [];
  const branch2: Array<{ x: number; y: number }> = [];

  for (let i = 0; i <= numSamples; i++) {
    const t = tMin + (i * (tMax - tMin)) / numSamples;
    const coshT = Math.cosh(t);
    const sinhT = Math.sinh(t);

    branch1.push({
      x: center.x + a * coshT,
      y: center.y + b * sinhT,
    });

    branch2.push({
      x: center.x - a * coshT,
      y: center.y + b * sinhT,
    });
  }

  return { branch1, branch2, a, b };
}

// Generate default Bezier control points for N segments (1/3 and 2/3 between anchor points)
export function generateDefaultBezierControls(
  anchors: Array<{ x: number; y: number }>,
  isClosed: boolean
): Array<[BezierControlPoint, BezierControlPoint]> {
  const controls: Array<[BezierControlPoint, BezierControlPoint]> = [];
  const count = isClosed ? anchors.length : anchors.length - 1;

  for (let i = 0; i < count; i++) {
    const a1 = anchors[i];
    const a2 = anchors[(i + 1) % anchors.length];
    const cp1: BezierControlPoint = {
      x: a1.x + (a2.x - a1.x) / 3,
      y: a1.y + (a2.y - a1.y) / 3,
    };
    const cp2: BezierControlPoint = {
      x: a1.x + (2 * (a2.x - a1.x)) / 3,
      y: a1.y + (2 * (a2.y - a1.y)) / 3,
    };
    controls.push([cp1, cp2]);
  }
  return controls;
}

// Find intersection of two infinite lines (p1->p2 and p3->p4)
export function intersectLineLine(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number }
): { x: number; y: number } | null {
  const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(denom) < 1e-7) return null; // Parallel or coincident

  const t =
    ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom;

  return {
    x: p1.x + t * (p2.x - p1.x),
    y: p1.y + t * (p2.y - p1.y),
  };
}

// Find intersection of line (p1->p2) with circle (center C, radius R)
export function intersectLineCircle(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  c: { x: number; y: number },
  r: number
): Array<{ x: number; y: number }> {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const a = dx * dx + dy * dy;
  if (a < 1e-8) return [];

  const b = 2 * (dx * (p1.x - c.x) + dy * (p1.y - c.y));
  const cc = (p1.x - c.x) * (p1.x - c.x) + (p1.y - c.y) * (p1.y - c.y) - r * r;
  const delta = b * b - 4 * a * cc;

  if (delta < -1e-6) return [];
  if (Math.abs(delta) <= 1e-6) {
    const t = -b / (2 * a);
    return [{ x: p1.x + t * dx, y: p1.y + t * dy }];
  }

  const sqrtDelta = Math.sqrt(delta);
  const t1 = (-b - sqrtDelta) / (2 * a);
  const t2 = (-b + sqrtDelta) / (2 * a);

  return [
    { x: p1.x + t1 * dx, y: p1.y + t1 * dy },
    { x: p1.x + t2 * dx, y: p1.y + t2 * dy },
  ];
}

// Find intersection of circle C1(r1) and circle C2(r2)
export function intersectCircleCircle(
  c1: { x: number; y: number },
  r1: number,
  c2: { x: number; y: number },
  r2: number
): Array<{ x: number; y: number }> {
  const d = dist(c1, c2);
  if (d < 1e-6 || d > r1 + r2 + 1e-6 || d < Math.abs(r1 - r2) - 1e-6) {
    return [];
  }

  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));

  const x2 = c1.x + (a * (c2.x - c1.x)) / d;
  const y2 = c1.y + (a * (c2.y - c1.y)) / d;

  if (h < 1e-6) {
    return [{ x: x2, y: y2 }];
  }

  const rx = -(c2.y - c1.y) * (h / d);
  const ry = (c2.x - c1.x) * (h / d);

  return [
    { x: x2 + rx, y: y2 + ry },
    { x: x2 - rx, y: y2 - ry },
  ];
}

// Given 2 shapes, find all geometric intersection points
export function findShapeIntersections(
  s1: GeoShape,
  s2: GeoShape,
  pointsMap: Map<string, GeoPoint>
): Array<{ x: number; y: number }> {
  const getLinePts = (shape: GeoShape): [{ x: number; y: number }, { x: number; y: number }] | null => {
    if (shape.type === 'segment') {
      const p1 = pointsMap.get(shape.pointIds[0]);
      const p2 = pointsMap.get(shape.pointIds[1]);
      if (p1 && p2) return [p1, p2];
    } else if (shape.type === 'parallel_line' || shape.type === 'perpendicular_line') {
      const p1 = pointsMap.get(shape.throughPointId);
      const p2 = pointsMap.get(shape.endPointId);
      if (p1 && p2) return [p1, p2];
    }
    return null;
  };

  const getCircleInfo = (shape: GeoShape): { center: { x: number; y: number }; radius: number } | null => {
    if (shape.type === 'circle') {
      const center = pointsMap.get(shape.centerId);
      const radPt = pointsMap.get(shape.radiusPointId);
      if (center && radPt) {
        return { center, radius: dist(center, radPt) };
      }
    }
    return null;
  };

  const line1 = getLinePts(s1);
  const line2 = getLinePts(s2);
  const circle1 = getCircleInfo(s1);
  const circle2 = getCircleInfo(s2);

  if (line1 && line2) {
    const inter = intersectLineLine(line1[0], line1[1], line2[0], line2[1]);
    return inter ? [inter] : [];
  }

  if (line1 && circle2) {
    return intersectLineCircle(line1[0], line1[1], circle2.center, circle2.radius);
  }

  if (circle1 && line2) {
    return intersectLineCircle(line2[0], line2[1], circle1.center, circle1.radius);
  }

  if (circle1 && circle2) {
    return intersectCircleCircle(circle1.center, circle1.radius, circle2.center, circle2.radius);
  }

  return [];
}

// Find nearest existing point on screen
export function findNearestPoint(
  screenX: number,
  screenY: number,
  points: GeoPoint[],
  vp: Viewport,
  hitRadiusPx: number = 14
): GeoPoint | null {
  let nearest: GeoPoint | null = null;
  let minDist = hitRadiusPx;

  for (const pt of points) {
    const s = worldToScreen(pt.x, pt.y, vp);
    const d = Math.hypot(s.x - screenX, s.y - screenY);
    if (d < minDist) {
      minDist = d;
      nearest = pt;
    }
  }

  return nearest;
}

// ----------------------------------------------------
// Chain merge: dò thứ tự + chiều nối nhiều mảnh path thành 1 đường liên tục
// ----------------------------------------------------
export interface ChainPieceInfo {
  id: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
}

// Trả về thứ tự + chiều (reversed) để nối các mảnh thành 1 chuỗi liên tục, bằng cách
// khớp đầu mút (trong ngưỡng epsilon cm). Trả null nếu không tìm được thứ tự hợp lệ
// nối được HẾT toàn bộ các mảnh (ví dụ 2 đầu mút không khớp nhau ở đâu cả).
export function findChainOrder(
  pieces: ChainPieceInfo[],
  epsilon: number = 0.05
): Array<{ id: string; reversed: boolean }> | null {
  if (pieces.length < 2) return null;
  const close = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y) < epsilon;

  for (let startIdx = 0; startIdx < pieces.length; startIdx++) {
    for (const startReversed of [false, true]) {
      const used = new Set<string>();
      const chain: Array<{ id: string; reversed: boolean }> = [];
      const first = pieces[startIdx];
      chain.push({ id: first.id, reversed: startReversed });
      used.add(first.id);
      let currentEnd = startReversed ? first.start : first.end;

      let progressed = true;
      while (used.size < pieces.length && progressed) {
        progressed = false;
        for (const p of pieces) {
          if (used.has(p.id)) continue;
          if (close(p.start, currentEnd)) {
            chain.push({ id: p.id, reversed: false });
            used.add(p.id);
            currentEnd = p.end;
            progressed = true;
            break;
          }
          if (close(p.end, currentEnd)) {
            chain.push({ id: p.id, reversed: true });
            used.add(p.id);
            currentEnd = p.start;
            progressed = true;
            break;
          }
        }
      }

      if (used.size === pieces.length) return chain;
    }
  }
  return null;
}

export function isChainClosed(
  pieces: ChainPieceInfo[],
  order: Array<{ id: string; reversed: boolean }>,
  epsilon: number = 0.05
): boolean {
  const map = new Map(pieces.map((p) => [p.id, p]));
  const firstPiece = map.get(order[0].id)!;
  const lastPiece = map.get(order[order.length - 1].id)!;
  const chainStart = order[0].reversed ? firstPiece.end : firstPiece.start;
  const chainEnd = order[order.length - 1].reversed ? lastPiece.start : lastPiece.end;
  return Math.hypot(chainStart.x - chainEnd.x, chainStart.y - chainEnd.y) < epsilon;
}

// Gom các mảnh (segment/bezier/arc.../param_arc) thành từng cụm LIÊN THÔNG dựa trên việc
// đầu mút của chúng có trùng nhau hay không (dùng union-find đơn giản). Mỗi cụm trả về là
// 1 mảng id các mảnh thuộc cùng 1 chuỗi nối được với nhau (không quan tâm thứ tự).
export function groupIntoConnectedComponents(
  pieces: ChainPieceInfo[],
  epsilon: number = 0.05
): string[][] {
  const n = pieces.length;
  const parent = pieces.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  const close = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y) < epsilon;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (
        close(pieces[i].start, pieces[j].start) ||
        close(pieces[i].start, pieces[j].end) ||
        close(pieces[i].end, pieces[j].start) ||
        close(pieces[i].end, pieces[j].end)
      ) {
        union(i, j);
      }
    }
  }

  const groups = new Map<number, string[]>();
  pieces.forEach((p, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(p.id);
  });
  return Array.from(groups.values());
}

// Lấy điểm đầu/cuối của 1 shape "nối được" (chainable). Trả null nếu shape không thuộc
// loại nối được, hoặc là polyline/bezier đã đóng kín sẵn (không có 2 đầu mút riêng biệt).
export function getShapeChainEndpoints(
  shape: GeoShape,
  pointsMap: Map<string, { x: number; y: number }>
): { start: { x: number; y: number }; end: { x: number; y: number } } | null {
  if (shape.type === 'segment' || shape.type === 'parallel_line' || shape.type === 'perpendicular_line') {
    const id1 = shape.type === 'segment' ? shape.pointIds[0] : shape.throughPointId;
    const id2 = shape.type === 'segment' ? shape.pointIds[1] : shape.endPointId;
    const a = pointsMap.get(id1);
    const b = pointsMap.get(id2);
    if (a && b) return { start: a, end: b };
  }
  if (shape.type === 'polyline' && !shape.isClosed && shape.pointIds.length >= 2) {
    const a = pointsMap.get(shape.pointIds[0]);
    const b = pointsMap.get(shape.pointIds[shape.pointIds.length - 1]);
    if (a && b) return { start: a, end: b };
  }
  if (shape.type === 'bezier' && !shape.isClosed && shape.anchorIds.length >= 2) {
    const a = pointsMap.get(shape.anchorIds[0]);
    const b = pointsMap.get(shape.anchorIds[shape.anchorIds.length - 1]);
    if (a && b) return { start: a, end: b };
  }
  if (shape.type === 'arc_3p') {
    const a = pointsMap.get(shape.pointIds[0]);
    const b = pointsMap.get(shape.pointIds[2]);
    if (a && b) return { start: a, end: b };
  }
  if (shape.type === 'param_arc') {
    const a = pointsMap.get(shape.startPointId);
    const b = pointsMap.get(shape.endPointId);
    if (a && b) return { start: a, end: b };
  }
  return null;
}

export function computeParamArcEndPoint(
  startPoint: { x: number; y: number },
  startAngleDeg: number,
  endAngleDeg: number,
  radius: number
): { x: number; y: number } {
  const startRad = (startAngleDeg * Math.PI) / 180;
  const center = {
    x: startPoint.x - radius * Math.cos(startRad),
    y: startPoint.y - radius * Math.sin(startRad),
  };
  const endRad = (endAngleDeg * Math.PI) / 180;
  return { x: center.x + radius * Math.cos(endRad), y: center.y + radius * Math.sin(endRad) };
}

// Tính toạ độ tâm & sample điểm trên cung, theo đúng quy ước TikZ arc(start:end:radius):
// center = startPoint - radius*(cos(startAngle), sin(startAngle))
export function getParamArcPoints(
  startPoint: { x: number; y: number },
  startAngleDeg: number,
  endAngleDeg: number,
  radius: number,
  samples: number = 48
): Array<{ x: number; y: number }> {
  const startRad = (startAngleDeg * Math.PI) / 180;
  const center = {
    x: startPoint.x - radius * Math.cos(startRad),
    y: startPoint.y - radius * Math.sin(startRad),
  };
  const endRad = (endAngleDeg * Math.PI) / 180;
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= samples; i++) {
    const t = startRad + ((endRad - startRad) * i) / samples;
    pts.push({ x: center.x + radius * Math.cos(t), y: center.y + radius * Math.sin(t) });
  }
  return pts;
}

// Trả về danh sách các cạnh (đoạn thẳng p1-p2) của 1 hình khép kín nhiều cạnh.
// Chỉ áp dụng cho các loại hình có nhiều cạnh rời rạc: hình chữ nhật (mọi biến thể) và đường gấp khúc.
export function getShapeEdges(
  shape: GeoShape,
  pointsMap: Map<string, GeoPoint>
): Array<{ p1: { x: number; y: number }; p2: { x: number; y: number } }> {
  if (shape.type === 'rectangle' || shape.type === 'rounded_rectangle' || shape.type === 'square') {
    const p1 = pointsMap.get(shape.pointIds[0]);
    const p2 = pointsMap.get(shape.pointIds[1]);
    if (!p1 || !p2) return [];
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);
    const c1 = { x: minX, y: minY };
    const c2 = { x: maxX, y: minY };
    const c3 = { x: maxX, y: maxY };
    const c4 = { x: minX, y: maxY };
    return [
      { p1: c1, p2: c2 },
      { p1: c2, p2: c3 },
      { p1: c3, p2: c4 },
      { p1: c4, p2: c1 },
    ];
  }
  if (shape.type === 'polyline') {
    const pts = shape.pointIds.map((id) => pointsMap.get(id)).filter(Boolean) as GeoPoint[];
    const edges: Array<{ p1: { x: number; y: number }; p2: { x: number; y: number } }> = [];
    for (let i = 0; i < pts.length - 1; i++) edges.push({ p1: pts[i], p2: pts[i + 1] });
    if (shape.isClosed && pts.length > 2) edges.push({ p1: pts[pts.length - 1], p2: pts[0] });
    return edges;
  }
  return [];
}

// Tìm cạnh GẦN 1 vị trí world nhất (để xác định người dùng vừa click trúng cạnh nào).
// Trả null nếu shape không thuộc loại nhiều cạnh (getShapeEdges trả mảng rỗng).
export function getClickedEdge(
  shape: GeoShape,
  worldPos: { x: number; y: number },
  pointsMap: Map<string, GeoPoint>
): { p1: { x: number; y: number }; p2: { x: number; y: number } } | null {
  const edges = getShapeEdges(shape, pointsMap);
  if (edges.length === 0) return null;
  let best: { p1: { x: number; y: number }; p2: { x: number; y: number } } | null = null;
  let bestDist = Infinity;
  for (const e of edges) {
    const proj = closestPointOnSegment(worldPos, e.p1, e.p2);
    const d = dist(worldPos, proj);
    if (d < bestDist) {
      bestDist = d;
      best = e;
    }
  }
  return best;
}

// Giống getClickedEdge nhưng trả về CHỈ SỐ cạnh thay vì toạ độ — dùng để lưu vào derivedFrom,
// nhờ đó tính lại được đúng cạnh này ngay cả khi các điểm của hình đã di chuyển.
export function getClickedEdgeIndex(
  shape: GeoShape,
  worldPos: { x: number; y: number },
  pointsMap: Map<string, GeoPoint>
): number | null {
  const edges = getShapeEdges(shape, pointsMap);
  if (edges.length === 0) return null;
  let bestIdx: number | null = null;
  let bestDist = Infinity;
  edges.forEach((e, idx) => {
    const proj = closestPointOnSegment(worldPos, e.p1, e.p2);
    const d = dist(worldPos, proj);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = idx;
    }
  });
  return bestIdx;
}

// Lấy lại toạ độ 1 cạnh theo chỉ số, dựa trên vị trí HIỆN TẠI của các điểm — dùng trong
// bước tính lại giao điểm mỗi khi hình bị kéo, luôn phản ánh đúng hình dạng mới nhất.
export function getEdgeByIndex(
  shape: GeoShape,
  edgeIndex: number,
  pointsMap: Map<string, GeoPoint>
): { p1: { x: number; y: number }; p2: { x: number; y: number } } | null {
  const edges = getShapeEdges(shape, pointsMap);
  return edges[edgeIndex] ?? null;
}

// Tính giao điểm giữa 1 CẠNH CỤ THỂ (đoạn thẳng rời, không gắn với 1 shape id nào) và 1 shape khác
// (đường thẳng hoặc đường tròn). Dùng khi 1 hoặc cả 2 phía của phép giao là 1 cạnh đã tách ra từ
// hình chữ nhật / đường gấp khúc, thay vì tính giao với cả hình.
export function findEdgeShapeIntersections(
  edge: { p1: { x: number; y: number }; p2: { x: number; y: number } },
  otherShape: GeoShape,
  pointsMap: Map<string, GeoPoint>
): Array<{ x: number; y: number }> {
  if (
    otherShape.type === 'segment' ||
    otherShape.type === 'parallel_line' ||
    otherShape.type === 'perpendicular_line'
  ) {
    const id1 = otherShape.type === 'segment' ? otherShape.pointIds[0] : otherShape.throughPointId;
    const id2 = otherShape.type === 'segment' ? otherShape.pointIds[1] : otherShape.endPointId;
    const p1 = pointsMap.get(id1);
    const p2 = pointsMap.get(id2);
    if (p1 && p2) {
      const r = intersectLineLine(edge.p1, edge.p2, p1, p2);
      return r ? [r] : [];
    }
  }
  if (otherShape.type === 'circle') {
    const center = pointsMap.get(otherShape.centerId);
    const radPt = pointsMap.get(otherShape.radiusPointId);
    if (center && radPt) return intersectLineCircle(edge.p1, edge.p2, center, dist(center, radPt));
  }
  return [];
}

// Giao điểm giữa 2 CẠNH cụ thể (cả 2 phía đều đã tách ra từ hình nhiều cạnh)
export function intersectEdgeEdge(
  edgeA: { p1: { x: number; y: number }; p2: { x: number; y: number } },
  edgeB: { p1: { x: number; y: number }; p2: { x: number; y: number } }
): { x: number; y: number } | null {
  return intersectLineLine(edgeA.p1, edgeA.p2, edgeB.p1, edgeB.p2);
}


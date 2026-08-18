import { GeoPoint, GeoShape, TikZExportOptions, RightAngleMark } from '../types';
import {
  dist,
  circumcircle3P,
  getRegularPolygonVertices,
  getRightAngleMark,
  computePerpendicularEndPoint,
  getSemiEllipsePoints,
  getParabolaPoints,
  getHyperbolaPoints,
  findChainOrder,
  isChainClosed,
  getShapeChainEndpoints,
  groupIntoConnectedComponents,
} from './geometry';

// Sanitize point label to be a valid TikZ coordinate identifier (letters, digits)
export function getTikZCoordName(point: GeoPoint): string {
  // e.g. "A" -> "A", "A_1" -> "A1", "M'" -> "Mprime"
  return point.label.replace(/[^a-zA-Z0-9]/g, '');
}

// Convert point label to Math LaTeX format e.g. "A_1" -> "$A_1$" or "O" -> "$O$"
export function getMathLabel(label: string): string {
  if (!label) return '';
  if (label.includes('_')) {
    const [main, sub] = label.split('_');
    return `$${main}_{${sub}}$`;
  }
  return `$${label}$`;
}

// Map hex color to standard TikZ color or custom definecolor
export function getTikZColorOption(hex: string): string | null {
  const cleanHex = hex.toLowerCase().trim();
  if (cleanHex === '#16233a' || cleanHex === '#000000' || cleanHex === '#111827') {
    return null; // default black/ink
  }
  if (cleanHex === '#b91c1c' || cleanHex === '#ef4444' || cleanHex === '#dc2626') return 'red';
  if (cleanHex === '#2f5d99' || cleanHex === '#3b82f6' || cleanHex === '#2563eb' || cleanHex === '#1d4ed8') return 'blue';
  if (cleanHex === '#059669' || cleanHex === '#10b981' || cleanHex === '#16a34a') return 'teal';
  if (cleanHex === '#b45309' || cleanHex === '#f59e0b' || cleanHex === '#d97706') return 'orange';
  if (cleanHex === '#7c3aed' || cleanHex === '#8b5cf6' || cleanHex === '#9333ea') return 'violet';
  if (cleanHex === '#db2777' || cleanHex === '#ec4899') return 'magenta';
  if (cleanHex === '#475569' || cleanHex === '#64748b') return 'gray';
  
  // Custom hex format for TikZ: [draw={rgb,255:red,22;green,35;blue,58}]
  const r = parseInt(cleanHex.slice(1, 3), 16);
  const g = parseInt(cleanHex.slice(3, 5), 16);
  const b = parseInt(cleanHex.slice(5, 7), 16);
  if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
    return `{rgb,255:red,${r};green,${g};blue,${b}}`;
  }
  return 'black';
}

export function formatNumber(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return rounded.toString();
}

export function getStyleOptions(style: GeoShape['style']): string[] {
  const options: string[] = [];

  // Line width
  if (style.strokeWidth === 0.5) options.push('very thin');
  else if (style.strokeWidth === 1) options.push('semithick');
  else if (style.strokeWidth === 1.5) options.push('thick');
  else if (style.strokeWidth === 2) options.push('very thick');
  else if (style.strokeWidth === 3) options.push('ultra thick');
  else if (style.strokeWidth !== 1) options.push(`line width=${style.strokeWidth}pt`);

  // Dash pattern
  if (style.dashPattern === 'dashed') options.push('dashed');
  else if (style.dashPattern === 'dotted') options.push('dotted');
  else if (style.dashPattern === 'dashdotted') options.push('dash dot');

  // Color
  const colorOpt = getTikZColorOption(style.color);
  if (colorOpt) {
    if (colorOpt.startsWith('{rgb')) {
      options.push(`draw=${colorOpt}`);
    } else {
      options.push(colorOpt);
    }
  }

  // Fill
  if (style.fillColor && style.fillColor !== 'transparent') {
    const fillColorOpt = getTikZColorOption(style.fillColor);
    if (fillColorOpt) {
      const opacity = style.fillOpacity !== undefined ? Math.round(style.fillOpacity * 100) : 20;
      options.push(`fill=${fillColorOpt}!${opacity}`);
    }
  }

  return options;
}

function buildChainSegmentString(
  shape: GeoShape,
  reversed: boolean,
  pointsMap: Map<string, GeoPoint>,
  rawCoord: (p: { x: number; y: number }) => string,
  coordFor: (p: GeoPoint) => string
): string | null {
  if (shape.type === 'segment' || shape.type === 'parallel_line' || shape.type === 'perpendicular_line') {
    const id1 = shape.type === 'segment' ? shape.pointIds[0] : shape.throughPointId;
    const id2 = shape.type === 'segment' ? shape.pointIds[1] : shape.endPointId;
    const a = pointsMap.get(id1);
    const b = pointsMap.get(id2);
    if (!a || !b) return null;
    return ` -- ${coordFor(reversed ? a : b)}`;
  }

  if (shape.type === 'polyline') {
    const pts = shape.pointIds.map((id) => pointsMap.get(id)).filter(Boolean) as GeoPoint[];
    if (pts.length < 2) return null;
    const ordered = reversed ? [...pts].reverse() : pts;
    return ordered.slice(1).map((p) => ` -- ${coordFor(p)}`).join('');
  }

  if (shape.type === 'bezier') {
    const anchors = shape.anchorIds.map((id) => pointsMap.get(id)).filter(Boolean) as GeoPoint[];
    if (anchors.length < 2 || shape.controls.length === 0) return null;
    let s = '';
    if (!reversed) {
      for (let i = 0; i < shape.controls.length; i++) {
        const [cp1, cp2] = shape.controls[i];
        s += ` .. controls ${rawCoord(cp1)} and ${rawCoord(cp2)} .. ${coordFor(anchors[i + 1])}`;
      }
    } else {
      for (let i = shape.controls.length - 1; i >= 0; i--) {
        const [cp1, cp2] = shape.controls[i];
        // đảo thứ tự 2 điểm điều khiển khi đi ngược chiều đoạn cong
        s += ` .. controls ${rawCoord(cp2)} and ${rawCoord(cp1)} .. ${coordFor(anchors[i])}`;
      }
    }
    return s;
  }

  if (shape.type === 'arc_3p') {
    const p1 = pointsMap.get(shape.pointIds[0]);
    const p2 = pointsMap.get(shape.pointIds[1]);
    const p3 = pointsMap.get(shape.pointIds[2]);
    if (!p1 || !p2 || !p3) return null;
    const circle = circumcircle3P(p1, p2, p3);
    if (!circle) return null;
    const startA = (Math.atan2(p1.y - circle.center.y, p1.x - circle.center.x) * 180) / Math.PI;
    const endA = (Math.atan2(p3.y - circle.center.y, p3.x - circle.center.x) * 180) / Math.PI;
    const a1 = reversed ? endA : startA;
    const a2 = reversed ? startA : endA;
    return ` arc [start angle=${formatNumber(a1)}, end angle=${formatNumber(a2)}, radius=${formatNumber(circle.radius)}cm]`;
  }

  if (shape.type === 'param_arc') {
    const a1 = reversed ? shape.endAngle : shape.startAngle;
    const a2 = reversed ? shape.startAngle : shape.endAngle;
    return ` arc (${formatNumber(a1)}:${formatNumber(a2)}:${formatNumber(shape.radius)}cm)`;
  }

  return null;
}

function buildFullSubpathString(
  shape: GeoShape,
  pointsMap: Map<string, GeoPoint>,
  rawCoord: (p: { x: number; y: number }) => string,
  coordFor: (p: GeoPoint) => string
): string | null {
  if (shape.type === 'segment' || shape.type === 'parallel_line' || shape.type === 'perpendicular_line') {
    const id1 = shape.type === 'segment' ? shape.pointIds[0] : shape.throughPointId;
    const id2 = shape.type === 'segment' ? shape.pointIds[1] : shape.endPointId;
    const a = pointsMap.get(id1);
    const b = pointsMap.get(id2);
    if (!a || !b) return null;
    return `${coordFor(a)} -- ${coordFor(b)}`;
  }

  if (shape.type === 'polyline') {
    const pts = shape.pointIds.map((id) => pointsMap.get(id)).filter(Boolean) as GeoPoint[];
    if (pts.length < 2) return null;
    let s = coordFor(pts[0]);
    for (let i = 1; i < pts.length; i++) s += ` -- ${coordFor(pts[i])}`;
    if (shape.isClosed) s += ' -- cycle';
    return s;
  }

  if (shape.type === 'bezier') {
    const anchors = shape.anchorIds.map((id) => pointsMap.get(id)).filter(Boolean) as GeoPoint[];
    if (anchors.length < 2 || shape.controls.length === 0) return null;
    let s = coordFor(anchors[0]);
    for (let i = 0; i < shape.controls.length; i++) {
      const [cp1, cp2] = shape.controls[i];
      s += ` .. controls ${rawCoord(cp1)} and ${rawCoord(cp2)} .. ${coordFor(anchors[i + 1])}`;
    }
    if (shape.isClosed) s += ' -- cycle';
    return s;
  }

  if (shape.type === 'arc_3p') {
    const p1 = pointsMap.get(shape.pointIds[0]);
    const p2 = pointsMap.get(shape.pointIds[1]);
    const p3 = pointsMap.get(shape.pointIds[2]);
    if (!p1 || !p2 || !p3) return null;
    const circle = circumcircle3P(p1, p2, p3);
    if (!circle) return null;
    const startA = (Math.atan2(p1.y - circle.center.y, p1.x - circle.center.x) * 180) / Math.PI;
    const endA = (Math.atan2(p3.y - circle.center.y, p3.x - circle.center.x) * 180) / Math.PI;
    return `${coordFor(p1)} arc [start angle=${formatNumber(startA)}, end angle=${formatNumber(endA)}, radius=${formatNumber(circle.radius)}cm]`;
  }

  if (shape.type === 'param_arc') {
    const startPt = pointsMap.get(shape.startPointId);
    if (!startPt) return null;
    return `${coordFor(startPt)} arc (${formatNumber(shape.startAngle)}:${formatNumber(shape.endAngle)}:${formatNumber(shape.radius)}cm)`;
  }

  return null;
}

export function generateTikZCodeWithLineMap(
  points: GeoPoint[],
  shapes: GeoShape[],
  options: TikZExportOptions = {
    standalone: true,
    includeLabels: true,
    includePoints: true,
    scale: 1,
    useColorDefinitions: true,
  }
): { code: string; shapeToLines: Map<string, number[]> } {
  const pointsMap = new Map<string, GeoPoint>();
  points.forEach((p) => pointsMap.set(p.id, p));

  // Trả về chuỗi "(x, y)" toạ độ số thô — dùng cho MỌI điểm trong MỌI lệnh vẽ,
  // không bao giờ dùng tên biến \coordinate, để mỗi dòng \draw độc lập, copy riêng vẫn chạy được.
  const rawCoord = (p: { x: number; y: number }): string =>
    `(${formatNumber(p.x)}, ${formatNumber(p.y)})`;

  const coordFor = (p: GeoPoint): string => {
    return p.hidden ? rawCoord(p) : `(${getTikZCoordName(p)})`;
  };

  const lines: string[] = [];

  const lineOwnerShapeIds: string[][] = [];
  const trackOwnership = (beforeLen: number, afterArr: string[], shapeIds: string[]) => {
    for (let i = beforeLen; i < afterArr.length; i++) {
      lineOwnerShapeIds[i] = shapeIds;
    }
  };

  if (options.standalone) {
    lines.push('% ==========================================');
    lines.push('% Geo TikZ Studio — LaTeX/TikZ Code Generator');
    lines.push('% Soạn đề thi Toán học — Chuẩn TikZ');
    lines.push('% ==========================================');
    lines.push('\\documentclass[tikz,border=8mm]{standalone}');
    lines.push('\\usepackage{amsmath,amssymb}');
    lines.push('\\usepackage{tikz}');
    lines.push('\\usetikzlibrary{calc,angles,quotes,patterns,arrows.meta}');
    lines.push('\\begin{document}');
    lines.push(`\\begin{tikzpicture}[scale=${options.scale}, >=stealth, line cap=round, line join=round]`);
  } else {
    lines.push(`\\begin{tikzpicture}[scale=${options.scale}, >=stealth, line cap=round, line join=round]`);
  }

  const visiblePoints = points.filter((p) => !p.hidden);
  if (visiblePoints.length > 0) {
    lines.push('');
    lines.push('  % --- Toạ độ điểm có nhãn ---');
    visiblePoints.forEach((p) => {
      lines.push(`  \\coordinate (${getTikZCoordName(p)}) at (${formatNumber(p.x)}, ${formatNumber(p.y)});`);
    });
  }

  // 1. Shapes drawing — toàn bộ dùng toạ độ số thô, không dùng tên điểm
  const shapeDrawLines: string[] = [];

  // --- Xử lý các nhóm đường đã được gộp (mergeGroupId) thành 1 dòng \draw duy nhất ---
  const MERGEABLE_TYPES = new Set(['segment', 'parallel_line', 'perpendicular_line', 'polyline', 'bezier', 'arc_3p', 'param_arc']);
  const mergeGroups = new Map<string, GeoShape[]>();
  for (const s of shapes) {
    if (s.mergeGroupId && MERGEABLE_TYPES.has(s.type)) {
      const arr = mergeGroups.get(s.mergeGroupId) || [];
      arr.push(s);
      mergeGroups.set(s.mergeGroupId, arr);
    }
  }
  const mergedShapeIds = new Set<string>();
  const getLineEndpoints = (s: GeoShape): [GeoPoint, GeoPoint] | null => {
    if (s.type === 'segment') {
      const a = pointsMap.get(s.pointIds[0]);
      const b = pointsMap.get(s.pointIds[1]);
      if (a && b) return [a, b];
    } else if (s.type === 'parallel_line' || s.type === 'perpendicular_line') {
      const a = pointsMap.get(s.throughPointId);
      const b = pointsMap.get(s.endPointId);
      if (a && b) return [a, b];
    }
    return null;
  };

  for (const groupShapes of mergeGroups.values()) {
    if (groupShapes.length < 2) continue;
    if (groupShapes.every((s) => s.hidden)) continue;
    const first = groupShapes[0];
    const sameStyle = groupShapes.every(
      (s) =>
        s.style.color === first.style.color &&
        s.style.strokeWidth === first.style.strokeWidth &&
        s.style.dashPattern === first.style.dashPattern
    );
    if (!sameStyle) continue;

    const shapeMap = new Map(groupShapes.map((s) => [s.id, s]));
    const pieces = groupShapes
      .map((s) => {
        const ep = getShapeChainEndpoints(s, pointsMap);
        return ep ? { id: s.id, start: ep.start, end: ep.end } : null;
      })
      .filter(Boolean) as Array<{ id: string; start: { x: number; y: number }; end: { x: number; y: number } }>;

    const subpaths: string[] = [];

    if (pieces.length === groupShapes.length) {
      // Mọi mảnh đều xác định được 2 đầu — gom thành các cụm liên thông theo đầu mút trùng nhau
      const components = groupIntoConnectedComponents(pieces);
      for (const compIds of components) {
        if (compIds.length === 1) {
          const s = shapeMap.get(compIds[0])!;
          const sp = buildFullSubpathString(s, pointsMap, rawCoord, coordFor);
          if (sp) subpaths.push(sp);
          continue;
        }

        const compPieces = pieces.filter((p) => compIds.includes(p.id));
        const order = findChainOrder(compPieces);

        if (order) {
          const firstEp = compPieces.find((p) => p.id === order[0].id)!;
          const chainStartPt = order[0].reversed ? firstEp.end : firstEp.start;
          let pathStr = rawCoord(chainStartPt);
          let ok = true;
          for (const step of order) {
            const s = shapeMap.get(step.id)!;
            const seg = buildChainSegmentString(s, step.reversed, pointsMap, rawCoord, coordFor);
            if (seg === null) {
              ok = false;
              break;
            }
            pathStr += seg;
          }
          if (ok) {
            if (isChainClosed(compPieces, order)) pathStr += ' -- cycle';
            subpaths.push(pathStr);
          } else {
            compIds.forEach((id) => {
              const sp = buildFullSubpathString(shapeMap.get(id)!, pointsMap, rawCoord, coordFor);
              if (sp) subpaths.push(sp);
            });
          }
        } else {
          // Không tìm được thứ tự nối hợp lệ (ví dụ 3 mảnh chụm chung 1 điểm) — không ép nối,
          // xuất riêng từng mảnh trong cụm.
          compIds.forEach((id) => {
            const sp = buildFullSubpathString(shapeMap.get(id)!, pointsMap, rawCoord, coordFor);
            if (sp) subpaths.push(sp);
          });
        }
      }
    } else {
      groupShapes.forEach((s) => {
        const sp = buildFullSubpathString(s, pointsMap, rawCoord, coordFor);
        if (sp) subpaths.push(sp);
      });
    }

    if (subpaths.length > 0) {
      const _beforeLen = shapeDrawLines.length;
      const styleOpts = getStyleOptions(first.style);
      const optStr = styleOpts.length > 0 ? `[${styleOpts.join(', ')}]` : '';
      shapeDrawLines.push(`  % --- ${groupShapes.length} đường đã gộp (tự nối liên tục các phần liền nhau) ---`);
      shapeDrawLines.push(`  \\draw${optStr} ${subpaths.join(' ')};`);
      groupShapes.forEach((s) => mergedShapeIds.add(s.id));
      trackOwnership(_beforeLen, shapeDrawLines, groupShapes.map((s) => s.id));
    }
  }

  // --- Xử lý các nhóm đường đã NỐI LIÊN TỤC (chainGroupId) thành 1 path duy nhất ---
  const CHAINABLE_TYPES = new Set(['segment', 'parallel_line', 'perpendicular_line', 'polyline', 'bezier', 'arc_3p', 'param_arc']);
  const chainGroups = new Map<string, GeoShape[]>();
  for (const s of shapes) {
    if (s.chainGroupId && CHAINABLE_TYPES.has(s.type)) {
      const arr = chainGroups.get(s.chainGroupId) || [];
      arr.push(s);
      chainGroups.set(s.chainGroupId, arr);
    }
  }

  for (const groupShapes of chainGroups.values()) {
    if (groupShapes.length < 2) continue;
    if (groupShapes.every((s) => s.hidden)) continue;
    const first = groupShapes[0];
    const sameStyle = groupShapes.every(
      (s) =>
        s.style.color === first.style.color &&
        s.style.strokeWidth === first.style.strokeWidth &&
        s.style.dashPattern === first.style.dashPattern
    );
    if (!sameStyle) continue;

    const pieces = groupShapes
      .map((s) => {
        const ep = getShapeChainEndpoints(s, pointsMap);
        return ep ? { id: s.id, start: ep.start, end: ep.end } : null;
      })
      .filter(Boolean) as Array<{ id: string; start: { x: number; y: number }; end: { x: number; y: number } }>;
    if (pieces.length !== groupShapes.length) continue;

    const order = findChainOrder(pieces);
    if (!order) continue;

    const shapeMap = new Map(groupShapes.map((s) => [s.id, s]));
    const firstEp = pieces.find((p) => p.id === order[0].id)!;
    const chainStartPt = order[0].reversed ? firstEp.end : firstEp.start;

    let pathStr = rawCoord(chainStartPt);
    let ok = true;
    for (const step of order) {
      const s = shapeMap.get(step.id)!;
      const seg = buildChainSegmentString(s, step.reversed, pointsMap, rawCoord, coordFor);
      if (seg === null) {
        ok = false;
        break;
      }
      pathStr += seg;
    }
    if (!ok) continue;

    const _beforeLen = shapeDrawLines.length;
    const closed = isChainClosed(pieces, order);
    if (closed) pathStr += ' -- cycle';

    const styleSource = shapeMap.get(order[0].id)!;
    const styleOpts = getStyleOptions(styleSource.style);
    const optStr = styleOpts.length > 0 ? `[${styleOpts.join(', ')}]` : '';
    shapeDrawLines.push(`  % --- ${groupShapes.length} đường đã nối liên tục${closed ? ', khép kín' : ''} ---`);
    shapeDrawLines.push(`  \\draw${optStr} ${pathStr};`);
    groupShapes.forEach((s) => mergedShapeIds.add(s.id));
    trackOwnership(_beforeLen, shapeDrawLines, groupShapes.map((s) => s.id));
  }

  if (shapes.length > 0) {
    for (const shape of shapes) {
      if (mergedShapeIds.has(shape.id)) continue;
      if (shape.hidden) continue;
      const _shapeBeforeLen = shapeDrawLines.length;
      const styleOpts = getStyleOptions(shape.style);
      const optStr = styleOpts.length > 0 ? `[${styleOpts.join(', ')}]` : '';

      switch (shape.type) {
        case 'segment': {
          const p1 = pointsMap.get(shape.pointIds[0]);
          const p2 = pointsMap.get(shape.pointIds[1]);
          if (p1 && p2) {
            shapeDrawLines.push(`  \\draw${optStr} ${coordFor(p1)} -- ${coordFor(p2)};`);
          }
          break;
        }

        case 'polyline': {
          const pts = shape.pointIds.map((id) => pointsMap.get(id)).filter(Boolean) as GeoPoint[];
          if (pts.length >= 2) {
            const coordPath = pts.map((p) => coordFor(p)).join(' -- ');
            const cycleStr = shape.isClosed ? ' -- cycle' : '';
            shapeDrawLines.push(`  \\draw${optStr} ${coordPath}${cycleStr};`);
          }
          break;
        }

        case 'circle': {
          const center = pointsMap.get(shape.centerId);
          const radPt = pointsMap.get(shape.radiusPointId);
          if (center && radPt) {
            const r = dist(center, radPt);
            shapeDrawLines.push(`  \\draw${optStr} ${coordFor(center)} circle (${formatNumber(r)}cm);`);
          }
          break;
        }

        case 'ellipse': {
          const center = pointsMap.get(shape.centerId);
          const rxPt = pointsMap.get(shape.rxPointId);
          const ryPt = pointsMap.get(shape.ryPointId);
          if (center && rxPt && ryPt) {
            const rx = Math.abs(rxPt.x - center.x) || dist(center, rxPt);
            const ry = Math.abs(ryPt.y - center.y) || dist(center, ryPt);
            const rotOpts = shape.rotation
              ? [`rotate around={${formatNumber(shape.rotation)}:${coordFor(center)}}`, ...styleOpts]
              : styleOpts;
            const ellipseOptStr = rotOpts.length > 0 ? `[${rotOpts.join(', ')}]` : '';
            shapeDrawLines.push(`  \\draw${ellipseOptStr} ${coordFor(center)} ellipse (${formatNumber(rx)}cm and ${formatNumber(ry)}cm);`);
          }
          break;
        }

        case 'rectangle':
        case 'square': {
          const p1 = pointsMap.get(shape.pointIds[0]);
          const p2 = pointsMap.get(shape.pointIds[1]);
          if (p1 && p2) {
            let rectOptStr = optStr;
            if (shape.rotation) {
              const pivot = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
              const rotOpts = [`rotate around={${formatNumber(shape.rotation)}:${rawCoord(pivot)}}`, ...styleOpts];
              rectOptStr = `[${rotOpts.join(', ')}]`;
            }
            shapeDrawLines.push(`  \\draw${rectOptStr} ${coordFor(p1)} rectangle ${coordFor(p2)};`);
          }
          break;
        }

        case 'rounded_rectangle': {
          const p1 = pointsMap.get(shape.pointIds[0]);
          const p2 = pointsMap.get(shape.pointIds[1]);
          if (p1 && p2) {
            const cornerRadius = shape.cornerRadius ?? 0.3;
            const roundOpt = `rounded corners=${formatNumber(cornerRadius)}cm`;
            const allOpts = [roundOpt, ...styleOpts];
            if (shape.rotation) {
              const pivot = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
              allOpts.push(`rotate around={${formatNumber(shape.rotation)}:${rawCoord(pivot)}}`);
            }
            const combinedOptStr = `[${allOpts.join(', ')}]`;
            shapeDrawLines.push(`  \\draw${combinedOptStr} ${coordFor(p1)} rectangle ${coordFor(p2)};`);
          }
          break;
        }

        case 'semicircle': {
          const center = pointsMap.get(shape.centerId);
          const radPt = pointsMap.get(shape.radiusPointId);
          if (center && radPt) {
            const r = dist(center, radPt);
            const baseAngle = (Math.atan2(radPt.y - center.y, radPt.x - center.x) * 180) / Math.PI;
            const endAngle = baseAngle + 180;
            shapeDrawLines.push(`  \\draw${optStr} ${coordFor(radPt)} arc [start angle=${formatNumber(baseAngle)}, end angle=${formatNumber(endAngle)}, radius=${formatNumber(r)}cm] -- cycle;`);
          }
          break;
        }

        case 'semi_ellipse': {
          const center = pointsMap.get(shape.centerId);
          const rxPt = pointsMap.get(shape.rxPointId);
          const ryPt = pointsMap.get(shape.ryPointId);
          if (center && rxPt && ryPt) {
            const { rx, ry, baseAngleDeg, isFlipped } = getSemiEllipsePoints(center, rxPt, ryPt);
            const startAngle = isFlipped ? 180 : 0;
            const endAngle = isFlipped ? 360 : 180;
            // Cộng dồn góc xoay người dùng nhập thêm vào góc nghiêng tự nhiên của trục cắt.
            const totalAngle = baseAngleDeg + (shape.rotation ?? 0);
            const rotateOpt = `rotate around={${formatNumber(totalAngle)}:${coordFor(center)}}`;
            const combinedOptStr = `[${[rotateOpt, ...styleOpts].join(', ')}]`;
            shapeDrawLines.push(`  \\draw${combinedOptStr} ${coordFor(rxPt)} arc [start angle=${startAngle}, end angle=${endAngle}, x radius=${formatNumber(rx)}cm, y radius=${formatNumber(ry)}cm] -- cycle;`);
          }
          break;
        }

        case 'parabola': {
          const vertex = pointsMap.get(shape.vertexId);
          const through = pointsMap.get(shape.throughId);
          if (vertex && through) {
            const { a, span } = getParabolaPoints(vertex, through);
            const x1 = formatNumber(vertex.x - span);
            const x2 = formatNumber(vertex.x + span);
            const plotOpts = [`domain=${x1}:${x2}`, 'smooth', 'variable=\\x', ...styleOpts];
            shapeDrawLines.push(`  \\draw[${plotOpts.join(', ')}] plot ({\\x}, {${formatNumber(vertex.y)} + ${formatNumber(a)}*(\\x - ${formatNumber(vertex.x)})^2});`);
          }
          break;
        }

        case 'hyperbola': {
          const center = pointsMap.get(shape.centerId);
          const point = pointsMap.get(shape.pointId);
          if (center && point) {
            const { a, b } = getHyperbolaPoints(center, point);
            const plotOpts = ['domain=-1.5:1.5', 'smooth', 'variable=\\t', ...styleOpts];
            shapeDrawLines.push(`  \\draw[${plotOpts.join(', ')}] plot ({${formatNumber(center.x)} + ${formatNumber(a)}*cosh(\\t)}, {${formatNumber(center.y)} + ${formatNumber(b)}*sinh(\\t)});`);
            shapeDrawLines.push(`  \\draw[${plotOpts.join(', ')}] plot ({${formatNumber(center.x)} - ${formatNumber(a)}*cosh(\\t)}, {${formatNumber(center.y)} + ${formatNumber(b)}*sinh(\\t)});`);
          }
          break;
        }

        case 'regular_polygon': {
          const center = pointsMap.get(shape.centerId);
          const vertex = pointsMap.get(shape.vertexId);
          if (center && vertex) {
            const vertices = getRegularPolygonVertices(center, vertex, shape.sides);
            const coordsStr = vertices.map((v) => rawCoord(v)).join(' -- ');
            shapeDrawLines.push(`  \\draw${optStr} ${coordsStr} -- cycle;`);
          }
          break;
        }

        case 'arc_3p': {
          const p1 = pointsMap.get(shape.pointIds[0]);
          const p2 = pointsMap.get(shape.pointIds[1]);
          const p3 = pointsMap.get(shape.pointIds[2]);
          if (p1 && p2 && p3) {
            const circle = circumcircle3P(p1, p2, p3);
            if (circle) {
              const startA = (Math.atan2(p1.y - circle.center.y, p1.x - circle.center.x) * 180) / Math.PI;
              const endA = (Math.atan2(p3.y - circle.center.y, p3.x - circle.center.x) * 180) / Math.PI;
              shapeDrawLines.push(`  \\draw${optStr} ${coordFor(p1)} arc [start angle=${formatNumber(startA)}, end angle=${formatNumber(endA)}, radius=${formatNumber(circle.radius)}cm];`);
            }
          }
          break;
        }

        case 'param_arc': {
          const startPt = pointsMap.get(shape.startPointId);
          if (startPt) {
            shapeDrawLines.push(
              `  \\draw${optStr} ${coordFor(startPt)} arc (${formatNumber(shape.startAngle)}:${formatNumber(shape.endAngle)}:${formatNumber(shape.radius)}cm);`
            );
          }
          break;
        }

        case 'bezier': {
          const anchors = shape.anchorIds.map((id) => pointsMap.get(id)).filter(Boolean) as GeoPoint[];
          if (anchors.length >= 2 && shape.controls.length > 0) {
            let pathStr = coordFor(anchors[0]);
            for (let i = 0; i < shape.controls.length; i++) {
              const nextAnchor = anchors[(i + 1) % anchors.length];
              const [cp1, cp2] = shape.controls[i];
              pathStr += ` .. controls ${rawCoord(cp1)} and ${rawCoord(cp2)} .. ${coordFor(nextAnchor)}`;
            }
            if (shape.isClosed) {
              pathStr += ' -- cycle';
            }
            shapeDrawLines.push(`  \\draw${optStr} ${pathStr};`);
          }
          break;
        }

        case 'parallel_line': {
          const p1 = pointsMap.get(shape.throughPointId);
          const p2 = pointsMap.get(shape.endPointId);
          if (p1 && p2) {
            shapeDrawLines.push(`  \\draw${optStr} ${coordFor(p1)} -- ${coordFor(p2)};`);
          }
          break;
        }

        case 'perpendicular_line': {
          const p1 = pointsMap.get(shape.throughPointId);
          const p2 = pointsMap.get(shape.endPointId);
          if (p1 && p2) {
            shapeDrawLines.push(`  \\draw${optStr} ${coordFor(p1)} -- ${coordFor(p2)};`);
            if (shape.showRightAngleMark !== false) {
              const refShape = shapes.find((s) => s.id === shape.referenceShapeId);
              if (refShape && refShape.type === 'segment') {
                const refP1 = pointsMap.get(refShape.pointIds[0]);
                const refP2 = pointsMap.get(refShape.pointIds[1]);
                if (refP1 && refP2) {
                  const { dirU, dirV } = computePerpendicularEndPoint(refP1, refP2, p1, p2);
                  const mark = getRightAngleMark(p1, dirU, dirV, 0.25);
                  shapeDrawLines.push(`  \\draw[thin, teal] ${rawCoord(mark.p1)} -- ${rawCoord(mark.p2)} -- ${rawCoord(mark.p3)};`);
                }
              }
            }
          }
          break;
        }
      }
      trackOwnership(_shapeBeforeLen, shapeDrawLines, [shape.id]);
    }
  }

  let shapeDrawLinesOffset = 0;
  if (shapeDrawLines.length > 0) {
    lines.push('');
    lines.push('  % --- Vẽ các hình hình học (toạ độ số trực tiếp, mỗi dòng độc lập) ---');
    shapeDrawLinesOffset = lines.length;
    lines.push(...shapeDrawLines);
  }

  // 2. Nhãn và điểm — nhóm theo khoảng cách nhãn hoặc xuất lẻ
  if ((options.includePoints || options.includeLabels) && points.length > 0) {
    const visiblePoints = points.filter((p) => !p.hidden);

    // Điểm có nhãn
    const visibleLabeledPoints = visiblePoints.filter((pt) => pt.label);
    // Điểm không có nhãn (điểm phụ dựng hình)
    const visibleUnlabeledPoints = visiblePoints.filter((pt) => !pt.label);

    // Xuất điểm không nhãn lẻ tẻ trước
    if (options.includePoints && visibleUnlabeledPoints.length > 0) {
      lines.push('');
      lines.push('  % --- Điểm phụ không nhãn ---');
      for (const pt of visibleUnlabeledPoints) {
        if (pt.style?.pointStyle === 'hidden') continue;
        if (pt.style?.pointStyle === 'circle') {
          lines.push(`  \\draw[fill=white] (${getTikZCoordName(pt)}) circle (1.5pt);`);
        } else if (pt.style?.pointStyle === 'cross') {
          lines.push(`  \\draw (${getTikZCoordName(pt)}) +(-2pt,-2pt) -- +(2pt,2pt) +(-2pt,2pt) -- +(2pt,-2pt);`);
        } else {
          lines.push(`  \\fill (${getTikZCoordName(pt)}) circle (1.5pt);`);
        }
      }
    }

    // Xuất nhóm các điểm có nhãn dùng \foreach
    if (visibleLabeledPoints.length > 0) {
      if (options.includePoints && options.includeLabels) {
        const groupedByDistance = new Map<number, GeoPoint[]>();
        visibleLabeledPoints.forEach((pt) => {
          const dist = Math.round((pt.labelDistance ?? 8) * 10) / 10;
          const arr = groupedByDistance.get(dist) || [];
          arr.push(pt);
          groupedByDistance.set(dist, arr);
        });

        if (groupedByDistance.size > 0) {
          lines.push('');
          lines.push('  % --- Nhãn và điểm (nhóm theo khoảng cách nhãn) ---');
          Array.from(groupedByDistance.entries())
            .sort((a, b) => a[0] - b[0])
            .forEach(([distancePt, ptsInGroup]) => {
              const pairs = ptsInGroup
                .map((pt) => {
                  const angle = Math.round((pt.labelAngleDeg ?? 45) * 10) / 10;
                  return `${getTikZCoordName(pt)}/${formatNumber(angle)}`;
                })
                .join(',');
              lines.push(`  \\foreach \\x/\\y in{`);
              lines.push(`    ${pairs}`);
              lines.push(`  }{`);
              lines.push(`    \\draw[fill=black] (\\x) circle(1pt) ++ (\\y:${formatNumber(distancePt)}pt) node{$\\x$};`);
              lines.push(`  }`);
            });
        }
      } else {
        // Fallback lẻ tẻ nếu chỉ bật nhãn hoặc chỉ bật điểm
        lines.push('');
        lines.push('  % --- Nhãn hoặc điểm riêng lẻ ---');
        for (const pt of visibleLabeledPoints) {
          if (options.includePoints && pt.style?.pointStyle !== 'hidden') {
            if (pt.style?.pointStyle === 'circle') {
              lines.push(`  \\draw[fill=white] (${getTikZCoordName(pt)}) circle (1.5pt);`);
            } else if (pt.style?.pointStyle === 'cross') {
              lines.push(`  \\draw (${getTikZCoordName(pt)}) +(-2pt,-2pt) -- +(2pt,2pt) +(-2pt,2pt) -- +(2pt,-2pt);`);
            } else {
              lines.push(`  \\fill (${getTikZCoordName(pt)}) circle (1.5pt);`);
            }
          }
          if (options.includeLabels) {
            const { angle, distance } = pt.labelAngleDeg !== undefined && pt.labelDistance !== undefined
              ? { angle: pt.labelAngleDeg, distance: pt.labelDistance }
              : { angle: 45, distance: 8 };
            lines.push(`  \\node at ($(${getTikZCoordName(pt)}) + (${formatNumber(angle)}:${formatNumber(distance)}pt)$) {${getMathLabel(pt.label)}};`);
          }
        }
      }
    }
  }

  // Thêm ký hiệu góc vuông (Right Angle Marks) — gom theo bán kính angleRadiusMm
  const rightAngleMarks = options.rightAngleMarks;
  if (rightAngleMarks && rightAngleMarks.length > 0) {
    const groupedByRadius = new Map<number, RightAngleMark[]>();
    rightAngleMarks.forEach((mark) => {
      const r = Math.round((mark.angleRadiusMm ?? 2.5) * 10) / 10;
      const arr = groupedByRadius.get(r) || [];
      arr.push(mark);
      groupedByRadius.set(r, arr);
    });

    if (groupedByRadius.size > 0) {
      lines.push('');
      lines.push('  % --- Ký hiệu góc vuông ---');
      Array.from(groupedByRadius.entries())
        .sort((a, b) => a[0] - b[0])
        .forEach(([radiusMm, marksInGroup]) => {
          const triples = marksInGroup
            .map((mark) => {
              const p1 = pointsMap.get(mark.point1Id);
              const v = pointsMap.get(mark.vertexId);
              const p2 = pointsMap.get(mark.point2Id);
              if (!p1 || !v || !p2) return null;
              return `${getTikZCoordName(p1)}/${getTikZCoordName(v)}/${getTikZCoordName(p2)}`;
            })
            .filter(Boolean);

          if (triples.length > 0) {
            lines.push(`  \\foreach \\x/\\y/\\z in{`);
            lines.push(`    ${triples.join(',')}`);
            lines.push(`  }{`);
            lines.push(`    \\draw pic[draw,angle radius=${formatNumber(radiusMm)}mm]{right angle=\\x--\\y--\\z};`);
            lines.push(`  }`);
          }
        });
    }
  }

  // Thêm nhãn ghi chú (Path Annotations) gom vào một lệnh \path
  const pathAnnotations = options.pathAnnotations;
  if (pathAnnotations && pathAnnotations.length > 0) {
    lines.push('');
    lines.push('  % --- Nhãn ghi chú (Path Annotations) ---');
    lines.push('  \\path');
    
    pathAnnotations.forEach((item) => {
      if (item.type === 'segment_label') {
        const p1 = pointsMap.get(item.point1Id);
        const p2 = pointsMap.get(item.point2Id);
        if (p1 && p2) {
          const posVal = item.pos !== undefined ? item.pos : 0.5;
          const opt = item.positionOption ? `,${item.positionOption}` : '';
          lines.push(`    ${coordFor(p1)}--${coordFor(p2)} node[pos=${posVal}${opt}] {${item.text}}`);
        }
      } else if (item.type === 'point_offset_label') {
        const pt = pointsMap.get(item.pointId);
        if (pt) {
          const distPt = item.distancePt ?? 20;
          lines.push(`    ${coordFor(pt)} ++ (${formatNumber(item.angle)}:${distPt}pt) node{${item.text}}`);
        }
      }
    });

    lines.push('  ;');
  }

  lines.push('\\end{tikzpicture}');
  if (options.standalone) {
    lines.push('\\end{document}');
  }

  const code = lines.join('\n');

  const shapeToLines = new Map<string, number[]>();
  lineOwnerShapeIds.forEach((ids, idxInShapeDrawLines) => {
    if (!ids) return;
    const absoluteLineIndex = shapeDrawLinesOffset + idxInShapeDrawLines;
    ids.forEach((id) => {
      const arr = shapeToLines.get(id) || [];
      arr.push(absoluteLineIndex);
      shapeToLines.set(id, arr);
    });
  });

  return { code, shapeToLines };
}

export function generateTikZCode(
  points: GeoPoint[],
  shapes: GeoShape[],
  options: TikZExportOptions = {
    standalone: true,
    includeLabels: true,
    includePoints: true,
    scale: 1,
    useColorDefinitions: true,
  }
): string {
  return generateTikZCodeWithLineMap(points, shapes, options).code;
}

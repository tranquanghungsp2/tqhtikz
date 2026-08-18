import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  GeoPoint,
  GeoShape,
  ToolType,
  AppSettings,
  TikZExportOptions,
  HistoryState,
  BackgroundImageState,
} from './types';
import { Toolbar } from './components/Toolbar';
import { Canvas } from './components/Canvas';
import { RightSidebar } from './components/RightSidebar';
import { Header } from './components/Header';
import { generatePointLabel, dist, findShapeIntersections, computeParamArcEndPoint, getEdgeByIndex, findEdgeShapeIntersections, intersectEdgeEdge } from './utils/geometry';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { evaluateAllFormulas } from './utils/formulaEvaluator';
import { FormulaPoint, FormulaVariable, FormulaPathGroup } from './types-formula';
import { FormulaPanel } from './components/FormulaPanel';
import { FormulaCanvas } from './components/FormulaCanvas';

export default function App() {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    console.log('--- STARTING FORMULA ENGINE TEST ---');
    const testVariables: FormulaVariable[] = [
      { name: 'r', value: 5 }
    ];

    const testPoints: FormulaPoint[] = [
      { id: '1', name: 'O', formula: '(0,0)', groupId: '1' },
      { id: '2', name: 'A', formula: '(108:\\r)', groupId: '1' },
      { id: '3', name: 'B', formula: '(-150:\\r)', groupId: '1' },
      { id: '4', name: 'C', formula: '(-30:\\r)', groupId: '1' },
      { id: '5', name: 'D', formula: '($(B)!(A)!(C)$)', groupId: '1' },
      { id: '6', name: 'E', formula: '($(A)!(B)!(C)$)', groupId: '1' },
      { id: '7', name: 'F', formula: '($(A)!(C)!(B)$)', groupId: '1' },
      { id: '8', name: 'H', formula: 'intersection of A--D and C--F', groupId: '1' },
      { id: '14', name: 'Q', formula: '($2*(O)-(A)$)', groupId: '1' },
      { id: '9', name: 'O1', formula: '($(H)!(O)!(Q)$)', groupId: '1' },
      { id: '13', name: 'K', formula: '($2*(O1)-(Q)$)', groupId: '1' },
      { id: '10', name: 'M', formula: '($(A)!0.5!(H)$)', groupId: '1' },
      { id: '11', name: 'P', formula: '($(B)!0.5!(C)$)', groupId: '1' },
      { id: '12', name: 'N', formula: '($(H)!0.5!(K)$)', groupId: '1' },
      { id: '15', name: 'X', formula: '($(M)!0.5!(P)$)', groupId: '1' },
      { id: '16', name: 'Y', formula: '($2*(X)-(D)$)', groupId: '1' },
      { id: '17', name: 'G', formula: '($2*(Y)!(X)!(H)-(Y)$)', groupId: '1' },
      { id: '18', name: 'mHD', formula: '($(H)!0.5!(D)$)', groupId: '1' },
    ];

    const result = evaluateAllFormulas(testPoints, testVariables);
    console.log('Formula Engine Evaluation Result:', result);
    
    if (result.errors.length > 0) {
      console.error('Formula Engine Errors:', result.errors);
    } else {
      console.log('Evaluated Coordinates Map:');
      result.points.forEach((pt, name) => {
        console.log(`Point ${name}: (${pt.x.toFixed(4)}, ${pt.y.toFixed(4)})`);
      });

      // Verification
      const ptO = result.points.get('O');
      const ptA = result.points.get('A');
      const ptB = result.points.get('B');
      const ptC = result.points.get('C');
      const ptM = result.points.get('M');
      const ptH = result.points.get('H');
      const ptP = result.points.get('P');
      const ptX = result.points.get('X');
      const ptQ = result.points.get('Q');

      if (ptO && ptA && ptB && ptC && ptM && ptH && ptP && ptX && ptQ) {
        const distOA = dist(ptO, ptA);
        const distOB = dist(ptO, ptB);
        const distOC = dist(ptO, ptC);

        console.log('--- VERIFICATION ---');
        console.log('Kiểm tra: khoảng cách O-A, O-B, O-C phải xấp xỉ 5');
        console.log(`O-A: ${distOA.toFixed(4)} (Xấp xỉ 5: ${Math.abs(distOA - 5) < 1e-3 ? 'ĐÚNG' : 'SAI'})`);
        console.log(`O-B: ${distOB.toFixed(4)} (Xấp xỉ 5: ${Math.abs(distOB - 5) < 1e-3 ? 'ĐÚNG' : 'SAI'})`);
        console.log(`O-C: ${distOC.toFixed(4)} (Xấp xỉ 5: ${Math.abs(distOC - 5) < 1e-3 ? 'ĐÚNG' : 'SAI'})`);

        const midAH = { x: (ptA.x + ptH.x) / 2, y: (ptA.y + ptH.y) / 2 };
        const distM_AH = dist(ptM, midAH);
        console.log(`M có là trung điểm A-H: ${distM_AH.toFixed(4)} (Xấp xỉ 0: ${distM_AH < 1e-3 ? 'ĐÚNG' : 'SAI'})`);

        const midBC = { x: (ptB.x + ptC.x) / 2, y: (ptB.y + ptC.y) / 2 };
        const distP_BC = dist(ptP, midBC);
        console.log(`P có là trung điểm B-C: ${distP_BC.toFixed(4)} (Xấp xỉ 0: ${distP_BC < 1e-3 ? 'ĐÚNG' : 'SAI'})`);

        const midMP = { x: (ptM.x + ptP.x) / 2, y: (ptM.y + ptP.y) / 2 };
        const distX_MP = dist(ptX, midMP);
        console.log(`X có là trung điểm M-P: ${distX_MP.toFixed(4)} (Xấp xỉ 0: ${distX_MP < 1e-3 ? 'ĐÚNG' : 'SAI'})`);

        const symA_O = { x: 2 * ptO.x - ptA.x, y: 2 * ptO.y - ptA.y };
        const distQ_sym = dist(ptQ, symA_O);
        console.log(`Q có đối xứng A qua O: ${distQ_sym.toFixed(4)} (Xấp xỉ 0: ${distQ_sym < 1e-3 ? 'ĐÚNG' : 'SAI'})`);
        console.log('--------------------');
      }
    }
    console.log('--- END OF FORMULA ENGINE TEST ---');
  }, []);

  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [shapes, setShapes] = useState<GeoShape[]>([]);
  const [pointCounter, setPointCounter] = useState<number>(0);

  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolType>('select');

  const [formulaMode, setFormulaMode] = useState(false);
  const [formulaPoints, setFormulaPoints] = useState<FormulaPoint[]>([
    { id: '1', name: 'O', formula: '(0,0)', groupId: 'g1' },
  ]);
  const [formulaVariables, setFormulaVariables] = useState<FormulaVariable[]>([
    { name: 'r', value: 5, min: 0.5, max: 15 },
  ]);
  const [formulaGroups, setFormulaGroups] = useState<FormulaPathGroup[]>([
    { id: 'g1', name: 'Nhóm 1', order: 0 },
  ]);

  const formulaResult = useMemo(
    () => evaluateAllFormulas(formulaPoints, formulaVariables),
    [formulaPoints, formulaVariables]
  );

  // Multi-step tool configurations
  const [polygonSides, setPolygonSides] = useState<number>(5);
  const [rectangleMode, setRectangleMode] = useState<'shape' | 'points'>('shape');
  const [bezierSegments, setBezierSegments] = useState<number>(2);
  const [bezierClosed, setBezierClosed] = useState<boolean>(false);
  const [polylinePoints, setPolylinePoints] = useState<string[]>([]);
  const [paramArcStartPointId, setParamArcStartPointId] = useState<string | null>(null);
  const [arcStartAngle, setArcStartAngle] = useState<number>(0);
  const [arcEndAngle, setArcEndAngle] = useState<number>(90);
  const [arcRadius, setArcRadius] = useState<number>(2);
  const [pickingArcRadius, setPickingArcRadius] = useState(false);
  const [radiusPickPoints, setRadiusPickPoints] = useState<GeoPoint[]>([]);
  const [arcRadiusSource, setArcRadiusSource] = useState<{ pointId1: string; pointId2: string; divisor: number } | null>(null);

  // Settings
  const [settings, setSettings] = useState<AppSettings>({
    showGrid: true,
    snapToGrid: false,
    gridStep: 0.5,
    showAxes: false,
    rulerStep: 1,
    autoLabel: true,
  });

  // TikZ Options
  const [tikzOptions, setTikzOptions] = useState<TikZExportOptions>({
    standalone: true,
    includeLabels: true,
    includePoints: true,
    scale: 1,
    useColorDefinitions: true,
  });

  // Background image state for tracing (not in undo/redo history)
  const [bgImage, setBgImage] = useState<BackgroundImageState>({
    dataUrl: null,
    fileName: '',
    opacity: 0.4,
    scale: 1,
    panX: 0,
    panY: 0,
    naturalAspect: 1,
  });

  // History for Undo / Redo
  const [undoStack, setUndoStack] = useState<HistoryState[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryState[]>([]);

  // Confirmation modal state
  const [showClearModal, setShowClearModal] = useState<boolean>(false);

  // Save snapshot to history before changes
  const saveSnapshot = useCallback(() => {
    setUndoStack((prev) => [
      ...prev.slice(-30), // keep max 30 snapshots
      {
        points: JSON.parse(JSON.stringify(points)),
        shapes: JSON.parse(JSON.stringify(shapes)),
        pointCounter,
      },
    ]);
    setRedoStack([]);
  }, [points, shapes, pointCounter]);

  // Undo Handler
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const lastState = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [
      ...prev,
      {
        points: JSON.parse(JSON.stringify(points)),
        shapes: JSON.parse(JSON.stringify(shapes)),
        pointCounter,
      },
    ]);
    setPoints(lastState.points);
    setShapes(lastState.shapes);
    setPointCounter(lastState.pointCounter);
    setUndoStack((prev) => prev.slice(0, prev.length - 1));
    setSelectedPointId(null);
    setSelectedShapeId(null);
  }, [undoStack, points, shapes, pointCounter]);

  // Redo Handler
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [
      ...prev,
      {
        points: JSON.parse(JSON.stringify(points)),
        shapes: JSON.parse(JSON.stringify(shapes)),
        pointCounter,
      },
    ]);
    setPoints(nextState.points);
    setShapes(nextState.shapes);
    setPointCounter(nextState.pointCounter);
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
    setSelectedPointId(null);
    setSelectedShapeId(null);
  }, [redoStack, points, shapes, pointCounter]);

  // Point & Shape Operations
  const handleAddPoint = useCallback(
    (point: GeoPoint) => {
      saveSnapshot();
      setPoints((prev) => [...prev, point]);
      setPointCounter((prev) => prev + 1);
    },
    [saveSnapshot]
  );

  const handleUpdatePoint = useCallback(
    (pointId: string, updates: Partial<GeoPoint>) => {
      saveSnapshot();
      setPoints((prev) =>
        prev.map((p) => (p.id === pointId ? { ...p, ...updates } : p))
      );
    },
    [saveSnapshot]
  );

  // Sau khi 1 điểm bất kỳ bị kéo, tính lại vị trí điểm cuối (endPointId) của mọi
  // đường song song/vuông góc — GIỮ NGUYÊN độ dài through→end hiện có (để không phá
  // độ dài người dùng đã chỉnh tay), chỉ CHỈNH LẠI HƯỚNG cho đúng song song/vuông góc
  // với đường chuẩn mới. Chạy 2 lượt để xử lý đúng trường hợp 1 đường song song/vuông góc
  // lấy chuẩn là 1 đường song song/vuông góc khác (chuỗi phụ thuộc).
  const recomputeConstrainedEndpoints = useCallback(
    (currentPoints: GeoPoint[], currentShapes: GeoShape[]): GeoPoint[] => {
      let workingPoints = currentPoints;

      const resolveRefDirPoints = (
        referenceShapeId: string,
        pMap: Map<string, GeoPoint>
      ): [{ x: number; y: number }, { x: number; y: number }] | null => {
        if (referenceShapeId === 'axis-x') return [{ x: 0, y: 0 }, { x: 1, y: 0 }];
        if (referenceShapeId === 'axis-y') return [{ x: 0, y: 0 }, { x: 0, y: 1 }];
        const refShape = currentShapes.find((s) => s.id === referenceShapeId);
        if (!refShape) return null;
        if (refShape.type === 'segment') {
          const a = pMap.get(refShape.pointIds[0]);
          const b = pMap.get(refShape.pointIds[1]);
          if (a && b) return [a, b];
        }
        if (refShape.type === 'parallel_line' || refShape.type === 'perpendicular_line') {
          const a = pMap.get(refShape.throughPointId);
          const b = pMap.get(refShape.endPointId);
          if (a && b) return [a, b];
        }
        return null;
      };

      for (let pass = 0; pass < 2; pass++) {
        const pMap = new Map(workingPoints.map((p) => [p.id, p]));

        for (const shape of currentShapes) {
          if (shape.type !== 'parallel_line' && shape.type !== 'perpendicular_line') continue;

          const through = pMap.get(shape.throughPointId);
          const oldEnd = pMap.get(shape.endPointId);
          const refPts = resolveRefDirPoints(shape.referenceShapeId, pMap);
          if (!through || !oldEnd || !refPts) continue;

          const [refP1, refP2] = refPts;
          const refDx = refP2.x - refP1.x;
          const refDy = refP2.y - refP1.y;
          const refLen = Math.hypot(refDx, refDy) || 1;
          let dirX = refDx / refLen;
          let dirY = refDy / refLen;
          if (shape.type === 'perpendicular_line') {
            const vx = -dirY;
            const vy = dirX;
            dirX = vx;
            dirY = vy;
          }

          const currentLen = dist(through, oldEnd) || 1;
          const oldDirX = oldEnd.x - through.x;
          const oldDirY = oldEnd.y - through.y;
          const sign = oldDirX * dirX + oldDirY * dirY < 0 ? -1 : 1;

          const newX = through.x + sign * currentLen * dirX;
          const newY = through.y + sign * currentLen * dirY;

          if (Math.abs(newX - oldEnd.x) > 1e-6 || Math.abs(newY - oldEnd.y) > 1e-6) {
            const updatedEnd = { ...oldEnd, x: newX, y: newY };
            pMap.set(oldEnd.id, updatedEnd);
            workingPoints = workingPoints.map((p) => (p.id === oldEnd.id ? updatedEnd : p));
          }
        }
      }

      return workingPoints;
    },
    []
  );

  // Tính lại vị trí các điểm giao (derivedFrom.type === 'intersection') dựa trên
  // vị trí HIỆN TẠI của 2 hình gốc. Nếu 2 hình không còn cắt nhau nữa, giữ nguyên
  // vị trí cũ của điểm (không tự xoá) để tránh mất dữ liệu đột ngột khi kéo qua lại.
  const recomputeDerivedIntersections = useCallback(
    (currentPoints: GeoPoint[], currentShapes: GeoShape[]): GeoPoint[] => {
      const pMap = new Map(currentPoints.map((p) => [p.id, p]));
      let working = currentPoints;

      for (const pt of currentPoints) {
        const derived = pt.derivedFrom;
        if (!derived || derived.type !== 'intersection') continue;
        const s1 = currentShapes.find((s) => s.id === derived.shapeId1);
        const s2 = currentShapes.find((s) => s.id === derived.shapeId2);
        if (!s1 || !s2) continue;

        let results: Array<{ x: number; y: number }> = [];
        const hasEdge1 = derived.edgeIndex1 !== undefined;
        const hasEdge2 = derived.edgeIndex2 !== undefined;

        if (hasEdge1 && hasEdge2) {
          const e1 = getEdgeByIndex(s1, derived.edgeIndex1!, pMap);
          const e2 = getEdgeByIndex(s2, derived.edgeIndex2!, pMap);
          if (e1 && e2) {
            const r = intersectEdgeEdge(e1, e2);
            results = r ? [r] : [];
          }
        } else if (hasEdge1) {
          const e1 = getEdgeByIndex(s1, derived.edgeIndex1!, pMap);
          if (e1) {
            results = findEdgeShapeIntersections(e1, s2, pMap);
          }
        } else if (hasEdge2) {
          const e2 = getEdgeByIndex(s2, derived.edgeIndex2!, pMap);
          if (e2) {
            results = findEdgeShapeIntersections(e2, s1, pMap);
          }
        } else {
          results = findShapeIntersections(s1, s2, pMap);
        }

        const idx = derived.index ?? 0;
        const newPos = results[idx];
        if (!newPos) continue;

        if (Math.abs(newPos.x - pt.x) > 1e-6 || Math.abs(newPos.y - pt.y) > 1e-6) {
          const updated = { ...pt, x: newPos.x, y: newPos.y };
          pMap.set(pt.id, updated);
          working = working.map((p) => (p.id === pt.id ? updated : p));
        }
      }

      return working;
    },
    []
  );

  // Tính lại vị trí các điểm "trên đường" (derivedFrom.type === 'pointOnLine') theo
  // đúng tham số t đã lưu và vị trí HIỆN TẠI của 2 đầu đường chứa nó.
  const recomputePointsOnLine = useCallback(
    (currentPoints: GeoPoint[], currentShapes: GeoShape[]): GeoPoint[] => {
      const pMap = new Map(currentPoints.map((p) => [p.id, p]));
      let working = currentPoints;

      for (const pt of currentPoints) {
        const derived = pt.derivedFrom;
        if (!derived || derived.type !== 'pointOnLine') continue;
        const refShape = currentShapes.find((s) => s.id === derived.shapeId);
        if (!refShape) continue;

        let a: { x: number; y: number } | undefined;
        let b: { x: number; y: number } | undefined;

        if (derived.edgeIndex !== undefined) {
          const edge = getEdgeByIndex(refShape, derived.edgeIndex, pMap);
          if (edge) {
            a = edge.p1;
            b = edge.p2;
          }
        } else if (refShape.type === 'segment') {
          a = pMap.get(refShape.pointIds[0]);
          b = pMap.get(refShape.pointIds[1]);
        } else if (refShape.type === 'parallel_line' || refShape.type === 'perpendicular_line') {
          a = pMap.get(refShape.throughPointId);
          b = pMap.get(refShape.endPointId);
        }
        if (!a || !b) continue;

        const t = derived.t;
        const newX = a.x + t * (b.x - a.x);
        const newY = a.y + t * (b.y - a.y);

        if (Math.abs(newX - pt.x) > 1e-6 || Math.abs(newY - pt.y) > 1e-6) {
          const updated = { ...pt, x: newX, y: newY };
          pMap.set(pt.id, updated);
          working = working.map((p) => (p.id === pt.id ? updated : p));
        }
      }

      return working;
    },
    []
  );

  // Tính lại vị trí các điểm chia đoạn (derivedFrom.type === 'segmentDivision') theo đúng
  // tỉ lệ t đã lưu và vị trí HIỆN TẠI của 2 điểm gốc — giữ đúng nghĩa "chia đôi/chia N"
  // dù người dùng có kéo 2 điểm gốc đi đâu.
  const recomputeSegmentDivisionPoints = useCallback((currentPoints: GeoPoint[]): GeoPoint[] => {
    const pMap = new Map(currentPoints.map((p) => [p.id, p]));
    let working = currentPoints;

    for (const pt of currentPoints) {
      if (!pt.derivedFrom || pt.derivedFrom.type !== 'segmentDivision') continue;
      const a = pMap.get(pt.derivedFrom.pointId1);
      const b = pMap.get(pt.derivedFrom.pointId2);
      if (!a || !b) continue;

      const t = pt.derivedFrom.t;
      const newX = a.x + t * (b.x - a.x);
      const newY = a.y + t * (b.y - a.y);

      if (Math.abs(newX - pt.x) > 1e-6 || Math.abs(newY - pt.y) > 1e-6) {
        const updated = { ...pt, x: newX, y: newY };
        pMap.set(pt.id, updated);
        working = working.map((p) => (p.id === pt.id ? updated : p));
      }
    }
    return working;
  }, []);

  const recomputeParamArcEndPoints = useCallback((currentPoints: GeoPoint[], currentShapes: GeoShape[]): GeoPoint[] => {
    const pMap = new Map(currentPoints.map((p) => [p.id, p]));
    let working = currentPoints;

    for (const pt of currentPoints) {
      if (!pt.derivedFrom || pt.derivedFrom.type !== 'paramArcEnd') continue;
      const derived = pt.derivedFrom;
      const shape = currentShapes.find((s) => s.id === derived.shapeId);
      if (!shape || shape.type !== 'param_arc') continue;
      const startPt = pMap.get(shape.startPointId);
      if (!startPt) continue;

      const newPos = computeParamArcEndPoint(startPt, shape.startAngle, shape.endAngle, shape.radius);
      if (Math.abs(newPos.x - pt.x) > 1e-6 || Math.abs(newPos.y - pt.y) > 1e-6) {
        const updated = { ...pt, x: newPos.x, y: newPos.y };
        pMap.set(pt.id, updated);
        working = working.map((p) => (p.id === pt.id ? updated : p));
      }
    }
    return working;
  }, []);

  const recomputeRectangleCorners = useCallback((currentPoints: GeoPoint[]): GeoPoint[] => {
    const pMap = new Map(currentPoints.map((p) => [p.id, p]));
    let working = currentPoints;
    for (const pt of currentPoints) {
      if (!pt.derivedFrom || pt.derivedFrom.type !== 'rectangleCorner') continue;
      const xs = pMap.get(pt.derivedFrom.xSourceId);
      const ys = pMap.get(pt.derivedFrom.ySourceId);
      if (!xs || !ys) continue;
      if (Math.abs(xs.x - pt.x) > 1e-6 || Math.abs(ys.y - pt.y) > 1e-6) {
        const updated = { ...pt, x: xs.x, y: ys.y };
        pMap.set(pt.id, updated);
        working = working.map((p) => (p.id === pt.id ? updated : p));
      }
    }
    return working;
  }, []);

  const handleUpdatePointCoord = useCallback(
    (pointId: string, x: number, y: number) => {
      // Nếu điểm đang kéo là 1 trong 2 điểm nguồn đo bán kính của cung nào đó, tính lại
      // bán kính NGAY (đồng bộ) trước khi tính điểm cuối cung, để không bị lệch 1 khung hình.
      const hasRadiusDependent = shapes.some(
        (s) =>
          s.type === 'param_arc' &&
          s.radiusSource &&
          (s.radiusSource.pointId1 === pointId || s.radiusSource.pointId2 === pointId)
      );
      let effectiveShapes = shapes;
      if (hasRadiusDependent) {
        effectiveShapes = shapes.map((s) => {
          if (
            s.type === 'param_arc' &&
            s.radiusSource &&
            (s.radiusSource.pointId1 === pointId || s.radiusSource.pointId2 === pointId)
          ) {
            const otherId = s.radiusSource.pointId1 === pointId ? s.radiusSource.pointId2 : s.radiusSource.pointId1;
            const other = points.find((p) => p.id === otherId);
            if (other) {
              const newDist = dist({ x, y }, other);
              return { ...s, radius: Math.round((newDist / s.radiusSource.divisor) * 100) / 100 };
            }
          }
          return s;
        });
        setShapes(effectiveShapes);
      }

      setPoints((prev) => {
        let working = prev.map((p) => {
          if (p.id !== pointId) return p;

          if (p.derivedFrom?.type === 'pointOnLine') {
            const derived = p.derivedFrom;
            const refShape = effectiveShapes.find((s) => s.id === derived.shapeId);
            let a: { x: number; y: number } | undefined;
            let b: { x: number; y: number } | undefined;

            if (derived.edgeIndex !== undefined && refShape) {
              const pMap = new Map<string, GeoPoint>(prev.map((pp) => [pp.id, pp]));
              const edge = getEdgeByIndex(refShape, derived.edgeIndex, pMap);
              if (edge) {
                a = edge.p1;
                b = edge.p2;
              }
            } else if (refShape?.type === 'segment') {
              a = prev.find((pp) => pp.id === refShape.pointIds[0]);
              b = prev.find((pp) => pp.id === refShape.pointIds[1]);
            } else if (refShape?.type === 'parallel_line' || refShape?.type === 'perpendicular_line') {
              a = prev.find((pp) => pp.id === refShape.throughPointId);
              b = prev.find((pp) => pp.id === refShape.endPointId);
            }

            if (a && b) {
              const abx = b.x - a.x;
              const aby = b.y - a.y;
              const len2 = abx * abx + aby * aby || 1;
              const newT = ((x - a.x) * abx + (y - a.y) * aby) / len2;
              return { ...p, derivedFrom: { ...derived, t: newT } };
            }
          }

          return { ...p, x, y };
        });

        for (let i = 0; i < 2; i++) {
          working = recomputeConstrainedEndpoints(working, effectiveShapes);
          working = recomputeDerivedIntersections(working, effectiveShapes);
          working = recomputePointsOnLine(working, effectiveShapes);
          working = recomputeSegmentDivisionPoints(working);
          working = recomputeParamArcEndPoints(working, effectiveShapes);
          working = recomputeRectangleCorners(working);
        }
        return working;
      });
    },
    [
      points,
      shapes,
      recomputeConstrainedEndpoints,
      recomputeDerivedIntersections,
      recomputePointsOnLine,
      recomputeSegmentDivisionPoints,
      recomputeParamArcEndPoints,
      recomputeRectangleCorners,
    ]
  );

  const handleDeletePoint = useCallback(
    (pointId: string) => {
      saveSnapshot();
      setPoints((prev) => prev.filter((p) => p.id !== pointId));
      // Remove or clean up shapes referring to this point
      setShapes((prev) =>
        prev.filter((shape) => {
          if (
            shape.type === 'segment' ||
            shape.type === 'rectangle' ||
            shape.type === 'square' ||
            shape.type === 'rounded_rectangle'
          ) {
            return !shape.pointIds.includes(pointId);
          }
          if (shape.type === 'polyline') {
            return !shape.pointIds.includes(pointId);
          }
          if (shape.type === 'circle' || shape.type === 'semicircle') {
            return shape.centerId !== pointId && shape.radiusPointId !== pointId;
          }
          if (shape.type === 'ellipse' || shape.type === 'semi_ellipse') {
            return (
              shape.centerId !== pointId &&
              shape.rxPointId !== pointId &&
              shape.ryPointId !== pointId
            );
          }
          if (shape.type === 'parabola') {
            return shape.vertexId !== pointId && shape.throughId !== pointId;
          }
          if (shape.type === 'hyperbola') {
            return shape.centerId !== pointId && shape.pointId !== pointId;
          }
          if (shape.type === 'regular_polygon') {
            return shape.centerId !== pointId && shape.vertexId !== pointId;
          }
          if (shape.type === 'arc_3p') {
            return !shape.pointIds.includes(pointId);
          }
          if (shape.type === 'param_arc') {
            return shape.startPointId !== pointId && shape.endPointId !== pointId;
          }
          if (shape.type === 'bezier') {
            return !shape.anchorIds.includes(pointId);
          }
          if (shape.type === 'parallel_line' || shape.type === 'perpendicular_line') {
            return shape.throughPointId !== pointId && shape.endPointId !== pointId;
          }
          return true;
        })
      );
      if (selectedPointId === pointId) setSelectedPointId(null);
    },
    [saveSnapshot, selectedPointId]
  );

  const handleAddShape = useCallback(
    (shape: GeoShape) => {
      saveSnapshot();
      setShapes((prev) => [...prev, shape]);
      setSelectedShapeId(shape.id);
      setSelectedPointId(null);
    },
    [saveSnapshot]
  );

  const handleUpdateShape = useCallback(
    (shapeId: string, updates: Partial<GeoShape>) => {
      saveSnapshot();
      setShapes((prev) =>
        prev.map((s) => (s.id === shapeId ? ({ ...s, ...updates } as GeoShape) : s))
      );
    },
    [saveSnapshot]
  );

  const handleUnmergeShape = useCallback(
    (shapeId: string) => {
      handleUpdateShape(shapeId, { mergeGroupId: undefined });
    },
    [handleUpdateShape]
  );

  const handleDeleteShape = useCallback(
    (shapeId: string) => {
      saveSnapshot();
      setShapes((prev) => prev.filter((s) => s.id !== shapeId));
      if (selectedShapeId === shapeId) setSelectedShapeId(null);
    },
    [saveSnapshot, selectedShapeId]
  );

  const handleClearAll = useCallback(() => {
    saveSnapshot();
    setPoints([]);
    setShapes([]);
    setPointCounter(0);
    setSelectedPointId(null);
    setSelectedShapeId(null);
    setShowClearModal(false);
  }, [saveSnapshot]);

  const handleFinishPolyline = useCallback(() => {
    if (polylinePoints.length >= 2) {
      const newShape: GeoShape = {
        id: `s_poly_${Date.now()}`,
        type: 'polyline',
        pointIds: [...polylinePoints],
        isClosed: false,
        style: { color: '#16233a', strokeWidth: 1.5, dashPattern: 'solid' },
      };
      handleAddShape(newShape);
      setPolylinePoints([]);
    }
  }, [polylinePoints, handleAddShape]);

  const handleApplyRadiusFromPoints = useCallback(
    (divisor: number) => {
      if (radiusPickPoints.length !== 2) return;
      const d = dist(radiusPickPoints[0], radiusPickPoints[1]);
      setArcRadius(Math.round((d / divisor) * 100) / 100);
      setArcRadiusSource({ pointId1: radiusPickPoints[0].id, pointId2: radiusPickPoints[1].id, divisor });
      setPickingArcRadius(false);
      setRadiusPickPoints([]);
    },
    [radiusPickPoints]
  );

  const handleCancelRadiusPick = useCallback(() => {
    setPickingArcRadius(false);
    setRadiusPickPoints([]);
  }, []);

  const handleFinishParamArc = useCallback(() => {
    if (!paramArcStartPointId) return;
    const startPt = points.find((p) => p.id === paramArcStartPointId);
    if (!startPt) return;

    const shapeId = `s_parcarc_${Date.now()}`;
    const endCoord = computeParamArcEndPoint(startPt, arcStartAngle, arcEndAngle, arcRadius);
    const endPointId = `p_${Date.now()}_arcend`;
    const endPoint: GeoPoint = {
      id: endPointId,
      label: generatePointLabel(points.length),
      x: endCoord.x,
      y: endCoord.y,
      labelPos: 'auto',
      style: { color: '#16233a', pointStyle: 'dot' },
      derivedFrom: { type: 'paramArcEnd', shapeId },
    };
    handleAddPoint(endPoint);

    const newShape: GeoShape = {
      id: shapeId,
      type: 'param_arc',
      startPointId: paramArcStartPointId,
      endPointId,
      startAngle: arcStartAngle,
      endAngle: arcEndAngle,
      radius: arcRadius,
      radiusSource: arcRadiusSource ?? undefined,
      style: { color: '#16233a', strokeWidth: 1.5, dashPattern: 'solid' },
    };
    handleAddShape(newShape);
    setParamArcStartPointId(null);
    setPickingArcRadius(false);
    setRadiusPickPoints([]);
    setArcRadiusSource(null);
  }, [paramArcStartPointId, points, arcStartAngle, arcEndAngle, arcRadius, arcRadiusSource, handleAddPoint, handleAddShape]);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If typing in an input field, do not trigger global shortcuts
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'SELECT'
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedPointId) {
          e.preventDefault();
          handleDeletePoint(selectedPointId);
        } else if (selectedShapeId) {
          e.preventDefault();
          handleDeleteShape(selectedShapeId);
        }
      } else if (e.key === 'Escape') {
        setSelectedPointId(null);
        setSelectedShapeId(null);
        setPolylinePoints([]);
        setActiveTool('select');
      } else if (e.key === 'Enter') {
        if (activeTool === 'polyline' && polylinePoints.length >= 2) {
          handleFinishPolyline();
        } else if (activeTool === 'param_arc' && paramArcStartPointId) {
          e.preventDefault();
          handleFinishParamArc();
        }
      } else if (e.key.toLowerCase() === 'v' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setActiveTool('select');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleUndo,
    handleRedo,
    selectedPointId,
    selectedShapeId,
    handleDeletePoint,
    handleDeleteShape,
    activeTool,
    polylinePoints,
    handleFinishPolyline,
    paramArcStartPointId,
    handleFinishParamArc,
  ]);

  // Dán ảnh trực tiếp bằng Ctrl+V để đặt làm ảnh nền, không cần qua nút tải file
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Bỏ qua nếu đang gõ trong 1 ô input/textarea (ví dụ ô nhập X/Y ảnh nền),
      // để không chặn thao tác dán văn bản bình thường
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (!file) continue;
          e.preventDefault();

          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const img = new Image();
            img.onload = () => {
              const naturalAspect = img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 1;
              setBgImage((prev) => ({
                ...prev,
                dataUrl,
                fileName: `Ảnh dán (${new Date().toLocaleTimeString('vi-VN')})`,
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
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [setBgImage]);

  const selectedPoint = points.find((p) => p.id === selectedPointId) || null;
  const selectedShape = shapes.find((s) => s.id === selectedShapeId) || null;
  const nextPointLabel = generatePointLabel(pointCounter);

  return (
    <div className="w-screen h-screen flex flex-col bg-[#eef2f6] text-[#16233a] overflow-hidden">
      {/* Top Header */}
      <Header
        points={points}
        shapes={shapes}
        pointCounter={pointCounter}
        bgImage={bgImage}
        formulaMode={formulaMode}
        onToggleFormulaMode={() => setFormulaMode((v) => !v)}
        onLoadDrawing={(loadedPoints, loadedShapes, loadedPointCounter, loadedBgImage) => {
          setPoints(loadedPoints);
          setShapes(loadedShapes);
          setPointCounter(loadedPointCounter);
          setSelectedPointId(null);
          setSelectedShapeId(null);
          if (loadedBgImage) {
            setBgImage(loadedBgImage);
          } else {
            setBgImage({
              dataUrl: null,
              fileName: '',
              opacity: 0.4,
              scale: 1,
              panX: 0,
              panY: 0,
              naturalAspect: 1,
            });
          }
        }}
      />

      {/* Main 3-Column Studio Workspace */}
      <main className="flex-1 flex flex-row overflow-hidden relative">
        {formulaMode ? (
          <>
            {/* Column 1: Formula Panel (~420px) */}
            <FormulaPanel
              points={formulaPoints}
              onUpdatePoints={setFormulaPoints}
              variables={formulaVariables}
              onUpdateVariables={setFormulaVariables}
              groups={formulaGroups}
              onUpdateGroups={setFormulaGroups}
              evalResult={formulaResult}
            />
            {/* Column 2: Formula Canvas */}
            <FormulaCanvas points={formulaPoints} evalResult={formulaResult} />
          </>
        ) : (
          <>
            {/* Column 1: Left Toolbar (~226px) */}
            <Toolbar
              activeTool={activeTool}
              onSelectTool={(tool) => {
                setActiveTool(tool);
                if (tool !== 'select' && tool !== 'move_background') {
                  setSelectedPointId(null);
                  setSelectedShapeId(null);
                }
              }}
              settings={settings}
              onUpdateSettings={(newSet) => setSettings((prev) => ({ ...prev, ...newSet }))}
              canUndo={undoStack.length > 0}
              canRedo={redoStack.length > 0}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onClearAll={() => setShowClearModal(true)}
              polygonSides={polygonSides}
              onChangePolygonSides={setPolygonSides}
              rectangleMode={rectangleMode}
              onChangeRectangleMode={setRectangleMode}
              bezierSegments={bezierSegments}
              onChangeBezierSegments={setBezierSegments}
              bezierClosed={bezierClosed}
              onToggleBezierClosed={() => setBezierClosed(!bezierClosed)}
              polylineStepCount={polylinePoints.length}
              onFinishPolyline={handleFinishPolyline}
              paramArcStartPointId={paramArcStartPointId}
              arcStartAngle={arcStartAngle}
              onChangeArcStartAngle={setArcStartAngle}
              arcEndAngle={arcEndAngle}
              onChangeArcEndAngle={setArcEndAngle}
              arcRadius={arcRadius}
              onChangeArcRadius={(v) => {
                setArcRadius(v);
                setArcRadiusSource(null);
              }}
              onFinishParamArc={handleFinishParamArc}
              pickingArcRadius={pickingArcRadius}
              onTogglePickingArcRadius={() => setPickingArcRadius((v) => !v)}
              radiusPickPoints={radiusPickPoints}
              onApplyRadiusFromPoints={handleApplyRadiusFromPoints}
              onCancelRadiusPick={handleCancelRadiusPick}
              bgImage={bgImage}
              onUpdateBgImage={setBgImage}
            />

            {/* Column 2: Middle Canvas Area */}
            <Canvas
              points={points}
              shapes={shapes}
              selectedPointId={selectedPointId}
              selectedShapeId={selectedShapeId}
              activeTool={activeTool}
              settings={settings}
              polygonSides={polygonSides}
              rectangleMode={rectangleMode}
              bezierSegments={bezierSegments}
              bezierClosed={bezierClosed}
              paramArcStartPointId={paramArcStartPointId}
              onSetParamArcStartPointId={setParamArcStartPointId}
              arcStartAngle={arcStartAngle}
              arcEndAngle={arcEndAngle}
              arcRadius={arcRadius}
              pickingArcRadius={pickingArcRadius}
              radiusPickPoints={radiusPickPoints}
              onSetRadiusPickPoints={setRadiusPickPoints}
              onSelectPoint={setSelectedPointId}
              onSelectShape={setSelectedShapeId}
              onSelectTool={(tool) => {
                setActiveTool(tool);
                if (tool !== 'select' && tool !== 'move_background') {
                  setSelectedPointId(null);
                  setSelectedShapeId(null);
                }
              }}
              onAddPoint={handleAddPoint}
              onUpdatePointCoord={handleUpdatePointCoord}
              onAddShape={handleAddShape}
              onUpdateShape={handleUpdateShape}
              nextPointLabel={nextPointLabel}
              svgRef={svgRef}
              polylinePoints={polylinePoints}
              onSetPolylinePoints={setPolylinePoints}
              onFinishPolyline={handleFinishPolyline}
              bgImage={bgImage}
              onUpdateBgImage={setBgImage}
            />

            {/* Column 3: Right Sidebar (~330px) */}
            <RightSidebar
              selectedPoint={selectedPoint}
              selectedShape={selectedShape}
              points={points}
              shapes={shapes}
              onUpdatePoint={handleUpdatePoint}
              onUpdateShape={handleUpdateShape}
              onDeletePoint={handleDeletePoint}
              onDeleteShape={handleDeleteShape}
              onUnmergeShape={handleUnmergeShape}
              onDeselect={() => {
                setSelectedPointId(null);
                setSelectedShapeId(null);
              }}
              tikzOptions={tikzOptions}
              onUpdateTikzOptions={(opts) => setTikzOptions((prev) => ({ ...prev, ...opts }))}
              svgRef={svgRef}
            />
          </>
        )}
      </main>

      {/* Clear All Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#dbe4ee] rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 space-y-3">
              <div className="w-10 h-10 rounded-full bg-[#fee2e2] text-[#b91c1c] flex items-center justify-center mx-auto">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-sm font-semibold text-[#16233a]">
                  Xoá toàn bộ hình vẽ?
                </h3>
                <p className="text-xs text-[#5b6b82] leading-relaxed">
                  Tất cả các điểm và hình học hiện tại sẽ bị xoá khỏi canvas. Bạn vẫn có thể dùng Hoàn tác (Ctrl+Z) để khôi phục.
                </p>
              </div>
            </div>

            <div className="px-4 py-3 bg-[#f8fafc] border-t border-[#dbe4ee] flex gap-2">
              <button
                onClick={() => setShowClearModal(false)}
                className="flex-1 py-1.5 px-3 bg-white hover:bg-[#f1f5f9] text-[#16233a] border border-[#dbe4ee] text-xs font-semibold rounded-md transition-colors"
              >
                Huỷ bỏ
              </button>
              <button
                onClick={handleClearAll}
                className="flex-1 py-1.5 px-3 bg-[#b91c1c] hover:bg-[#991b1b] text-white text-xs font-semibold rounded-md shadow-xs transition-colors flex items-center justify-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xác nhận xoá</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

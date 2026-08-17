import { GeoPoint, GeoShape } from '../types';

export interface PresetTemplate {
  name: string;
  description: string;
  points: GeoPoint[];
  shapes: GeoShape[];
  pointCounter: number;
}

export const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    name: 'Tam giác vuông & Đường cao',
    description: 'Tam giác ABC vuông tại A có đường cao AH',
    pointCounter: 4,
    points: [
      { id: 'p_a', label: 'A', x: 0, y: 3, labelPos: 'above', style: { color: '#16233a', pointStyle: 'dot' } },
      { id: 'p_b', label: 'B', x: -4, y: 0, labelPos: 'below left', style: { color: '#16233a', pointStyle: 'dot' } },
      { id: 'p_c', label: 'C', x: 2.25, y: 0, labelPos: 'below right', style: { color: '#16233a', pointStyle: 'dot' } },
      { id: 'p_h', label: 'H', x: 0, y: 0, labelPos: 'below', style: { color: '#16233a', pointStyle: 'dot' } },
    ],
    shapes: [
      {
        id: 's_tri',
        type: 'polyline',
        pointIds: ['p_b', 'p_a', 'p_c'],
        isClosed: true,
        style: { color: '#16233a', strokeWidth: 1.5, dashPattern: 'solid' },
      },
      {
        id: 's_ah',
        type: 'segment',
        pointIds: ['p_a', 'p_h'],
        style: { color: '#2f5d99', strokeWidth: 1.5, dashPattern: 'solid' },
      },
    ],
  },
  {
    name: 'Đường tròn ngoại tiếp tam giác',
    description: 'Tam giác ABC nội tiếp đường tròn tâm O',
    pointCounter: 4,
    points: [
      { id: 'p_o', label: 'O', x: 0, y: 0, labelPos: 'below right', style: { color: '#16233a', pointStyle: 'dot' } },
      { id: 'p_a', label: 'A', x: 0, y: 3, labelPos: 'above', style: { color: '#16233a', pointStyle: 'dot' } },
      { id: 'p_b', label: 'B', x: -2.85, y: -0.93, labelPos: 'below left', style: { color: '#16233a', pointStyle: 'dot' } },
      { id: 'p_c', label: 'C', x: 2.85, y: -0.93, labelPos: 'below right', style: { color: '#16233a', pointStyle: 'dot' } },
    ],
    shapes: [
      {
        id: 's_circle',
        type: 'circle',
        centerId: 'p_o',
        radiusPointId: 'p_a',
        style: { color: '#2f5d99', strokeWidth: 1.5, dashPattern: 'solid' },
      },
      {
        id: 's_tri',
        type: 'polyline',
        pointIds: ['p_a', 'p_b', 'p_c'],
        isClosed: true,
        style: { color: '#16233a', strokeWidth: 1.5, dashPattern: 'solid' },
      },
    ],
  },
  {
    name: 'Hình thang cân',
    description: 'Hình thang cân ABCD có hai đáy AB // CD',
    pointCounter: 4,
    points: [
      { id: 'p_a', label: 'A', x: -2, y: 2, labelPos: 'above left', style: { color: '#16233a', pointStyle: 'dot' } },
      { id: 'p_b', label: 'B', x: 2, y: 2, labelPos: 'above right', style: { color: '#16233a', pointStyle: 'dot' } },
      { id: 'p_c', label: 'C', x: 4, y: -1.5, labelPos: 'below right', style: { color: '#16233a', pointStyle: 'dot' } },
      { id: 'p_d', label: 'D', x: -4, y: -1.5, labelPos: 'below left', style: { color: '#16233a', pointStyle: 'dot' } },
    ],
    shapes: [
      {
        id: 's_trap',
        type: 'polyline',
        pointIds: ['p_a', 'p_b', 'p_c', 'p_d'],
        isClosed: true,
        style: { color: '#16233a', strokeWidth: 1.5, dashPattern: 'solid' },
      },
    ],
  },
];

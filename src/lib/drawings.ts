import { supabase, isSupabaseConfigured } from './supabaseClient';
import { GeoPoint, GeoShape, BackgroundImageState, PathAnnotation, RightAngleMark } from '../types';

export interface SavedDrawing {
  id: string;
  name: string;
  points: GeoPoint[];
  shapes: GeoShape[];
  point_counter: number;
  background_image: BackgroundImageState | null;
  path_annotations: PathAnnotation[] | null;
  right_angle_marks: RightAngleMark[] | null;
  updated_at: string;
}

export async function listMyDrawings(): Promise<SavedDrawing[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('drawings')
    .select('id, name, points, shapes, point_counter, background_image, path_annotations, right_angle_marks, updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data as SavedDrawing[];
}

export async function saveNewDrawing(
  name: string,
  points: GeoPoint[],
  shapes: GeoShape[],
  pointCounter: number,
  bgImage: BackgroundImageState | null,
  pathAnnotations: PathAnnotation[],
  rightAngleMarks: RightAngleMark[]
): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Cơ sở dữ liệu Supabase chưa được cấu hình.');
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Chưa đăng nhập');

  const { error } = await supabase.from('drawings').insert({
    user_id: userId,
    name,
    points,
    shapes,
    point_counter: pointCounter,
    background_image: bgImage && bgImage.dataUrl ? bgImage : null,
    path_annotations: pathAnnotations,
    right_angle_marks: rightAngleMarks,
  });
  if (error) throw error;
}

export async function updateDrawing(
  id: string,
  points: GeoPoint[],
  shapes: GeoShape[],
  pointCounter: number,
  bgImage: BackgroundImageState | null,
  pathAnnotations: PathAnnotation[],
  rightAngleMarks: RightAngleMark[]
): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Cơ sở dữ liệu Supabase chưa được cấu hình.');
  const { error } = await supabase
    .from('drawings')
    .update({
      points,
      shapes,
      point_counter: pointCounter,
      background_image: bgImage && bgImage.dataUrl ? bgImage : null,
      path_annotations: pathAnnotations,
      right_angle_marks: rightAngleMarks,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteDrawing(id: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Cơ sở dữ liệu Supabase chưa được cấu hình.');
  const { error } = await supabase.from('drawings').delete().eq('id', id);
  if (error) throw error;
}

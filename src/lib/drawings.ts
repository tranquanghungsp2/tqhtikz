import { supabase, isSupabaseConfigured } from './supabaseClient';
import { GeoPoint, GeoShape } from '../types';

export interface SavedDrawing {
  id: string;
  name: string;
  points: GeoPoint[];
  shapes: GeoShape[];
  point_counter: number;
  updated_at: string;
}

export async function listMyDrawings(): Promise<SavedDrawing[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('drawings')
    .select('id, name, points, shapes, point_counter, updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data as SavedDrawing[];
}

export async function saveNewDrawing(
  name: string,
  points: GeoPoint[],
  shapes: GeoShape[],
  pointCounter: number
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
  });
  if (error) throw error;
}

export async function updateDrawing(
  id: string,
  points: GeoPoint[],
  shapes: GeoShape[],
  pointCounter: number
): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Cơ sở dữ liệu Supabase chưa được cấu hình.');
  const { error } = await supabase
    .from('drawings')
    .update({ points, shapes, point_counter: pointCounter, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteDrawing(id: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Cơ sở dữ liệu Supabase chưa được cấu hình.');
  const { error } = await supabase.from('drawings').delete().eq('id', id);
  if (error) throw error;
}

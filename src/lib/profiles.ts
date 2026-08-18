import { supabase, isSupabaseConfigured } from './supabaseClient';

export interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
  status: 'pending' | 'approved' | 'rejected';
  is_admin: boolean;
  created_at: string;
}

export async function listAllProfiles(): Promise<ProfileRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, status, is_admin, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as ProfileRow[];
}

export async function updateProfileStatus(
  id: string,
  status: 'pending' | 'approved' | 'rejected'
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('profiles').update({ status }).eq('id', id);
  if (error) throw error;
}

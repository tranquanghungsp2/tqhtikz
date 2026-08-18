import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { User } from '@supabase/supabase-js';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | null;

export function useProfile(user: User | null) {
  const [status, setStatus] = useState<ApprovalStatus>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) {
      setStatus(null);
      setIsAdmin(false);
      setLoadingProfile(false);
      return;
    }
    setLoadingProfile(true);
    supabase
      .from('profiles')
      .select('status, is_admin')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          setStatus(null);
          setIsAdmin(false);
        } else {
          setStatus(data?.status ?? null);
          setIsAdmin(!!data?.is_admin);
        }
        setLoadingProfile(false);
      });
  }, [user]);

  return { status, isAdmin, loadingProfile };
}

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '../supabase/client';
import { getNavegacaoPorRole, type NavegacaoPerfil } from './navegacaoPerfil';

export function useNavegacaoPerfil() {
  const [navegacao, setNavegacao] = useState<NavegacaoPerfil | null>(null);
  useEffect(() => {
    let active = true;
    const client = createClient();
    async function load() {
      const { data: { user } } = await client.auth.getUser();
      if (!user) return;
      const [profile, admin] = await Promise.all([
        client.from('users').select('perfil,status').eq('id', user.id).maybeSingle(),
        client.from('rbk_admins').select('user_id').eq('user_id', user.id).eq('ativo', true).maybeSingle(),
      ]);
      if (!active || profile.error || admin.error || profile.data?.status !== 'active') return;
      setNavegacao(getNavegacaoPorRole(profile.data.perfil, Boolean(admin.data)));
    }
    void load().catch(() => {});
    return () => { active = false; };
  }, []);
  return navegacao;
}

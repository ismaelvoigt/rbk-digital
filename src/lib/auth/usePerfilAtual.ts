'use client';
import {useEffect,useState} from 'react';
import {createClient} from '../supabase/client';
import {resolveRole,type RbkRole} from './rbac';

/** A supplied profile avoids repeating the lookup already made by a page. */
export function usePerfilAtual(conhecido?:RbkRole | null) {
  const [perfil,setPerfil] = useState<RbkRole | null>(null);
  useEffect(()=>{
    if (conhecido !== undefined) return;
    let ativo = true;
    async function carregar() {
      const client = createClient();
      const {data:{user}} = await client.auth.getUser();
      if (!user) return;
      const [profile,admin] = await Promise.all([
        client.from('users').select('perfil,status').eq('id',user.id).maybeSingle(),
        client.from('rbk_admins').select('user_id').eq('user_id',user.id).eq('ativo',true).maybeSingle(),
      ]);
      if (!ativo || admin.error) return;
      if (admin.data) {setPerfil(resolveRole(profile.data?.perfil ?? null,true));return;}
      if (profile.error || profile.data?.status !== 'active') return;
      setPerfil(resolveRole(profile.data.perfil,false));
    }
    void carregar().catch(()=>{});
    return ()=>{ativo=false;};
  },[conhecido]);
  return conhecido !== undefined ? conhecido : perfil;
}

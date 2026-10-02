'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {createBrowserClient} from '@supabase/ssr';
import {browserSessionCookies,setSessionPersistence} from './sessionPersistence';
import {destinoLinkAntigo,validarLinkDeSenha,type FinalidadeSenha} from './linkDeSenha';

export function useLinkDeSenha(finalidade: FinalidadeSenha) {
 const [supabase]=useState(()=>createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{
  isSingleton:false,cookies:browserSessionCookies,auth:{detectSessionInUrl:false,autoRefreshToken:false},
 }));
 const tentativa=useRef<Promise<{token:string;id:string;expires:number}|null>|null>(null);
 const autorizado=useRef<{token:string;id:string;expires:number}|null>(null);
 const ocupado=useRef(false), redirecionamento=useRef<ReturnType<typeof setTimeout>|null>(null);
 const [estado,setEstado]=useState<'validando'|'valido'|'invalido'|'sucesso'>('validando');
 const [novaSenha,setNovaSenha]=useState(''),[confirmacao,setConfirmacao]=useState('');
 const [erro,setErro]=useState(''),[salvando,setSalvando]=useState(false);
 useEffect(()=>{
  let ativo=true,timer:ReturnType<typeof setTimeout>|undefined;
  if (!tentativa.current) {
   const destino=destinoLinkAntigo(window.location.href);
   if (destino) {window.location.replace(destino);return;}
   tentativa.current=(async()=>{
    const valid=await validarLinkDeSenha(supabase.auth,window.location.href,finalidade);
    if(!valid)return null;
    const {data:{session}}=await supabase.auth.getSession();
    return session?{token:session.access_token,id:session.user.id,expires:session.expires_at??0}:null;
   })().catch(()=>null);
  }
  tentativa.current.then(grant=>{
   if(!ativo)return;
   window.history.replaceState(null,'',window.location.pathname);
   autorizado.current=grant;setEstado(grant?'valido':'invalido');
   if(grant)timer=setTimeout(()=>{autorizado.current=null;setEstado(current=>current==='sucesso'?current:'invalido');},Math.max(0,grant.expires*1000-Date.now()));
  });
  return()=>{ativo=false;if(timer)clearTimeout(timer);if(redirecionamento.current)clearTimeout(redirecionamento.current);};
 },[supabase,finalidade]);
 async function salvar(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(ocupado.current||estado!=='valido')return;setErro('');
  if(novaSenha.length<6){setErro('A nova senha deve ter pelo menos 6 caracteres.');return;}
  if(novaSenha!==confirmacao){setErro('As senhas não conferem.');return;}
  ocupado.current=true;setSalvando(true);
  try{
   const grant=autorizado.current;
   const {data:{session}}=await supabase.auth.getSession();
   if(!grant||grant.expires*1000<=Date.now()||session?.access_token!==grant.token||session.user.id!==grant.id){setEstado('invalido');return;}
   const {data:{user},error:verification}=await supabase.auth.getUser(grant.token);
   if(verification||user?.id!==grant.id){setEstado('invalido');return;}
   const {error}=await supabase.auth.updateUser({password:novaSenha});
   if(error){
    if(error.status===401||error.status===403){setEstado('invalido');return;}
    setErro(error.code==='same_password'?'Escolha uma senha diferente da anterior.':error.code==='weak_password'?'Escolha uma senha mais forte, com letras, números e símbolos.':'Não foi possível salvar a senha. Tente novamente.');return;
   }
   autorizado.current=null;setEstado('sucesso');setNovaSenha('');setConfirmacao('');
   if(finalidade==='recovery')await supabase.auth.signOut();
   else setSessionPersistence(null);
   // O proxy aplica o perfil e o status de acesso ao entrar no sistema.
   redirecionamento.current=setTimeout(()=>window.location.replace(finalidade==='invite'?'/farmacia':'/'),1200);
  }catch{setErro('Não foi possível salvar a senha. Verifique sua conexão e tente novamente.');}
  finally{ocupado.current=false;setSalvando(false);}
 }
 return {estado,novaSenha,setNovaSenha,confirmacao,setConfirmacao,erro,salvando,salvar};
}

'use client';
import {useRef,useState,type FormEvent} from 'react';
import {createClient} from '../../lib/supabase/client';
import {SenhaLayout} from '../../components/auth/SenhaLayout';
export default function EsqueciMinhaSenha(){
 const [email,setEmail]=useState(''),[enviando,setEnviando]=useState(false),[mensagem,setMensagem]=useState(''),[erro,setErro]=useState('');const ocupado=useRef(false);
 async function enviar(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(ocupado.current)return;setMensagem('');setErro('');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())){setErro('Informe um e-mail válido.');return;}
  ocupado.current=true;setEnviando(true);
  try{
   const {error}=await createClient().auth.resetPasswordForEmail(email.trim(),{redirectTo:`${window.location.origin}/redefinir-senha`});
   if(error){setErro(error.status===429?'Aguarde alguns minutos antes de solicitar outro link.':'Não foi possível enviar o link. Tente novamente.');return;}
   setMensagem('Se houver uma conta com esse e-mail, você receberá um link de recuperação. Verifique também a caixa de spam.');
  }catch{setErro('Não foi possível enviar o link. Verifique sua conexão e tente novamente.');}
  finally{ocupado.current=false;setEnviando(false);}
 }
 return <SenhaLayout><header className="mb-7"><h1 className="text-2xl font-semibold text-slate-900">Esqueci minha senha</h1><p className="mt-3 text-sm text-slate-500">Informe o e-mail da sua conta para receber um link de recuperação.</p></header><form onSubmit={enviar} className="space-y-4"><label htmlFor="email" className="block text-sm font-medium text-slate-700">E-mail</label><input id="email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-600"/>{erro&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}{mensagem&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{mensagem}</p>}<button type="submit" disabled={enviando} className="w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-60">{enviando?'Enviando...':'Enviar link de recuperação'}</button></form></SenhaLayout>;
}

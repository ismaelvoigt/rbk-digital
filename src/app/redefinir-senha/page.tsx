'use client';
import Link from 'next/link';
import {useLinkDeSenha} from '../../lib/auth/useLinkDeSenha';
import {SenhaLayout} from '../../components/auth/SenhaLayout';
import {SenhaCampos} from '../../components/auth/SenhaCampos';
export default function RedefinirSenha(){
 const fluxo=useLinkDeSenha('recovery');
 return <SenhaLayout><header className="mb-7 text-center"><p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Recuperação de acesso</p><h1 className="text-2xl font-semibold text-slate-900">Redefinir senha</h1><p className="mt-3 text-sm text-slate-500">Defina uma nova senha para recuperar seu acesso.</p></header>
 {fluxo.estado==='validando'?<p role="status">Validando seu link de recuperação...</p>:fluxo.estado==='invalido'?<div role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">O link de recuperação é inválido ou expirou.<Link href="/esqueci-minha-senha" className="mt-3 block font-semibold underline">Solicitar novo link de recuperação</Link></div>:<SenhaCampos fluxo={fluxo} botao="Salvar nova senha" sucesso="Senha alterada com sucesso! Você será direcionado ao login."/>}
 </SenhaLayout>;
}

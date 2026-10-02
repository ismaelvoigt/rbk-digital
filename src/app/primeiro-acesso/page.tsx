'use client';
import {useLinkDeSenha} from '../../lib/auth/useLinkDeSenha';
import {SenhaLayout} from '../../components/auth/SenhaLayout';
import {SenhaCampos} from '../../components/auth/SenhaCampos';
export default function PrimeiroAcesso(){
 const fluxo=useLinkDeSenha('invite');
 return <SenhaLayout><header className="mb-7"><p className="mb-3 text-xs font-bold uppercase tracking-widest text-red-600">Primeiro acesso</p><h1 className="text-2xl font-semibold text-slate-900">Crie sua senha de acesso ao RBK Digital</h1><p className="mt-3 text-sm text-slate-500">Bem-vindo! Você está criando sua senha para começar a usar o sistema.</p></header>
 {fluxo.estado==='validando'?<p role="status">Validando seu convite...</p>:fluxo.estado==='invalido'?<div role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">O convite é inválido ou expirou. Solicite um novo convite ao administrador da RBK.</div>:<SenhaCampos fluxo={fluxo} botao="Criar senha e acessar" sucesso="Senha criada com sucesso! Você será direcionado ao sistema."/>}
 </SenhaLayout>;
}

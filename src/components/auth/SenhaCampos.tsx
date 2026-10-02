'use client';
import type {useLinkDeSenha} from '../../lib/auth/useLinkDeSenha';
export function SenhaCampos({fluxo,botao,sucesso}:{fluxo:ReturnType<typeof useLinkDeSenha>;botao:string;sucesso:string}){
 return <form onSubmit={fluxo.salvar} className="space-y-4">
 <div><label htmlFor="novaSenha" className="mb-1 block text-sm font-medium text-slate-700">Nova senha</label><input id="novaSenha" type="password" autoComplete="new-password" minLength={6} required value={fluxo.novaSenha} onChange={e=>fluxo.setNovaSenha(e.target.value)} disabled={fluxo.salvando||fluxo.estado==='sucesso'} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-600" aria-describedby="senha-ajuda"/><p id="senha-ajuda" className="mt-1 text-xs text-slate-500">Use pelo menos 6 caracteres.</p></div>
 <div><label htmlFor="confirmacao" className="mb-1 block text-sm font-medium text-slate-700">Confirmar nova senha</label><input id="confirmacao" type="password" autoComplete="new-password" minLength={6} required value={fluxo.confirmacao} onChange={e=>fluxo.setConfirmacao(e.target.value)} disabled={fluxo.salvando||fluxo.estado==='sucesso'} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-600"/></div>
 {fluxo.erro&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{fluxo.erro}</p>}
 {fluxo.estado==='sucesso'&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{sucesso}</p>}
 <button type="submit" disabled={fluxo.salvando||fluxo.estado==='sucesso'} className="w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">{fluxo.salvando?'Salvando...':botao}</button>
 </form>;
}

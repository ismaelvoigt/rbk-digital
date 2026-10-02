'use client';
import Link from 'next/link';
import {useEffect,useState,type ReactNode} from 'react';
import {RbkBrand} from '../RbkBrand';
import {createClient} from '../../lib/supabase/client';
import {contextoModulo,pesquisarFarmacias,nomeFarmacia,cnpjFormatado,type FarmaciaModulo} from '../../lib/modulos/escopo';
export default function EscopoModulo({titulo,children}:{titulo:string;children:(farmId:string,onBusy:(value:boolean)=>void)=>ReactNode}){
 const [contexto,setContexto]=useState<{gestor:boolean;farmacia:FarmaciaModulo|null}|null>(null);
 const [selecionada,setSelecionada]=useState<FarmaciaModulo|null>(null),[busca,setBusca]=useState(''),[opcoes,setOpcoes]=useState<FarmaciaModulo[]>([]),[erro,setErro]=useState(''),[buscando,setBuscando]=useState(false),[busy,setBusy]=useState(false),[desktop,setDesktop]=useState<boolean|null>(null);
 useEffect(()=>{const m=window.matchMedia('(min-width: 1024px)');const update=()=>setDesktop(m.matches);update();m.addEventListener('change',update);return()=>m.removeEventListener('change',update);},[]);
 useEffect(()=>{let active=true;void contextoModulo(createClient()).then(c=>{if(active){setContexto(c);setSelecionada(c.farmacia);}}).catch(e=>{if(active)setErro(e.message);});return()=>{active=false;};},[]);
 useEffect(()=>{if(!contexto?.gestor)return;let active=true;const timer=setTimeout(()=>{setBuscando(true);setErro('');void pesquisarFarmacias(createClient(),busca).then(rows=>{if(active)setOpcoes(rows);}).catch(e=>{if(active){setOpcoes([]);setErro(e.message);}}).finally(()=>{if(active)setBuscando(false);});},250);return()=>{active=false;clearTimeout(timer);};},[busca,contexto]);
 const mobile=contexto&&!contexto.gestor&&desktop===false;
 return <main className="rbk-shell min-h-screen"><header className="rbk-header"><div className="rbk-container flex min-h-[76px] items-center justify-between gap-3 py-3"><RbkBrand compact/><Link href={contexto?.gestor?'/dashboard':'/farmacia'} className="text-sm font-bold text-gray-600 hover:text-red-700">← Voltar ao Dashboard</Link></div></header>
 <div className="rbk-container pt-6">
 {erro&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-800">{erro}</p>}
 {!contexto&&!erro&&<p role="status">Verificando acesso…</p>}
 {mobile?<section className="rbk-card p-6"><h1 className="text-xl font-bold">{titulo}</h1><p className="mt-3">Este módulo está disponível na versão desktop. Acesse pelo computador para consultar os dados da sua farmácia.</p></section>:contexto&&desktop!==null&&<>
 {contexto.gestor&&<fieldset disabled={busy} className="rbk-card mb-4 p-5 disabled:opacity-60"><legend className="px-2 font-semibold">Selecionar farmácia</legend><label className="block text-sm font-semibold" htmlFor="busca-farmacia">Pesquisar por CNPJ, razão social ou nome da farmácia</label><input id="busca-farmacia" type="search" className="rbk-input mt-2 w-full" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Digite o CNPJ ou nome"/><label className="mt-3 block text-sm" htmlFor="selecao-farmacia">Farmácias autorizadas</label><select id="selecao-farmacia" className="rbk-input mt-2 w-full" value={selecionada?.id||''} onChange={e=>{setSelecionada(opcoes.find(f=>f.id===e.target.value)||null);setBusy(false);}}><option value="">Selecione uma farmácia/CNPJ</option>{selecionada&&!opcoes.some(f=>f.id===selecionada.id)&&<option value={selecionada.id}>{nomeFarmacia(selecionada)} · {cnpjFormatado(selecionada.cnpj)}</option>}{opcoes.map(f=><option value={f.id} key={f.id}>{nomeFarmacia(f)} · {cnpjFormatado(f.cnpj)}</option>)}</select><p role="status" className="mt-2 text-xs text-gray-500">{buscando?'Buscando…':opcoes.length?'Até 50 resultados. Refine a busca para localizar a farmácia.':'Nenhuma farmácia autorizada encontrada.'}{busy?' Aguarde a operação terminar para trocar de farmácia.':''}</p></fieldset>}
 {selecionada?<section aria-label="Farmácia selecionada" className="rounded-xl border border-red-100 bg-white px-5 py-4"><p className="font-bold text-gray-900">{nomeFarmacia(selecionada)}</p><p className="mt-1 text-sm text-gray-600">CNPJ: {cnpjFormatado(selecionada.cnpj)}{selecionada.razao_social&&selecionada.razao_social!==selecionada.nome_fantasia?` · ${selecionada.razao_social}`:''}</p></section>:<section className="rbk-card p-8 text-center"><h1 className="text-2xl font-bold">{titulo}</h1><p className="mt-3 text-gray-600">Selecione uma farmácia/CNPJ para visualizar os dados.</p></section>}
 </>}
 </div>{contexto&&desktop!==null&&!mobile&&selecionada&&<div key={selecionada.id}>{children(selecionada.id,setBusy)}</div>}</main>;
}

'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {periodo,type Resumo} from '../../lib/proximas/domain';
import {supabaseRepository,type ProximasRepository} from '../../lib/proximas/repository';
export default function ProximasCard({repository=supabaseRepository,baseHref='/proximas-dispensacoes'}:{repository?:ProximasRepository;baseHref?:string}){
 const [r,setR]=useState<Resumo|null>(null),[erro,setErro]=useState('');
 useEffect(()=>{let ativo=true;async function load(){try{const c=await repository.contexto();if(c.gestor)return;const farm=c.farmacias[0];if(!farm)throw new Error('Farmácia não vinculada.');const res=await repository.listar(farm.id,periodo('hoje'));if(ativo)setR(res.resumo);}catch(e){if(ativo)setErro(e instanceof Error?e.message:'Não foi possível consultar.');}}void load();return()=>{ativo=false;};},[repository]);
 return <article className="rbk-card p-6"><h2 className="text-base font-bold text-gray-900">Próximas Dispensações</h2><p className="mt-3 text-sm leading-6 text-gray-500">Acompanhe clientes com nova retirada prevista.</p>{r?<div className="mt-4 grid grid-cols-2 gap-2">{([['hoje','Hoje',r.hoje],['2dias','Próximos 2 dias',r.dias2],['7dias','Próximos 7 dias',r.dias7],['30dias','Próximos 30 dias',r.dias30]] as const).map(([m,t,n])=><Link key={m} href={`${baseHref}?periodo=${m}`} className="rounded-xl bg-gray-50 p-3 hover:bg-red-50"><span className="block text-xs text-gray-500">{t}</span><strong className="text-xl text-gray-900">{n}</strong></Link>)}</div>:<p className="mt-3 text-xs text-gray-500">{erro||'Carregando previsões…'}</p>}{r&&<Link href={`${baseHref}?periodo=alertas`} className="mt-3 block rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{r.alertas??0} avisos pendentes · alerta 2 dias antes</Link>}<Link href={baseHref} className="mt-5 inline-block text-sm font-bold text-red-600">Acompanhar retiradas →</Link></article>;
}

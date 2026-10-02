import type { FormEvent } from 'react';
import type { FiltrosRelatorios as Filtros } from '../../lib/relatorios/filtros';
import CamposCrm from './CamposCrm';
export default function FiltrosRelatorios({value,onChange,onSubmit,onClear,busy}:{value:Filtros;onChange:(value:Filtros)=>void;onSubmit:(event:FormEvent)=>void;onClear:()=>void;busy:boolean}) {
  const set=(key:keyof Filtros,text:string)=>onChange({...value,[key]:text});
  return <form onSubmit={onSubmit} className="rbk-card p-5 sm:p-6">
    <fieldset disabled={busy}>
      <legend className="mb-4 text-lg font-bold text-gray-900">Localizar autorizações</legend>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <div><label htmlFor="modo-data" className="mb-2 block text-sm font-semibold text-gray-700">Consultar por data</label>
          <select id="modo-data" className="rbk-input" value={value.modoData || 'todas'} onChange={e=>set('modoData',e.target.value)}><option value="todas">Todas as datas</option><option value="dia">Data específica</option><option value="periodo">Período inicial e final</option></select></div>
        {value.modoData==='dia'&&<div><label htmlFor="dia" className="mb-2 block text-sm font-semibold text-gray-700">Data específica</label><input id="dia" type="date" className="rbk-input" value={value.dia || ''} onChange={e=>set('dia',e.target.value)} required /></div>}
        {value.modoData==='periodo'&&<>
          <div><label htmlFor="inicio" className="mb-2 block text-sm font-semibold text-gray-700">Data inicial</label><input id="inicio" type="date" className="rbk-input" value={value.inicio || ''} onChange={e=>set('inicio',e.target.value)} required /></div>
          <div><label htmlFor="fim" className="mb-2 block text-sm font-semibold text-gray-700">Data final</label><input id="fim" type="date" className="rbk-input" value={value.fim || ''} onChange={e=>set('fim',e.target.value)} required /></div>
        </>}
        <div><label htmlFor="numero-autorizacao" className="mb-2 block text-sm font-semibold text-gray-700">Número da autorização</label><input id="numero-autorizacao" className="rbk-input" value={value.numero || ''} onChange={e=>set('numero',e.target.value)} placeholder="15 dígitos" inputMode="numeric" maxLength={19} /></div>
        <div><label htmlFor="cpf" className="mb-2 block text-sm font-semibold text-gray-700">CPF do beneficiário</label><input id="cpf" className="rbk-input" value={value.cpf || ''} onChange={e=>set('cpf',e.target.value)} placeholder="000.000.000-00" inputMode="numeric" maxLength={14} /></div>
        <CamposCrm filtro crm={value.crm || ''} uf={value.uf || ''} onChange={(crm,uf)=>onChange({...value,crm,uf})} />
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 pt-5">
        <p className="max-w-xl text-xs leading-5 text-gray-500">Datas referentes à autorização. A busca por CRM considera apenas registros com esse campo preenchido.</p>
        <div className="flex gap-3"><button type="button" onClick={onClear} className="min-h-11 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-600">Limpar filtros</button><button type="submit" className="rbk-primary min-h-11 rounded-xl px-6 text-sm font-bold disabled:opacity-60">{busy?'Aguarde...':'Pesquisar'}</button></div>
      </div>
    </fieldset>
  </form>;
}

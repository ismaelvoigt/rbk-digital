'use client';

import dynamic from 'next/dynamic';
import {useCallback, useState} from 'react';
import EscopoModulo from './EscopoModulo';

const loading = () => <p role="status" className="rbk-container py-8">Carregando módulo…</p>;
const Vendas = dynamic(() => import('./VendasModulo'), {loading});
const Compras = dynamic(() => import('./ComprasModulo'), {loading});
const Relatorios = dynamic(() => import('./RelatoriosModulo'), {loading});
const modulos = [
  {id: 'vendas', titulo: 'Vendas e Indicadores', descricao: 'Analisar medicamentos, dispensações e faturamento', icone: 'vendas'},
  {id: 'compras', titulo: 'Planejamento de Compras', descricao: 'Acompanhar consumo e projetar necessidade de reposição', icone: 'compras'},
  {id: 'relatorios', titulo: 'Relatórios e PDFs', descricao: 'Consultar autorizações e gerar relatórios/documentos', icone: 'relatorios'},
] as const;
type Modulo = typeof modulos[number]['id'];

export default function Administracao({moduloInicial}: {moduloInicial?: string}) {
  return <EscopoModulo titulo="Administração">{(farmId, onBusy) =>
    <Conteudo key={farmId} farmId={farmId} onBusy={onBusy} moduloInicial={moduloInicial}/>
  }</EscopoModulo>;
}

function Conteudo({farmId, onBusy, moduloInicial}: {
  farmId: string; onBusy: (value: boolean) => void; moduloInicial?: string;
}) {
  const [modulo, setModulo] = useState<Modulo | null>(
    modulos.find(item => item.id === moduloInicial)?.id ?? null,
  );
  const [ocupado, setOcupado] = useState(false);
  const atualizarOcupado = useCallback((value: boolean) => {
    setOcupado(value);
    onBusy(value);
  }, [onBusy]);

  return <>
    <div className="rbk-container pt-7">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">GESTÃO DA FARMÁCIA</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">Administração</h1>
      {modulo ? <nav aria-label="Módulos de Administração" className="mt-5 flex flex-wrap gap-2">
        <button disabled={ocupado} onClick={() => setModulo(null)} className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 disabled:opacity-50">← Administração</button>
        {modulos.map(item => <button key={item.id} disabled={ocupado} aria-current={modulo === item.id ? 'page' : undefined} onClick={() => setModulo(item.id)} className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 ${modulo === item.id ? 'bg-red-700 text-white' : 'border border-gray-200 bg-white text-gray-700 hover:bg-red-50'}`}>{item.titulo}</button>)}
      </nav> : <>
        <p className="mt-2 text-gray-500">Selecione o módulo para acompanhar a farmácia exibida acima.</p>
        <section aria-label="Módulos de Administração" className="grid gap-5 py-7 lg:grid-cols-3">
          {modulos.map(item => <button key={item.id} onClick={() => setModulo(item.id)} className="rbk-card rbk-card-hover group flex flex-col items-start p-6 text-left">
            <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-700" aria-hidden="true"><Icone modulo={item.id}/></span>
            <h2 className="text-lg font-bold text-gray-900">{item.titulo}</h2>
            <p className="mt-3 flex-1 text-sm leading-6 text-gray-500">{item.descricao}</p>
            <span className="mt-5 text-sm font-bold text-red-600">Abrir módulo →</span>
          </button>)}
        </section>
      </>}
    </div>
    {modulo === 'vendas' && <Vendas farmId={farmId} onBusy={atualizarOcupado}/>}
    {modulo === 'compras' && <Compras farmId={farmId} onBusy={atualizarOcupado}/>}
    {modulo === 'relatorios' && <Relatorios farmId={farmId} onBusy={atualizarOcupado}/>}
  </>;
}

function Icone({modulo}: {modulo: Modulo}) {
  if(modulo === 'relatorios') return <span className="text-xs font-bold">PDF</span>;
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={modulo === 'vendas' ? 'M4 19V5m0 14h16M8 15v-4m5 4V7m5 8v-6' : 'm3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10M7 5l10 4'}/></svg>;
}

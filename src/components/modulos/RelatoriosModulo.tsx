'use client';
import {useLayoutEffect} from 'react';
import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import CamposCrm from '../../components/relatorios/CamposCrm';
import FiltrosRelatorios from '../../components/relatorios/FiltrosRelatorios';
import { createClient } from '../../lib/supabase/client';
import { pesquisarRelatorios, salvarCrm, TAMANHO_PAGINA, type AutorizacaoRelatorio } from '../../lib/relatorios/consulta';
import type { FiltrosRelatorios as Filtros } from '../../lib/relatorios/filtros';

const MAX_SELECAO=20;
const numeroFormatado=(value:string)=>value.replace(/(\d{3})(?=\d)/g,'$1.');
const cpfFormatado=(value:string|null)=>value?.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4') || 'Não informado';
const erroTexto=(error:unknown)=>error instanceof Error?error.message:'Não foi possível concluir a operação. Tente novamente.';

export default function RelatoriosConteudo({farmId,onBusy}:{farmId:string;onBusy:(value:boolean)=>void}) {
  const [filtros,setFiltros]=useState<Filtros>({modoData:'todas'});
  const [linhas,setLinhas]=useState<AutorizacaoRelatorio[]>([]);
  const [total,setTotal]=useState(0),[pagina,setPagina]=useState(0),[pesquisou,setPesquisou]=useState(false);
  const [selecao,setSelecao]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(false),[erro,setErro]=useState(''),[mensagem,setMensagem]=useState('');
  const [edicao,setEdicao]=useState<{id:string;numero:string;crm:string;uf:string}|null>(null);
  const ocupado=useRef(false);
  const selecionados=Object.keys(selecao);
  function limparResultados() {setLinhas([]);setTotal(0);setPagina(0);setPesquisou(false);setSelecao({});setEdicao(null);setErro('');setMensagem('');}
  function mudarFiltros(value:Filtros) {if(ocupado.current)return;setFiltros(value);limparResultados();}
  async function pesquisar(p=0,nova=true) {
    if(ocupado.current)return;
    ocupado.current=true;setBusy(true);setErro('');setMensagem('');setEdicao(null);
    if(nova)setSelecao({});
    try {
      const result=await pesquisarRelatorios(createClient(),filtros,p,farmId);
      setLinhas(result.autorizacoes);setTotal(result.total);setPagina(p);setPesquisou(true);
    } catch(error) {setErro(erroTexto(error));setLinhas([]);setTotal(0);setPesquisou(false);setSelecao({});}
    finally {ocupado.current=false;setBusy(false);}
  }
  function selecionar(item:AutorizacaoRelatorio) {
    if(busy)return;
    setErro('');
    if(selecao[item.id]){setSelecao(current=>{const next={...current};delete next[item.id];return next;});return;}
    if(selecionados.length>=MAX_SELECAO){setErro('Selecione no máximo 20 autorizações por PDF.');return;}
    setSelecao({...selecao,[item.id]:item.numero_autorizacao});
  }
  function selecionarPagina() {
    const next={...selecao};
    for(const item of linhas){if(Object.keys(next).length>=MAX_SELECAO)break;next[item.id]=item.numero_autorizacao;}
    setSelecao(next);setErro('');
  }
  async function exportar(ids:string[],tipo:'pdf'|'anexos') {
    if(ocupado.current || !ids.length)return;
    ocupado.current=true;setBusy(true);setErro('');setMensagem('Preparando download...');setEdicao(null);
    try {
      const service=await import('../../lib/relatorios/exportar');
      const message=tipo==='pdf'?await service.exportarPdfs(createClient(),ids,setMensagem,farmId):await service.baixarAnexos(createClient(),ids[0],setMensagem,farmId);
      setMensagem(message);
    }catch(error){setErro(erroTexto(error));setMensagem('Nenhum arquivo foi baixado.');}
    finally{ocupado.current=false;setBusy(false);}
  }
  async function gravarCrm(event:FormEvent) {
    event.preventDefault();if(!edicao || ocupado.current)return;
    ocupado.current=true;setBusy(true);setErro('');
    try {
      await salvarCrm(createClient(),edicao.id,edicao.crm,edicao.uf,farmId);
      const result=await pesquisarRelatorios(createClient(),filtros,0,farmId);
      setLinhas(result.autorizacoes);setTotal(result.total);setPagina(0);setSelecao({});setEdicao(null);setMensagem('CRM salvo. Resultados atualizados e seleção limpa.');
    }catch(error){setErro(erroTexto(error));}
    finally{ocupado.current=false;setBusy(false);}
  }
 useLayoutEffect(()=>{onBusy(busy);return()=>onBusy(false);},[busy,onBusy]);
  return <div>
    
    <div className="rbk-container py-7 sm:py-9">
      <div className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">Documentação • Autorizações</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">Relatórios e PDFs</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">Localize autorizações, reúna os documentos em PDF e baixe os anexos originais.</p></div>
      <FiltrosRelatorios value={filtros} onChange={mudarFiltros} onSubmit={e=>{e.preventDefault();void pesquisar();}} onClear={()=>mudarFiltros({modoData:'todas'})} busy={busy} />
      <div className="my-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rbk-card px-5 py-4"><p className="text-2xl font-bold text-gray-900">{pesquisou?total.toLocaleString('pt-BR'):'—'}</p><p className="mt-1 text-xs text-gray-500">Autorizações encontradas</p></div>
        <div className="rbk-card px-5 py-4"><p className="text-2xl font-bold text-red-700">{selecionados.length}<span className="text-sm font-medium text-gray-400"> / 20</span></p><p className="mt-1 text-xs text-gray-500">Selecionadas para PDF</p></div>
        <div className="rbk-card col-span-2 px-5 py-4 sm:col-span-1"><p className="text-2xl font-bold text-gray-900">{pesquisou&&total?pagina+1:'—'}</p><p className="mt-1 text-xs text-gray-500">Página {total?`de ${Math.ceil(total/TAMANHO_PAGINA)}`:'de resultados'}</p></div>
      </div>
      {erro&&<p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{erro}</p>}
      <p role="status" aria-live="polite" className={mensagem?'mb-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-900':'sr-only'}>{mensagem}</p>
      {edicao&&<section aria-label="Editar CRM da autorização" className="rbk-card mb-5 border-red-200 p-5"><form onSubmit={gravarCrm}><fieldset disabled={busy}><legend className="mb-4 font-bold text-gray-900">CRM da autorização {numeroFormatado(edicao.numero)}</legend><div className="max-w-md"><CamposCrm prefixo="editar-crm" crm={edicao.crm} uf={edicao.uf} onChange={(crm,uf)=>setEdicao({...edicao,crm,uf})}/></div><p className="mt-2 text-xs text-gray-500">Preencha conforme a receita. Para remover o CRM, deixe número e UF em branco.</p><div className="mt-4 flex gap-3"><button className="rbk-primary min-h-11 rounded-xl px-5 text-sm font-bold">Salvar CRM</button><button type="button" onClick={()=>setEdicao(null)} className="min-h-11 px-4 text-sm font-semibold text-gray-600">Cancelar</button></div></fieldset></form></section>}
      <section className="rbk-card overflow-hidden" aria-label="Resultados da pesquisa" aria-busy={busy}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 p-5"><div><h2 className="text-lg font-bold text-gray-900">Autorizações</h2><p className="mt-1 text-xs text-gray-500">Seleção mantida entre páginas. Nova pesquisa limpa a seleção.</p></div><button disabled={busy||!selecionados.length} onClick={()=>void exportar(selecionados,'pdf')} className="rbk-primary min-h-11 rounded-xl px-5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40">{selecionados.length>1?`Gerar PDF consolidado (${selecionados.length})`:'Gerar PDF da seleção'}</button></div>
        {selecionados.length>0&&<div className="flex flex-wrap items-center gap-2 border-b border-red-100 bg-red-50 px-5 py-3"><span className="text-xs font-semibold text-red-800">Selecionadas:</span>{Object.entries(selecao).map(([id,numero])=><button key={id} disabled={busy} aria-label={`Remover autorização ${numero} da seleção`} onClick={()=>setSelecao(current=>{const next={...current};delete next[id];return next;})} className="min-h-9 rounded-lg border border-red-100 bg-white px-2 text-xs text-red-800">{numeroFormatado(numero)} ×</button>)}</div>}
        {linhas.length>0?<>
          <div className="flex flex-wrap gap-4 px-5 py-3"><button disabled={busy} onClick={selecionarPagina} className="min-h-9 text-xs font-bold text-red-700">Selecionar até 20 nesta página</button><button disabled={busy||!selecionados.length} onClick={()=>setSelecao({})} className="min-h-9 text-xs font-semibold text-gray-600 disabled:opacity-40">Limpar seleção</button></div>
          <div className="overflow-x-auto" tabIndex={0} aria-label="Tabela de autorizações; deslize para ver todas as colunas">
            <table className="w-full min-w-[1000px] text-left text-sm"><thead className="border-y border-gray-100 bg-gray-50 text-xs text-gray-500"><tr>{['Selecionar','Autorização / Data','CPF do beneficiário','CRM / UF','Farmácia','Ações'].map(label=><th key={label} scope="col" className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{linhas.map(item=><tr key={item.id} className={selecao[item.id]?'bg-red-50/60':'hover:bg-gray-50/70'}>
              <td className="px-4 py-4"><input type="checkbox" className="h-5 w-5 accent-red-700" aria-label={`Selecionar autorização ${item.numero_autorizacao}`} checked={Boolean(selecao[item.id])} disabled={busy} onChange={()=>selecionar(item)}/></td>
              <td className="px-4 py-4"><p className="font-bold text-gray-900">{numeroFormatado(item.numero_autorizacao)}</p><p className="mt-1 text-xs text-gray-500">{item.data_autorizacao?.split('-').reverse().join('/') || 'Data não informada'}</p></td>
              <td className="whitespace-nowrap px-4 py-4 text-gray-700">{cpfFormatado(item.cpf_cliente)}</td>
              <td className="px-4 py-4"><p className="whitespace-nowrap text-gray-700">{item.crm?`${item.crm} / ${item.crm_uf}`:'Não informado'}</p><button disabled={busy} className="mt-1 min-h-8 text-xs font-semibold text-red-700" onClick={()=>{setErro('');setEdicao({id:item.id,numero:item.numero_autorizacao,crm:item.crm||'',uf:item.crm_uf||''});}}>{item.crm?'Editar CRM':'Informar CRM'}</button></td>
              <td className="max-w-[180px] px-4 py-4 text-gray-600"><span className="line-clamp-2">{item.farmacia || 'Não informada'}</span></td>
              <td className="px-4 py-4"><div className="flex flex-wrap gap-x-4 gap-y-1"><button disabled={busy} onClick={()=>void exportar([item.id],'pdf')} className="min-h-9 font-bold text-red-700 disabled:opacity-40">Gerar PDF</button><button disabled={busy} onClick={()=>void exportar([item.id],'anexos')} className="min-h-9 font-semibold text-gray-700 disabled:opacity-40">Anexos ZIP</button><Link href={`/autorizacoes/${item.id}/documentos`} className="min-h-9 content-center text-xs text-gray-500 underline underline-offset-4">Ver documentos</Link></div></td>
            </tr>)}</tbody></table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-4"><p className="text-xs text-gray-500">Exibindo {pagina*TAMANHO_PAGINA+1}–{pagina*TAMANHO_PAGINA+linhas.length} de {total}</p><div className="flex gap-2"><button disabled={busy||pagina===0} onClick={()=>void pesquisar(pagina-1,false)} className="min-h-10 rounded-lg border border-gray-200 px-4 text-sm disabled:opacity-40">Anterior</button><button disabled={busy||(pagina+1)*TAMANHO_PAGINA>=total} onClick={()=>void pesquisar(pagina+1,false)} className="min-h-10 rounded-lg border border-gray-200 px-4 text-sm disabled:opacity-40">Próxima</button></div></div>
        </>:<div className="px-5 py-14 text-center"><p className="font-semibold text-gray-700">{busy?'Carregando autorizações...':pesquisou?'Nenhuma autorização encontrada':'Encontre os documentos de que precisa'}</p><p className="mt-2 text-sm text-gray-500">{pesquisou?'Ajuste os filtros e pesquise novamente.':'Escolha os filtros acima e clique em Pesquisar.'}</p></div>}
      </section>
      <p className="mt-4 text-xs leading-5 text-gray-500">O PDF mantém o modelo das autorizações e reúne os anexos disponíveis. Até 20 autorizações, 200 páginas ou 100 MB por conjunto. Os arquivos originais estão disponíveis em Anexos ZIP.</p>
    </div>
  </div>;
}


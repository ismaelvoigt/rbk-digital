// @vitest-environment happy-dom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import ProximasModulo from '../src/components/proximas/ProximasModulo';
import type {Previsao} from '../src/lib/proximas/domain';
import type {ProximasRepository} from '../src/lib/proximas/repository';
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
let host:HTMLDivElement,root:Root;
const row:Previsao={id:'previsao-a',produto:'Losartana 50 mg',ean:null,unidade:'comprimido',ultima_data:'2026-09-06',proxima_data:'2026-09-27',origem:'intervalo_confirmado',intervalo_dias:21,referencia:'Receita conferida',motivo:'Confirmado',status:'a_avisar',ativa:true,versao:1,avisado_em:null,avisado_por_nome:null,nome:'Maria Teste',telefone:'11999998888',contato_versao:1,cpf_mascarado:'***.222.333-**'};
function repo(gestor=false):ProximasRepository{return {contexto:async()=>({gestor,pode_editar:!gestor,farmacias:[{id:'farm-a',nome:'Farmácia Alfa',cnpj:'11111111000111'}]}),listar:vi.fn(async()=>({linhas:[row],total:1,pagina:0,hoje:'2026-09-26',resumo:{hoje:0,dias2:1,dias7:1,dias30:1,nao_calculado:0,atrasados:0}})),salvar:vi.fn(async()=>{}),historico:async()=>[],demanda:async()=>({produtos:[],nao_calculadas:0})};}
beforeEach(()=>{host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const button=(s:string)=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent===s)!;
async function mount(r:ProximasRepository){await act(async()=>{root.render(<ProximasModulo repository={r}/>);});}
it('gestor deve selecionar CNPJ antes de qualquer consulta',async()=>{
 const r=repo(true);await mount(r);expect(host.textContent).toContain('Selecione uma farmácia/CNPJ');expect(r.listar).not.toHaveBeenCalled();
 const sel=host.querySelector('select')!;await act(async()=>{sel.value='farm-a';sel.dispatchEvent(new Event('change',{bubbles:true}));});
 expect(host.textContent).toContain('Losartana');expect(button('Avisar pelo WhatsApp')).toBeUndefined();
});
it('WhatsApp permite editar mensagem e só confirmação explícita registra aviso',async()=>{
 const r=repo();await mount(r);await act(async()=>button('Avisar pelo WhatsApp').click());
 const dialog=host.querySelector('[role=dialog]')!;expect(dialog.textContent).toContain('Maria');
 const link=dialog.querySelector('a')!;expect(link.href).toContain('https://wa.me/5511999998888');expect(r.salvar).not.toHaveBeenCalled();
 await act(async()=>button('Marcar aviso como enviado').click());
 expect(r.salvar).toHaveBeenCalledWith('farm-a','previsao-a',1,{acao:'status',status:'avisado',contato_versao:1});
});
it('exibe CPF somente mascarado e oferece completar dados e histórico',async()=>{
 await mount(repo());expect(host.textContent).toContain('***.222.333-**');expect(host.textContent).not.toContain('11122233344');
 await act(async()=>button('Editar previsão e contato').click());
 expect(host.querySelector('[role=dialog]')?.textContent).toContain('Referência ou justificativa');
});
it('exibe alerta D-2 e preserva a regra ao editar apenas contato',async()=>{
 const r=repo();r.listar=vi.fn(async()=>({linhas:[{...row,origem:'regra_pfpb',alerta_data:'2026-09-25',regra_id:'regra-1',regra_snapshot:{versao:1,periodicidade_dias:25,fonte:'https://www.gov.br/saude',data_vigencia:'2026-09-01'}}],total:1,pagina:0,hoje:'2026-09-26',resumo:{hoje:0,dias2:1,dias7:1,dias30:1,nao_calculado:0,atrasados:0,alertas:1}}));
 await mount(r);expect(host.textContent).toContain('Alerta: 25/09/2026');expect(host.textContent).toContain('Regra oficial PFPB');
 await act(async()=>button('Editar previsão e contato').click());
 expect(host.querySelector<HTMLSelectElement>('[role=dialog] select')?.value).toBe('manter');
 await act(async()=>host.querySelector('[role=dialog] form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(r.salvar).toHaveBeenCalledWith('farm-a','previsao-a',1,expect.objectContaining({modo:'manter'}));
});

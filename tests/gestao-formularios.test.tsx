// @vitest-environment happy-dom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import ClienteForm from '../src/components/gestao/ClienteForm';
import ContratoForm from '../src/components/gestao/ContratoForm';
import ContratoDetalhe from '../src/components/gestao/ContratoDetalhe';
import CRM from '../src/components/gestao/CRM';
import {gestao} from '../src/lib/gestao/client';
vi.mock('../src/lib/gestao/client',async importOriginal=>({...await importOriginal<object>(),gestao:vi.fn()}));
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
let root:Root,host:HTMLDivElement;
const ctx={actor_id:'actor',responsaveis:[{id:'actor',nome:'Gestor'}]};
const client={id:'c1',razao_social:'Farmácia Alfa',cnpj:'11222333000181',responsavel_id:'actor',interesses:['Auditoria'],status:'Interessado',updated_at:'2026-09-28T00:00:00Z'};
const saved=vi.fn();
const settle=async()=>act(async()=>{await new Promise(r=>setTimeout(r,10));});
const fill=(name:string,value:string)=>{(host.querySelector(`[name="${name}"]`) as HTMLInputElement).value=value;};
async function submit(){await act(async()=>{host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});await settle();}
async function click(text:string){await act(async()=>{[...host.querySelectorAll('button')].find(b=>b.textContent===text)!.click();});await settle();}
beforeEach(()=>{host=document.createElement('div');document.body.append(host);root=createRoot(host);vi.mocked(gestao).mockReset();saved.mockReset();});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
it('CRM grava todos os campos, categorias e flag; mantém conteúdo se o banco rejeitar',async()=>{
 vi.mocked(gestao).mockRejectedValueOnce(new Error('CNPJ já cadastrado')).mockResolvedValue(client);
 await act(async()=>root.render(<ClienteForm cliente={null} ctx={ctx} onSaved={saved} onCancel={()=>{}}/>));
 fill('razao_social','Farmácia Alfa');fill('cnpj','11.222.333/0001-81');fill('proxima_acao','Retornar proposta');fill('cidade','São Paulo');
 (host.querySelector('[name="aguardando_credenciamento"]')as HTMLInputElement).checked=true;
 (host.querySelector('[name="interesses"][value="Auditoria"]')as HTMLInputElement).checked=true;
 await submit();expect(host.textContent).toContain('CNPJ já cadastrado');expect(saved).not.toHaveBeenCalled();expect((host.querySelector('[name="razao_social"]')as HTMLInputElement).value).toBe('Farmácia Alfa');
 await submit();expect(saved).toHaveBeenCalledWith(client);expect(gestao).toHaveBeenLastCalledWith('cliente_salvar',expect.objectContaining({interesses:['Auditoria'],aguardando_credenciamento:true,proxima_acao:'Retornar proposta',responsavel_id:'actor'}));
});
it('filtros de CRM chegam à consulta e conversão preserva identidade',async()=>{
 vi.mocked(gestao).mockResolvedValue({items:[client],total:1});
 await act(async()=>root.render(<CRM ctx={ctx}/>));await settle();
 fill('status','Interessado');fill('interesse','Auditoria');fill('cidade','São Paulo');fill('uf','SP');await submit();
 expect(gestao).toHaveBeenLastCalledWith('clientes',expect.objectContaining({status:'Interessado',interesse:'Auditoria',cidade:'São Paulo',uf:'SP'}));
 await click('Converter em cliente');expect(gestao).toHaveBeenCalledWith('cliente_salvar',expect.objectContaining({id:'c1',cnpj:'11222333000181',status:'Cliente'}));
});
it('formulário de contrato envia valor numérico e vínculo ao cadastro existente',async()=>{
 vi.mocked(gestao).mockImplementation(async(action)=>action==='clientes'?{items:[client],total:1}:action==='cliente'?client:{id:'k1'} as never);
 await act(async()=>root.render(<ContratoForm contrato={null} clienteInicial="c1" onSaved={saved} onCancel={()=>{}}/>));await settle();fill('valor','199.90');
 await submit();expect(gestao).toHaveBeenCalledWith('contrato_salvar',expect.objectContaining({cliente_id:'c1',valor:199.9,servico:'Auditoria'}));expect(saved).toHaveBeenCalled();
});
it('trocar cobrança limpa valor e notas e pagamento mantém chave para repetição segura',async()=>{
 const detail={contrato:{id:'k1',servico:'RBK Digital',valor:100},cobrancas:[{id:'i1',competencia:'2026-08-01',vencimento:'2026-08-10',valor:100,pago:0,saldo:100,status:'atrasado'},{id:'i2',competencia:'2026-09-01',vencimento:'2026-09-10',valor:80,pago:0,saldo:80,status:'atrasado'}],pagamentos:[]};
 vi.mocked(gestao).mockImplementation(async action=>{if(action==='pagamento')throw new Error('Falha de conexão');return detail as never;});
 await act(async()=>root.render(<ContratoDetalhe id="k1" onClose={()=>{}} onPaid={()=>{}}/>));await settle();await click('Registrar pagamento');fill('valor','20');fill('observacoes','Parcela antiga');
 await act(async()=>{[...host.querySelectorAll('button')].filter(b=>b.textContent==='Registrar pagamento')[1].click();});await settle();
 expect((host.querySelector('[name="valor"]')as HTMLInputElement).value).toBe('80');expect((host.querySelector('[name="observacoes"]')as HTMLInputElement).value).toBe('');
 await submit();await submit();const calls=vi.mocked(gestao).mock.calls.filter(x=>x[0]==='pagamento');expect(calls[0][1]?.idempotency_key).toBe(calls[1][1]?.idempotency_key);expect(calls[0][1]?.cobranca_id).toBe('i2');
});

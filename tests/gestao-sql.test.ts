import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,it,expect} from 'vitest';
const root='10000000-0000-4000-8000-000000000001',mgr='10000000-0000-4000-8000-000000000002',other='10000000-0000-4000-8000-000000000003',pharm='10000000-0000-4000-8000-000000000004';
const farm='20000000-0000-4000-8000-000000000001',farm2='20000000-0000-4000-8000-000000000002';
let db:PGlite;
async function login(id:string){await db.exec(`reset role;select set_config('app.uid','${id}',false);set role authenticated;`);}
async function rpc(action:string,data:Record<string,unknown>={}){const r=await db.query<{result:any}>('select public.gestao_rbk($1,$2::jsonb) result',[action,JSON.stringify(data)]);return r.rows[0].result;}
beforeAll(async()=>{db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema rbk_private;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('app.uid',true),'')::uuid$$;
create table public.users(id uuid primary key,nome text,perfil text,status text);create table public.rbk_admins(user_id uuid,ativo boolean);create table public.farms(id uuid primary key,cnpj text,razao_social text,nome_fantasia text,status text);create table public.rbk_manager_farms(manager_user_id uuid,farm_id uuid);
create function rbk_private.actor_role() returns text language sql security definer set search_path='' as $$select case when exists(select 1 from public.rbk_admins where user_id=auth.uid() and ativo) then 'superadmin_rbk' else perfil end from public.users where id=auth.uid() and status='active'$$;
grant usage on schema auth,rbk_private to authenticated;
insert into public.users values('${root}','Root','rbk_admin','active'),('${mgr}','Gestor','gestor_rbk','active'),('${other}','Outro','gestor_rbk','active'),('${pharm}','Farmácia','farmacia','active');
insert into rbk_admins values('${root}',true);insert into farms values('${farm}','11.222.333/0001-81','Farmácia A','A','active'),('${farm2}','11444777000161','Farmácia B','B','active');insert into rbk_manager_farms values('${mgr}','${farm}');`);
await db.exec(readFileSync('supabase/gestao-rbk.sql','utf8'));},30000);
afterAll(async()=>{await db?.close();});
it('CRM: reutiliza farmácia, filtra e edita sem duplicar CNPJ ou permitir troca de identidade',async()=>{
 await login(mgr);let c=await rpc('cliente_salvar',{razao_social:'Farmácia A',cnpj:'11.222.333/0001-81',status:'Novo lead',interesses:['Credenciamento'],uf:'SP',cidade:'São Paulo',aguardando_credenciamento:true});
 expect(c.farm_id).toBe(farm);expect(c.cnpj).toBe('11222333000181');
 await expect(rpc('cliente_salvar',{razao_social:'Duplicado',cnpj:c.cnpj})).rejects.toThrow(/CNPJ/);
 const listado=await rpc('clientes',{interesse:'Credenciamento',uf:'SP',cidade:'São',responsavel_id:mgr,aguardando:true});expect(listado.total).toBe(1);
 c=await rpc('cliente_salvar',{...c,status:'Cliente'});expect(c.status).toBe('Cliente');
 await expect(rpc('cliente_salvar',{...c,cnpj:'11444777000161'})).rejects.toThrow();
 await expect(rpc('cliente_salvar',{...c,updated_at:'2000-01-01T00:00:00Z'})).rejects.toThrow(/alterado/);
});
it('isola gestores e bloqueia farmácia, anônimo e acesso direto às tabelas',async()=>{
 await login(other);expect((await rpc('clientes')).total).toBe(0);await expect(rpc('cliente_salvar',{razao_social:'B',cnpj:'11444777000161'})).rejects.toThrow(/carteira/);
 await expect(db.query('select * from rbk_crm_clientes')).rejects.toThrow();
 await login(pharm);await expect(rpc('clientes')).rejects.toThrow(/Acesso/);await expect(rpc('financeiro')).rejects.toThrow(/Acesso/);
 await db.exec('reset role;set role anon');await expect(rpc('clientes')).rejects.toThrow();
});
it('Financeiro: recorrência idempotente, fim do mês, pagamento parcial e saldo sem duplicação',async()=>{
 await login(root);const c=(await rpc('clientes')).items[0];
 const today=new Date().toISOString().slice(0,10),month=today.slice(0,7)+'-01';
 const k=await rpc('contrato_salvar',{cliente_id:c.id,servico:'RBK Digital',valor:100,plano:'Essencial',forma_pagamento:'Pix',data_contratacao:'2024-01-01',data_inicio:'2024-01-01',vencimento:'2024-01-31',dia_vencimento:31,status:'ativo'});
 await rpc('sincronizar');let d=await rpc('contrato',{id:k.id});const count=d.cobrancas.length;expect(count).toBeGreaterThan(2);
 expect(d.cobrancas.find((x:any)=>x.competencia==='2024-02-01').vencimento).toBe('2024-02-29');
 await rpc('sincronizar');d=await rpc('contrato',{id:k.id});expect(d.cobrancas).toHaveLength(count);
 const invoice=d.cobrancas[0],key='30000000-0000-4000-8000-000000000001';
 await rpc('pagamento',{cobranca_id:invoice.id,valor:40,data_pagamento:today,forma_pagamento:'Pix',idempotency_key:key});
 await rpc('pagamento',{cobranca_id:invoice.id,valor:40,data_pagamento:today,forma_pagamento:'Pix',idempotency_key:key});
 d=await rpc('contrato',{id:k.id});expect(d.pagamentos).toHaveLength(1);expect(d.cobrancas[0].saldo).toBe(60);
 await expect(rpc('pagamento',{cobranca_id:invoice.id,valor:61,data_pagamento:today,forma_pagamento:'Pix',idempotency_key:crypto.randomUUID()})).rejects.toThrow(/saldo/);
 await rpc('pagamento',{cobranca_id:invoice.id,valor:60,data_pagamento:today,forma_pagamento:'Pix',idempotency_key:crypto.randomUUID()});
 d=await rpc('contrato',{id:k.id});expect(d.cobrancas[0].status).toBe('pago');
 const report=await rpc('financeiro');expect(report.indicadores.mrr).toBe(100);expect(report.indicadores.recebido_mes).toBe(100);expect(report.indicadores.assinaturas_ativas).toBe(1);
 const updated=await rpc('contrato_salvar',{...d.contrato,valor:120});d=await rpc('contrato',{id:k.id});expect(d.cobrancas[0].valor).toBe(100);
 await rpc('contrato_salvar',{...updated,status:'cancelado'});expect((await rpc('financeiro')).indicadores.mrr).toBe(0);
 expect((await rpc('contrato',{id:k.id})).pagamentos).toHaveLength(2);
 expect(month).toMatch(/^\d{4}-\d{2}-01$/);
});
it('rascunho segmentado não envia mensagens, e lead sem CNPJ pertence ao responsável',async()=>{
 await login(mgr);const c=await rpc('cliente_salvar',{razao_social:'Lead sem CNPJ',status:'Aguardando oportunidade',interesses:['Notícias/Comunicados PFPB']});expect(c.cnpj).toBeNull();
 const draft=await rpc('comunicado_salvar',{titulo:'Novas oportunidades',texto:'Informação para revisar',canal:'WhatsApp',segmento:{status:'Aguardando oportunidade'}});expect(draft.status).toBe('rascunho');
 await login(other);expect((await rpc('comunicados')).length).toBe(0);
 await expect(rpc('cliente_salvar',{...c,status:'Cliente'})).rejects.toThrow();
});
it('rejeita desvincular farmácia se CNPJ original mudar e mantém cancelados inadimplentes no filtro',async()=>{
 await login(root);const c=(await rpc('clientes',{busca:'Farmácia A'})).items[0];
 await db.exec(`reset role;update farms set cnpj='00999999000199' where id='${farm}'`);
 await login(root);const {farm_id,...payload}=c;await expect(rpc('cliente_salvar',{...payload,contato:'Alteração'})).rejects.toThrow(/vínculo/);
 await db.exec(`reset role;update farms set cnpj='11.222.333/0001-81' where id='${farm}'`);await login(root);
 const overdue=await rpc('financeiro',{status:'atrasado'});expect(overdue.items.some((k:any)=>k.status==='cancelado')).toBe(true);
});
it('assinaturas futuras fora de MRR e suspensões não geram cobranças retroativas',async()=>{
 await login(root);const c=(await rpc('clientes',{busca:'Farmácia A'})).items[0];
 const today=new Date(),year=today.getUTCFullYear(),month=today.getUTCMonth()+1;
 const future=await rpc('contrato_salvar',{cliente_id:c.id,servico:'RBK Digital',valor:70,plano:'Futuro',forma_pagamento:'Pix',data_contratacao:'2024-01-01',data_inicio:`${year+1}-01-01`,vencimento:`${year+1}-01-15`,dia_vencimento:15,status:'ativo'});
 expect((await rpc('financeiro')).indicadores.mrr).toBe(0);expect((await rpc('contrato',{id:future.id})).cobrancas).toHaveLength(1);
 let k=await rpc('contrato_salvar',{cliente_id:c.id,servico:'RBK Digital',valor:70,plano:'Suspenso',forma_pagamento:'Pix',data_contratacao:'2024-01-01',data_inicio:'2024-01-01',vencimento:'2024-01-15',dia_vencimento:15,status:'suspenso'});
 expect((await rpc('contrato',{id:k.id})).cobrancas).toHaveLength(0);
 k=await rpc('contrato_salvar',{...k,status:'ativo'});const d=await rpc('contrato',{id:k.id});expect(d.cobrancas).toHaveLength(1);expect(d.cobrancas[0].competencia).toBe(`${year}-${String(month).padStart(2,'0')}-01`);
 await rpc('pagamento',{cobranca_id:d.cobrancas[0].id,valor:70,forma_pagamento:'Pix',data_pagamento:new Date().toISOString().slice(0,10),idempotency_key:crypto.randomUUID()});
 const listed=(await rpc('financeiro')).items.find((x:any)=>x.id===k.id);expect(listed.proxima_cobranca).not.toBeNull();expect(listed.pagamento_status).toBe('pago');
});

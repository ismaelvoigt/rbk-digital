import {it,expect} from 'vitest';
import {createClient} from '@supabase/supabase-js';
it.skipIf(process.env.RBK_PROXIMAS_LIVE_TEST!=='1')('produção: regras específicas, contato, compras e isolamento entre CNPJs',async()=>{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL!,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
 const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 const root=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY!,opts),clients=[createClient(url,key,opts),createClient(url,key,opts)];
 const ids:string[]=[],farms:string[]=[],auths:string[]=[],docs:string[]=[];const stamp=Date.now(),password=`Rbk!${crypto.randomUUID()}`;
 try{
  for(let n=0;n<2;n++){
   const f=await root.from('farms').insert({razao_social:`Teste Periodicidades ${stamp} ${n}`,nome_fantasia:`Teste Periodicidades ${n}`,cnpj:`97${String(stamp).slice(-11)}${n}`,status:'active'}).select('id').single();expect(f.error).toBeNull();farms.push(f.data!.id);
   const email=`rbk-periodos-${stamp}-${n}@example.invalid`;
   const u=await root.auth.admin.createUser({email,password,email_confirm:true});expect(u.error).toBeNull();ids.push(u.data.user!.id);
   expect((await root.from('users').insert({id:ids[n],farm_id:farms[n],nome:'Administrador teste',email,perfil:'farmacia',status:'active'})).error).toBeNull();
   expect((await clients[n].auth.signInWithPassword({email,password})).error).toBeNull();
   const a=await clients[n].from('autorizacoes').insert({user_id:ids[n],numero_autorizacao:`97${stamp}${n}`,data_autorizacao:'2026-09-27',cpf_cliente:'00000000000',farmacia:'Teste Periodicidades'}).select('id').single();expect(a.error).toBeNull();auths.push(a.data!.id);
   const d=await clients[n].from('documentos').insert({autorizacao_id:auths[n],categoria:'cupom_fiscal',nome_arquivo:'periodicidades-teste.pdf',caminho_arquivo:`${ids[n]}/${auths[n]}/teste.pdf`,status:'recebido'}).select('id').single();expect(d.error).toBeNull();docs.push(d.data!.id);
  }
  const eans=['fralda','7896006234050','7896112126478','absorvente','7896006234005','7894916502900'];const intervals=[10,25,30,56,80,90];
  for(let n=0;n<eans.length;n++){
   const catalog=await root.from('pfpb_produtos_periodicidade').select('*').eq('ativo',true).eq(['fralda','absorvente'].includes(eans[n])?'tipo_item':'ean',eans[n]).limit(1).single();expect(catalog.error).toBeNull();const p=catalog.data!;
   const fields={autorizacao_id:auths[0],documento_id:docs[0],posicao:n+1,produto:p.produto,ean:p.ean,unidade:'unidade',quantidade:1,data_dispensacao:'2026-09-27',status:'confirmado'};
   expect((await root.from('dispensacao_itens').insert({...fields,origens:Object.fromEntries(Object.keys(fields).map(k=>[k,'Teste isolado']))})).error).toBeNull();
  }
  const unknown={autorizacao_id:auths[1],documento_id:docs[1],posicao:1,produto:'Produto não identificado',ean:'7891234567895',unidade:'unidade',data_dispensacao:'2026-09-27',status:'confirmado'};
  expect((await root.from('dispensacao_itens').insert({...unknown,origens:Object.fromEntries(Object.keys(unknown).map(k=>[k,'Teste isolado']))})).error).toBeNull();
  const list=await clients[0].rpc('proximas_listar',{p_farm:farms[0],p_filtro:'historico'});expect(list.error).toBeNull();expect(list.data.linhas).toHaveLength(6);
  expect(list.data.linhas.map((x:{intervalo_dias:number})=>x.intervalo_dias).sort((a:number,b:number)=>a-b)).toEqual(intervals);
  for(const p of list.data.linhas){expect(p.origem).toBe('regra_pfpb');expect(Date.parse(p.proxima_data)-Date.parse(p.alerta_data)).toBe(2*86400000);expect(p.regra_snapshot.periodicidade_dias).toBe(p.intervalo_dias);}
  expect((await clients[1].rpc('proximas_listar',{p_farm:farms[0]})).error).not.toBeNull();
  const other=await clients[1].rpc('proximas_listar',{p_farm:farms[1],p_filtro:'nao_calculado'});expect(other.error).toBeNull();expect(other.data.linhas).toHaveLength(1);expect(other.data.linhas[0].proxima_data).toBeNull();
  const p=list.data.linhas[0];expect((await clients[0].rpc('proximas_salvar',{p_farm:farms[0],p_id:p.id,p_versao:p.versao,p_dados:{acao:'previsao',modo:'manter',nome:'Contato Teste',telefone:'11999998888',contato_versao:p.contato_versao}})).error).toBeNull();
  expect((await clients[1].rpc('proximas_salvar',{p_farm:farms[0],p_id:p.id,p_versao:p.versao,p_dados:{acao:'status',status:'retirado'}})).error).not.toBeNull();
  const demand=await clients[0].rpc('proximas_demanda',{p_farm:farms[0],p_inicio:'2026-09-27',p_fim:'2026-12-31'});expect(demand.error).toBeNull();expect(demand.data.produtos).toHaveLength(6);
  expect((await clients[1].rpc('proximas_demanda',{p_farm:farms[0],p_inicio:'2026-09-27',p_fim:'2026-12-31'})).error).not.toBeNull();
  expect((await clients[0].from('pfpb_periodicidades').select('id')).error).not.toBeNull();
  expect((await clients[0].from('proximas_previsoes').select('id')).error).not.toBeNull();
 }finally{
  for(const c of clients)await c.auth.signOut().catch(()=>{});
  if(docs.length)expect((await root.from('documentos').delete().in('id',docs)).error).toBeNull();
  if(auths.length)expect((await root.from('autorizacoes').delete().in('id',auths)).error).toBeNull();
  if(farms.length)expect((await root.from('audit_logs').delete().in('farm_id',farms)).error).toBeNull();
  if(ids.length)expect((await root.from('users').delete().in('id',ids)).error).toBeNull();
  for(const id of ids)expect((await root.auth.admin.deleteUser(id)).error).toBeNull();
  if(farms.length)expect((await root.from('farms').delete().in('id',farms)).error).toBeNull();
 }
},120000);

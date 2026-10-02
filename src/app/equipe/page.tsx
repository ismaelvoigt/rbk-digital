'use client';
import Link from 'next/link';
import {useCallback,useEffect,useState,type FormEvent} from 'react';
import {createClient} from '../../lib/supabase/client';
import {RbkBrand} from '../../components/RbkBrand';
import {perfisEquipe,type FuncionarioInput} from '../../lib/equipe/convite';
type Usuario=FuncionarioInput&{id:string;aceito:boolean;convite_enviado_em:string|null};
type Audit={id:string;user_id:string|null;action:string;entity_type:string;entity_id:string;metadata:Record<string,string>;created_at:string};
const novo:FuncionarioInput={nome:'',email:'',perfil:'operador',status:'active'};
export default function EquipePage(){
 const [client]=useState(()=>createClient());
 const [usuarios,setUsuarios]=useState<Usuario[]>([]),[auditoria,setAuditoria]=useState<Audit[]>([]);
 const [actor,setActor]=useState(''),[farmacia,setFarmacia]=useState('');
 const [form,setForm]=useState<FuncionarioInput>(novo),[editando,setEditando]=useState<string|null>(null);
 const [erro,setErro]=useState(''),[mensagem,setMensagem]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const api=useCallback(async(method:string,body?:unknown)=>{
  const {data:{session}}=await client.auth.getSession();
  if(!session)throw Error('Sessão expirada. Faça login novamente.');
  const response=await fetch('/api/equipe',{method,headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Não foi possível concluir a operação.');return data;
 },[client]);
 const carregar=useCallback(async()=>{const data=await api('GET');setUsuarios(data.usuarios);setAuditoria(data.auditoria);setActor(data.actorId);setFarmacia(`${data.farmacia.nome} · ${data.farmacia.cnpj}`);},[api]);
 useEffect(()=>{let active=true;api('GET').then(data=>{if(!active)return;setUsuarios(data.usuarios);setAuditoria(data.auditoria);setActor(data.actorId);setFarmacia(`${data.farmacia.nome} · ${data.farmacia.cnpj}`);}).catch(e=>{if(active)setErro(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[api]);
 async function salvar(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setErro('');setMensagem('');
  try{await api(editando?'PATCH':'POST',{...form,id:editando});setMensagem(editando?'Funcionário atualizado.':'Convite enviado para o e-mail do funcionário.');setForm(novo);setEditando(null);}catch(e){setErro(e instanceof Error?e.message:'Falha ao salvar.');}
  finally{await carregar().catch(()=>{});setBusy(false);}
 }
 async function reenviar(id:string){if(busy)return;setBusy(true);setErro('');setMensagem('');try{await api('POST',{id,reenviar:true});setMensagem('Convite reenviado.');await carregar();}catch(e){setErro(e instanceof Error?e.message:'Falha ao reenviar.');}finally{setBusy(false);}}
 const label=(p:string)=>p==='farmacia'?perfisEquipe.administrador_farmacia:perfisEquipe[p as keyof typeof perfisEquipe]||p;
 return <main className="rbk-shell min-h-screen"><header className="rbk-header"><div className="rbk-container flex min-h-[76px] items-center justify-between gap-5"><RbkBrand compact light /><Link href="/farmacia" className="text-sm font-bold text-red-600">← Voltar ao Dashboard</Link></div></header>
 <div className="rbk-container py-8 sm:py-10"><p className="text-sm font-bold uppercase tracking-[.16em] text-red-600">Área da farmácia</p><h1 className="mt-2 text-3xl font-bold text-gray-900">Equipe</h1><p className="mt-2 text-sm text-gray-500">{farmacia||'Gerencie os acessos individuais da sua farmácia.'}</p>
 {erro&&<p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{erro}</p>}{mensagem&&<p role="status" className="mt-5 rounded-xl bg-green-50 p-4 text-sm text-green-800">{mensagem}</p>}
 {loading?<p className="mt-8">Carregando equipe...</p>:actor&&<>
 <section className="rbk-card mt-7 p-5 sm:p-6"><h2 className="text-lg font-bold">{editando?'Editar funcionário':'Adicionar funcionário'}</h2><p className="mt-2 text-sm text-gray-500">Cada pessoa recebe um convite para criar a própria senha. Desativar um acesso preserva o histórico.</p>
 <form onSubmit={salvar} className="mt-5 grid gap-4 sm:grid-cols-2">
 <label className="text-sm font-semibold">Nome<input className="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal" required minLength={2} maxLength={150} value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})}/></label>
 <label className="text-sm font-semibold">E-mail<input type="email" className="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal disabled:bg-gray-50" required disabled={!!editando} maxLength={254} value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
 <label className="text-sm font-semibold">Perfil<select className="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal" disabled={editando===actor} value={form.perfil} onChange={e=>setForm({...form,perfil:e.target.value as FuncionarioInput['perfil']})}>{Object.entries(perfisEquipe).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
 <label className="text-sm font-semibold">Status<select className="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal" disabled={editando===actor} value={form.status} onChange={e=>setForm({...form,status:e.target.value as FuncionarioInput['status']})}><option value="active">Ativo</option><option value="inactive">Inativo</option></select></label>
 <p className="text-sm leading-6 text-gray-500 sm:col-span-2">{form.perfil==='operador'?'Atendente: autorizações, pendências e documentos.':form.perfil==='gerente_farmacia'?'Gerente/Supervisor: operação e Administração, sem gestão da equipe.':'Administrador: acesso completo à farmácia, incluindo Equipe e Administração.'}</p>
 <div className="flex gap-3 sm:col-span-2"><button disabled={busy} className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy?'Aguarde...':editando?'Salvar alterações':'Enviar convite'}</button>{editando&&<button type="button" disabled={busy} onClick={()=>{setForm(novo);setEditando(null);}} className="rounded-xl border px-5 py-3 text-sm font-bold">Cancelar</button>}</div>
 </form></section>
 <section className="rbk-card mt-6 overflow-x-auto p-5"><h2 className="mb-4 text-lg font-bold">Funcionários</h2><table className="w-full text-left text-sm"><thead><tr className="border-b text-gray-500">{['Nome / E-mail','Perfil','Status','Convite','Ações'].map(x=><th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>{usuarios.map(u=><tr key={u.id} className="border-b last:border-0"><td className="p-3"><p className="font-semibold">{u.nome}{u.id===actor?' (você)':''}</p><p className="text-gray-500">{u.email}</p></td><td className="p-3">{label(u.perfil)}</td><td className="p-3">{u.status==='active'?'Ativo':'Inativo'}</td><td className="p-3">{u.aceito?'Acesso realizado':u.convite_enviado_em?'Aguardando primeiro acesso':'Aguardando envio'}</td><td className="p-3"><button disabled={busy} className="mr-4 font-bold text-red-600" onClick={()=>{setEditando(u.id);setForm({...u,perfil:u.perfil as string==='farmacia'?'administrador_farmacia':u.perfil});setMensagem('');}}>Editar</button>{!u.aceito&&u.id!==actor&&<button disabled={busy} className="font-bold text-gray-700" onClick={()=>reenviar(u.id)}>Reenviar convite</button>}</td></tr>)}</tbody></table></section>
 <section className="rbk-card mt-6 p-5"><h2 className="text-lg font-bold">Atividades recentes</h2><p className="mt-1 text-sm text-gray-500">Últimas 50 ações da farmácia, com responsável e data/hora.</p><ul className="mt-4 divide-y">{auditoria.map(a=><li key={a.id} className="py-3 text-sm"><span className="font-semibold">{usuarios.find(u=>u.id===a.user_id)?.nome||a.metadata?.ator_nome||'Sistema'}</span> · {({insert:'Criou',update:'Alterou',delete:'Excluiu',invite:'Convidou'} as Record<string,string>)[a.action]||a.action} {({usuario:'usuário',autorizacao:'autorização',documento:'documento'} as Record<string,string>)[a.entity_type]||a.entity_type}<span className="ml-2 text-gray-500">{new Date(a.created_at).toLocaleString('pt-BR')}</span><p className="mt-1 text-xs text-gray-400">Registro: {a.entity_id}</p></li>)}</ul>{!auditoria.length&&<p className="mt-4 text-sm text-gray-500">Nenhuma atividade registrada.</p>}</section>
 </>}
 </div></main>;
}

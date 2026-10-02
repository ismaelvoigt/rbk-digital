export type PerfilEquipe='administrador_farmacia'|'gerente_farmacia'|'operador';
export type FuncionarioInput={nome:string;email:string;perfil:PerfilEquipe;status:'active'|'inactive'};
export type ContextoEquipe={farmId:string;cnpj:string;nome:string;actorId:string};
export const perfisEquipe={administrador_farmacia:'Administrador da farmácia',gerente_farmacia:'Gerente/Supervisor',operador:'Atendente'};
export function validarFuncionario(value:unknown):FuncionarioInput {
 if(!value||typeof value!=='object')throw new Error('Preencha os dados do funcionário.');
 const v=value as Record<string,unknown>;
 const nome=typeof v.nome==='string'?v.nome.trim():'';
 const email=typeof v.email==='string'?v.email.trim().toLowerCase():'';
 if(nome.length<2||nome.length>150||email.length>254||!/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(email)||!Object.hasOwn(perfisEquipe,String(v.perfil))||!['active','inactive'].includes(String(v.status)))throw new Error('Confira nome, e-mail, perfil e status.');
 return {nome,email,perfil:v.perfil as PerfilEquipe,status:v.status as 'active'|'inactive'};
}
export async function convidarFuncionario(input:FuncionarioInput,context:ContextoEquipe,deps:{
 generate:(metadata:Record<string,string>)=>Promise<{id:string;hash:string}>;
 register:(id:string)=>Promise<void>;
 send:(link:string)=>Promise<void>;
 markSent:(id:string)=>Promise<void>;
}) {
 const invitation=await deps.generate({nome:input.nome,farmacia_id:context.farmId,cnpj:context.cnpj,perfil:input.perfil,tipo_convite:'funcionario'});
 await deps.register(invitation.id);
 const link=new URL('https://rbk-digital.vercel.app/primeiro-acesso');
 link.searchParams.set('type','invite');link.searchParams.set('token_hash',invitation.hash);
 await deps.send(link.toString());
 await deps.markSent(invitation.id);
}

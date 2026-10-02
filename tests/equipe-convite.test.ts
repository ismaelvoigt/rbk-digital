import {it,expect,vi} from 'vitest';
import {convidarFuncionario} from '../src/lib/equipe/convite';
it('vincula antes de enviar; contexto e destino são de funcionário',async()=>{
 const events:string[]=[];
 const deps={generate:vi.fn(async(_metadata:Record<string,string>)=>({id:'new',hash:'secret'})),register:vi.fn(async()=>{events.push('register');}),send:vi.fn(async(_link:string)=>{events.push('send');}),markSent:vi.fn(async()=>{})};
 await convidarFuncionario({nome:'Ana',email:'ana@example.invalid',perfil:'operador',status:'active'}, {farmId:'farm',cnpj:'123',nome:'Alfa',actorId:'admin'},deps);
 expect(events).toEqual(['register','send']);
 expect(deps.generate.mock.calls[0][0]).toMatchObject({tipo_convite:'funcionario',farmacia_id:'farm',perfil:'operador'});
 expect(deps.send.mock.calls[0][0]).toContain('/primeiro-acesso?type=invite&token_hash=secret');
});
it('não envia se o vínculo falha',async()=>{
 const send=vi.fn();
 await expect(convidarFuncionario({nome:'Ana',email:'a@b.co',perfil:'operador',status:'active'},{farmId:'f',cnpj:'123',nome:'A',actorId:'a'}, {generate:async()=>({id:'u',hash:'h'}),register:async()=>{throw Error('duplicate');},send,markSent:async()=>{}})).rejects.toThrow('duplicate');
 expect(send).not.toHaveBeenCalled();
});

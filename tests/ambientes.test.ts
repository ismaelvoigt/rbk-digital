import {describe,it,expect} from 'vitest';
import {publicOrigin,assertDevelopmentIsolation} from '../src/lib/config/ambiente';
const dev={NEXT_PUBLIC_RBK_ENV:'development',NEXT_PUBLIC_SUPABASE_URL:'https://ympeqcycjadvvumanmwm.supabase.co',RBK_PUBLIC_ORIGIN:'https://rbk-digital-testes.vercel.app'};
describe('ambientes separados',()=>{
 it('preserva origem legada quando ambiente não foi alterado',()=>expect(publicOrigin({})).toBe('https://rbk-digital.vercel.app'));
 it('utiliza origem explícita de testes',()=>expect(publicOrigin(dev)).toBe(dev.RBK_PUBLIC_ORIGIN));
 it('exige origem explícita em desenvolvimento',()=>expect(()=>publicOrigin({...dev,RBK_PUBLIC_ORIGIN:undefined})).toThrow());
 it('recusa domínio de produção em desenvolvimento',()=>expect(()=>publicOrigin({...dev,RBK_PUBLIC_ORIGIN:'https://rbk-digital.vercel.app'})).toThrow());
 it('recusa origem com caminho, credenciais ou protocolo inválido',()=>{for(const url of ['https://teste.invalid/path','https://user:password@teste.invalid','javascript:alert(1)'])expect(()=>publicOrigin({...dev,RBK_PUBLIC_ORIGIN:url})).toThrow();});
 it('recusa banco de produção no ambiente de desenvolvimento',()=>expect(()=>assertDevelopmentIsolation({...dev,NEXT_PUBLIC_SUPABASE_URL:'https://sqamrlckyuesfmibxizy.supabase.co'})).toThrow());
 it('aceita banco exclusivo de desenvolvimento',()=>expect(()=>assertDevelopmentIsolation(dev)).not.toThrow());
 it('exige marcador de desenvolvimento no projeto Vercel de testes',()=>expect(()=>assertDevelopmentIsolation({VERCEL_PROJECT_ID:'prj_RZi39iUZqcywEt1JGmmD7KvMrHlQ'})).toThrow());
 it('não altera configuração da aplicação legada',()=>expect(()=>assertDevelopmentIsolation({})).not.toThrow());
});

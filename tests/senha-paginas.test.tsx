// @vitest-environment happy-dom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import Primeiro from '../src/app/primeiro-acesso/page';
import Redefinir from '../src/app/redefinir-senha/page';
import Esqueci from '../src/app/esqueci-minha-senha/page';
import Login from '../src/app/page';
const m=vi.hoisted(()=>({auth:{verifyOtp:vi.fn(),getSession:vi.fn(),getUser:vi.fn(),getClaims:vi.fn(),updateUser:vi.fn(),signOut:vi.fn(),resetPasswordForEmail:vi.fn()}}));
vi.mock('@supabase/ssr',()=>({createBrowserClient:()=>({auth:m.auth})}));
vi.mock('../src/lib/supabase/client',()=>({createClient:()=>({auth:m.auth})}));
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
let root:Root,host:HTMLDivElement;
const user={id:'u'};const session={access_token:'a',refresh_token:'r',expires_at:Math.floor(Date.now()/1000)+3600,user};
beforeEach(()=>{vi.clearAllMocks();window.history.replaceState(null,'','/');host=document.createElement('div');document.body.append(host);root=createRoot(host);
 m.auth.verifyOtp.mockResolvedValue({data:{session},error:null});m.auth.getSession.mockResolvedValue({data:{session},error:null});m.auth.getUser.mockResolvedValue({data:{user},error:null});m.auth.updateUser.mockResolvedValue({data:{user},error:null});m.auth.signOut.mockResolvedValue({error:null});m.auth.resetPasswordForEmail.mockResolvedValue({data:{},error:null});
 m.auth.getClaims.mockResolvedValue({data:{claims:{amr:[{method:'otp'}],exp:session.expires_at}},error:null});
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
async function render(node:React.ReactNode){await act(async()=>root.render(node));}
async function input(selector:string,value:string){await act(async()=>{const el=host.querySelector(selector) as HTMLInputElement;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));});}
async function submit(){await act(async()=>host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));}
it('login oferece link separado sem envio embutido',async()=>{await render(<Login/>);expect(host.querySelector('a[href="/esqueci-minha-senha"]')?.textContent).toContain('Esqueci minha senha');});
it.each([Primeiro,Redefinir])('bloqueia formulário sem link mesmo com sessão válida',async Page=>{await render(<Page/>);expect(host.querySelector('input[type="password"]')).toBeNull();expect(host.textContent).toMatch(/inválido|expirou/);});
it('primeiro acesso tem título próprio, confirma senha e bloqueia duplo envio após sucesso',async()=>{
 window.history.replaceState(null,'','/primeiro-acesso?type=invite&token_hash=x');await render(<Primeiro/>);
 expect(host.querySelector('h1')?.textContent).toBe('Crie sua senha de acesso ao RBK Digital');expect(window.location.search).toBe('');
 await input('#novaSenha','senha123');await input('#confirmacao','outra123');await submit();expect(host.textContent).toContain('As senhas não conferem.');expect(m.auth.updateUser).not.toHaveBeenCalled();
 await input('#confirmacao','senha123');await submit();expect(host.textContent).toContain('Senha criada com sucesso');expect(m.auth.updateUser).toHaveBeenCalledWith({password:'senha123'});expect(m.auth.signOut).not.toHaveBeenCalled();expect(host.querySelector('button[type="submit"]')?.hasAttribute('disabled')).toBe(true);
});
it('recovery exibe tela própria, salva e encerra sessão',async()=>{
 window.history.replaceState(null,'','/redefinir-senha?type=recovery&token_hash=x');await render(<Redefinir/>);expect(host.querySelector('h1')?.textContent).toBe('Redefinir senha');
 await input('#novaSenha','senha123');await input('#confirmacao','senha123');await submit();expect(host.textContent).toContain('Senha alterada com sucesso');expect(m.auth.signOut).toHaveBeenCalled();
});
it('não altera outra conta se a sessão mudar em outra aba',async()=>{
 window.history.replaceState(null,'','/primeiro-acesso?type=invite&token_hash=x');await render(<Primeiro/>);m.auth.getSession.mockResolvedValue({data:{session:{...session,user:{id:'outra'},access_token:'outro'}},error:null});
 await input('#novaSenha','senha123');await input('#confirmacao','senha123');await submit();expect(m.auth.updateUser).not.toHaveBeenCalled();expect(host.querySelector('input[type="password"]')).toBeNull();
});
it('solicita recovery com e-mail normalizado e resposta sem enumerar contas',async()=>{await render(<Esqueci/>);await input('#email',' teste@example.com ');await submit();expect(m.auth.resetPasswordForEmail).toHaveBeenCalledWith('teste@example.com',{redirectTo:window.location.origin+'/redefinir-senha'});expect(host.textContent).toContain('Se houver uma conta');});
it('falha no envio fica acessível como alerta e permite tentar novamente',async()=>{m.auth.resetPasswordForEmail.mockResolvedValue({data:{},error:{status:429}});await render(<Esqueci/>);await input('#email','teste@example.com');await submit();expect(host.querySelector('[role="alert"]')?.textContent).toContain('Aguarde alguns minutos');expect(host.querySelector('button')?.disabled).toBe(false);});
it('falha ao salvar não mostra sucesso nem encerra sessão',async()=>{window.history.replaceState(null,'','/redefinir-senha?type=recovery&token_hash=x');m.auth.updateUser.mockResolvedValue({data:{user:null},error:{code:'same_password'}});await render(<Redefinir/>);await input('#novaSenha','senha123');await input('#confirmacao','senha123');await submit();expect(host.querySelector('[role="alert"]')?.textContent).toContain('diferente da anterior');expect(host.querySelector('[role="status"]')).toBeNull();expect(m.auth.signOut).not.toHaveBeenCalled();});

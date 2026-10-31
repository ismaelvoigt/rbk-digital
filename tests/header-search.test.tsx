// @vitest-environment happy-dom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import HeaderSearch from '../src/components/HeaderSearch';
import {RbkBrand} from '../src/components/RbkBrand';
import {filterSearchPages,normalizeSearchText} from '../src/lib/navigation/search';

const authState=vi.hoisted(()=>({perfil:'farmacia',admin:false,profileExists:true}));
vi.mock('../src/lib/supabase/client',()=>({createClient:()=>({
 auth:{getUser:async()=>({data:{user:{id:'user-1'}}})},
 from:(table:string)=>{
  const builder={select:()=>builder,eq:()=>builder,maybeSingle:async()=>({data:table==='users'?(authState.profileExists?{perfil:authState.perfil,status:'active'}:null):(authState.admin?{user_id:'user-1'}:null),error:null})};
  return builder;
 },
})}));

let host:HTMLDivElement,root:Root;
beforeEach(()=>{authState.perfil='farmacia';authState.admin=false;authState.profileExists=true;vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});

describe('catálogo de pesquisa de páginas',()=>{
 it('normaliza acentos e procura por múltiplos termos',()=>{
  expect(normalizeSearchText('Próximas Dispensações')).toBe('proximas dispensacoes');
  expect(filterSearchPages('proximas dispensacoes','gerente_farmacia').map(page=>page.href)).toEqual(['/proximas-dispensacoes']);
 });

 it('não oferece atalhos de gestão RBK a perfis de farmácia',()=>{
  const pages=filterSearchPages('', 'operador');
  expect(pages.some(page=>page.href==='/dashboard')).toBe(false);
  expect(pages.some(page=>page.href==='/financeiro')).toBe(false);
  expect(pages.some(page=>page.href==='/nova-autorizacao')).toBe(true);
  expect(filterSearchPages('','operador').some(page=>page.href==='/equipe')).toBe(false);
 });

 it('retorna vazio sem um perfil validado ou quando não há correspondência',()=>{
  expect(filterSearchPages('',null)).toEqual([]);
  expect(filterSearchPages('rota que nao existe','gestor_rbk')).toEqual([]);
 });
});

describe('pesquisa no cabeçalho',()=>{
 it('é incluída no cabeçalho da marca e pode ser desativada em páginas públicas',async()=>{
  await act(async()=>root.render(<header className="rbk-header"><div><RbkBrand compact light/></div></header>));
  expect(host.querySelector('.rbk-header-search input')).not.toBeNull();
  await act(async()=>root.render(<header className="rbk-topbar"><div><RbkBrand compact light search={false}/></div></header>));
  expect(host.querySelector('.rbk-header-search')).toBeNull();
 });

 it('abre com Ctrl+K, filtra páginas permitidas e navega pelo atalho de teclado',async()=>{
  await act(async()=>root.render(<HeaderSearch/>));
  const input=host.querySelector<HTMLInputElement>('input[type="search"]')!;
  await act(async()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true})));
  expect(document.activeElement).toBe(input);
  await act(async()=>{input.value='nova autorizacao';input.dispatchEvent(new Event('input',{bubbles:true}));});
  expect(host.textContent).toContain('Nova autorização');
  expect(host.querySelector<HTMLAnchorElement>('a[href="/nova-autorizacao"]')).not.toBeNull();
  expect(host.querySelector('a[href="/dashboard"]')).toBeNull();

  const click=vi.spyOn(HTMLAnchorElement.prototype,'click');
  await act(async()=>input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})));
  expect(click).toHaveBeenCalled();
  click.mockRestore();
 });

 it('fecha os resultados com Escape e oferece atalhos administrativos ao perfil gestor',async()=>{
  authState.perfil='gestor_rbk';
  await act(async()=>root.render(<HeaderSearch/>));
  const input=host.querySelector<HTMLInputElement>('input[type="search"]')!;
  await act(async()=>{input.focus();});
  expect(host.querySelector('a[href="/financeiro"]')).not.toBeNull();
  await act(async()=>input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
  expect(host.querySelector('[role="region"]')).toBeNull();
 });

 it('move a seleção com as setas e fecha o menu ao clicar fora',async()=>{
  await act(async()=>root.render(<HeaderSearch/>));
  const input=host.querySelector<HTMLInputElement>('input[type="search"]')!;
  await act(async()=>{input.focus();});
  await act(async()=>input.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true})));
  expect(input.getAttribute('aria-activedescendant')).toBe('rbk-page-search-result-1');
  expect(host.querySelector('#rbk-page-search-result-1')?.getAttribute('aria-selected')).toBe('true');
  await act(async()=>document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})));
  expect(host.querySelector('[role="region"]')).toBeNull();
 });

 it('reconhece superadministrador RBK pela permissão ativa mesmo sem perfil em users',async()=>{
  authState.admin=true;
  authState.profileExists=false;
  await act(async()=>root.render(<HeaderSearch/>));
  const input=host.querySelector<HTMLInputElement>('input[type="search"]')!;
  await act(async()=>{input.focus();});
  expect(host.querySelector('a[href="/usuarios/novo"]')).not.toBeNull();
 });
});
// @vitest-environment happy-dom
import React, {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import NovaFarmacia from '../src/app/usuarios/novo/page';
vi.mock('../src/lib/supabase/client', () => ({createClient: () => ({})}));
Object.assign(globalThis, {React, IS_REACT_ACT_ENVIRONMENT: true});
let root: Root, host: HTMLDivElement;
beforeEach(async () => {host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root.render(<NovaFarmacia/>));});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
async function enter(value: string) {
  const input=host.querySelector('#telefone') as HTMLInputElement;
  await act(async()=>{
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);
    input.dispatchEvent(new Event('input',{bubbles:true}));
  });
  return input;
}
it('limita a entrada longa a 11 dígitos e aplica a máscara', async()=>{
  const input=await enter('119999988887777');
  expect(input.value).toBe('(11) 99999-8888');
  expect(input.maxLength).toBe(15);
  expect(input.checkValidity()).toBe(true);
});
it('aceita fixo, recusa incompleto e permite apagar', async()=>{
  expect((await enter('1133334444')).value).toBe('(11) 3333-4444');
  expect((await enter('11333')).checkValidity()).toBe(false);
  expect((await enter('')).checkValidity()).toBe(true);
});

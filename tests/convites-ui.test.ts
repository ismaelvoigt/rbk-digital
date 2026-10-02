import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { spawnSync } from 'node:child_process';
import { expect, test } from 'vitest';
const html=readFileSync('src/lib/credenciamento/form.html','utf8');
const line=(prefix:string)=>html.split('\n').find(l=>l.startsWith(prefix))!;
test('credential invitation displays independent channel results without a duplicate WhatsApp action',()=>{
 const nodes: {textContent:string;href?:string}[]=[];
 runInNewContext(`${line('const deliveryLabels=')}\n${line('function showDelivery(')}\nshowDelivery(result);`,{
  URL,invite:{append:(n:{textContent:string})=>nodes.push(n)},
  el:(_tag:string,text:string)=>({textContent:text,setAttribute(){}}),
  result:{email:{status:'failed',recorded:false},whatsapp:{status:'manual',recorded:true,url:'https://wa.me/5511999991234?text=test'}},
 });
 expect(nodes.map(n=>n.textContent).join(' ')).toContain('Falha no envio');
 expect(nodes.map(n=>n.textContent).join(' ')).toContain('Não foi possível salvar');
 expect(nodes.map(n=>n.textContent).join(' ')).toContain('Envio manual pendente');
 expect(nodes).toHaveLength(2);
 expect(nodes.every(n=>!n.href)).toBe(true);
});
test('inline credential scripts remain syntactically valid',()=>{
 for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)){
  if(match[0].startsWith('<script type="application/json"'))continue;
  const checked=spawnSync(process.execPath,['--check','--input-type=module'],{input:match[1],encoding:'utf8'});
  expect(checked.stderr).toBe('');
  expect(checked.status).toBe(0);
 }
});

test('credenciamento ignora QR antigo e compartilha a imagem do convite atual com sua mensagem',async()=>{
 const {prepareInviteFile,shareInvite,shareNotices}=await import('../public/convite-share.mjs');
 const start=html.indexOf("window.addEventListener('message',async e=>");
 const end=html.indexOf('\nif(isManager){manager.classList',start);
 let receive:(event:unknown)=>Promise<void>=async()=>{};
 const nodes:any[]=[];let payload:ShareData|undefined;
 const parent={};const origin='https://rbk-digital.vercel.app';
 const context={parent,location:{origin},isManager:true,activeInvitation:{link:origin+'/portal/credenciamento#new',text:'Mensagem aprovada com link #new'},
  window:{addEventListener:(_name:string,fn:typeof receive)=>{receive=fn;}},
  invite:{classList:{contains:()=>false},append:(...items:any[])=>nodes.push(...items)},
  el:(_tag:string,text:string)=>({textContent:text,style:{},setAttribute(){}}),
  prepareInviteFile,shareNotices,shareInvite:(file:File,text:string)=>shareInvite(file,text,{canShare:()=>true,share:async data=>{payload=data;}})};
 runInNewContext(html.slice(start,end),context);
 const event=(link:string)=>({origin,source:parent,data:{type:'cre-image',link,image:'data:image/png;base64,iVBORw0KGgo='}});
 await receive(event(origin+'/portal/credenciamento#old'));expect(nodes).toHaveLength(0);
 await receive(event(context.activeInvitation.link));
 const button=nodes.find(n=>n.textContent==='Compartilhar QR Code e link');
 await button.onclick();
 expect(payload?.files?.[0].name).toBe('Convite-Credenciamento.png');
 expect(payload?.text).toBe(context.activeInvitation.text);
 expect(button.disabled).toBe(false);
});

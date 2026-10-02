import {expect,it} from 'vitest';
import {prepareInviteFile,shareInvite} from '../public/convite-share.mjs';
const image='data:image/png;base64,iVBORw0KGgo=';
const text='Convite: https://rbk-digital.vercel.app/portal/auditoria#'+'a'.repeat(43);
it('compartilha o PNG e a mensagem completa no mesmo pedido, sem aguardar geração no clique',async()=>{
 const file=prepareInviteFile(image,'Auditoria');let received:ShareData|undefined;
 const promise=shareInvite(file,text,{canShare:()=>true,share:async(data:ShareData)=>{received=data;}});
 expect(received?.text).toBe(text);expect(received?.files).toEqual([file]);
 expect(file.type).toBe('image/png');expect(await file.arrayBuffer()).toEqual(Uint8Array.from([137,80,78,71,13,10,26,10]).buffer);
 expect(await promise).toBe('shared');
});
it('oferece alternativa quando arquivos não são suportados e diferencia cancelamento de falha',async()=>{
 const file=prepareInviteFile(image,'Credenciamento');
 expect(await shareInvite(file,text,{})).toBe('unsupported');
 expect(await shareInvite(file,text,{canShare:()=>false})).toBe('unsupported');
 for(const [name,expected] of [['AbortError','cancelled'],['NotAllowedError','failed']]) {
 expect(await shareInvite(file,text,{canShare:()=>true,share:async()=>{throw new DOMException('blocked',name);}})).toBe(expected);
 }
});
it('recusa imagem remota ou formato diferente sem transmitir o convite',()=>{
 expect(()=>prepareInviteFile('https://example.org/qr','Auditoria')).toThrow();
 expect(()=>prepareInviteFile('data:text/html;base64,YQ==','Auditoria')).toThrow();
});

import {credentialMessage} from '../public/convite-message.mjs';
it('usa a mensagem aprovada com o nome da farmácia e o link completo',()=>{
 expect(credentialMessage('Farmácia Exemplo',text.split('Convite: ')[1])).toBe(`Seja bem-vindo, Farmácia Exemplo.\n\nA RBK Assessoria disponibilizou seu convite de Credenciamento do Farmácia Popular.\n\nAcesse: ${text.split('Convite: ')[1]}\n\nVocê pode enviar aos poucos e voltar pelo mesmo link.\n\nEquipe RBK Assessoria`);
});

import {openDesktopInvite} from '../public/convite-share.mjs';
it('no computador usa download e WhatsApp sem abrir o compartilhamento nativo',async()=>{
 const file=prepareInviteFile(image,'Credenciamento');let called=false;
 const result=await shareInvite(file,text,{userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X)',share:async()=>{throw Error('Não deve abrir');}},(received,message)=>{
  expect(received).toBe(file);expect(message).toBe(text);called=true;return 'desktop_ready';
 });
 expect(called).toBe(true);expect(result).toBe('desktop_ready');
});
it('preserva o compartilhamento nativo em Android, iPhone e iPad com identificação de Mac',async()=>{
 for(const device of [{userAgent:'Android'},{userAgent:'iPhone'},{userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:5}]){
  let shared=false;
  expect(await shareInvite(prepareInviteFile(image,'Auditoria'),text,{...device,canShare:()=>true,share:async()=>{shared=true;}},()=>{throw Error('Não deve baixar');})).toBe('shared');
  expect(shared).toBe(true);
 }
});
it('baixa o PNG e abre o WhatsApp com o link completo, tratando pop-up bloqueado e falha',()=>{
 for(const mode of ['ok','blocked','download_failed']){
  const actions:string[]=[];let cleanup:()=>void=()=>{};
  const tab={opener:{},location:{href:''},close:()=>actions.push('close')};
  const browser={open:()=>{actions.push('open');return mode==='blocked'?null:tab;},setTimeout:(fn:()=>void)=>{cleanup=fn;}};
  const anchor={href:'',download:'',click:()=>{actions.push('download');if(mode==='download_failed')throw Error('Falhou');},remove:()=>actions.push('remove')};
  const page={createElement:()=>anchor,body:{append:()=>{}}};
  const urls={createObjectURL:()=> 'blob:local-qr',revokeObjectURL:(url:string)=>{expect(url).toBe('blob:local-qr');actions.push('revoke');}};
  const result=openDesktopInvite(prepareInviteFile(image,'Credenciamento'),text,browser as any,page as any,urls as any);
  expect(anchor.download).toBe('Convite-Credenciamento.png');expect(anchor.href).toBe('blob:local-qr');
  expect(actions.slice(0,3)).toEqual(['open','download','remove']);
  expect(result).toBe(mode==='ok'?'desktop_ready':mode==='blocked'?'popup_blocked':'desktop_failed');
  if(mode==='ok'){expect(tab.opener).toBe(null);expect(new URL(tab.location.href).searchParams.get('text')).toBe(text);}
  if(mode==='download_failed')expect(actions).toContain('close');
  cleanup();expect(actions).toContain('revoke');
 }
});

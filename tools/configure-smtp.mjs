// Temporary loopback-only setup. Never log request bodies or SMTP errors.
import http from 'node:http';
import tls from 'node:tls';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, chmod } from 'node:fs/promises';
import { resolve } from 'node:path';
import nodemailer from 'nodemailer';
const port = 3112;
const origin = `http://127.0.0.1:${port}`;
const route = '/setup-' + randomBytes(24).toString('hex');
const csrf = randomBytes(32).toString('hex');
const nonce = randomBytes(24).toString('base64');
const email = 'ismael@rbkassessoria.com.br';
const target=resolve('.env.local');
let busy=false, completed=false;
function checkConnection() {
 return new Promise((resolve,reject)=>{
  const socket=tls.connect({host:'smtp.titan.email',port:465,servername:'smtp.titan.email',rejectUnauthorized:true,minVersion:'TLSv1.2'});
  const timer=setTimeout(()=>{socket.destroy();reject(Object.assign(Error('timeout'),{code:'ETIMEDOUT'}));},8000);
  socket.once('secureConnect',()=>{clearTimeout(timer);socket.end();resolve();});
  socket.once('error',error=>{clearTimeout(timer);socket.destroy();reject(error);});
 });
}

const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RBK — Configurar e-mail de homologação</title><style>body{font:18px system-ui;background:#f6f6f6;color:#262626;margin:0}main{max-width:640px;margin:60px auto;padding:32px;background:white;border-radius:18px}label,input,button{display:block}input{box-sizing:border-box;width:100%;padding:14px;margin:10px 0 20px;font-size:18px}button{background:#cb0020;color:white;border:0;padding:16px;border-radius:8px;font-size:17px}small{display:block;margin:20px 0;color:#555}</style><main><h1>Conectar e-mail da RBK</h1><p>Conta: <strong>${email}</strong><br>HostGator / Titan · conexão criptografada</p><p>Insira a senha da caixa de e-mail diretamente abaixo. Ela será validada com o Titan e salva somente na configuração local de homologação, com acesso restrito ao seu usuário.</p><form method="post" action="${route}" autocomplete="off"><input type="hidden" name="csrf" value="${csrf}"><label>Senha do e-mail<input name="password" type="password" required maxlength="512" autocomplete="off"></label><button disabled>Conectar e enviar teste para meu e-mail</button></form><p id="status" role="status">Verificando conexão com o servidor de e-mail…</p><small>O teste será enviado apenas para ${email}, sem documentos ou dados de clientes. O envio automático aos clientes continuará bloqueado até a publicação do portal de homologação.</small></main><script nonce="${nonce}">
const form=document.querySelector('form'), status=document.getElementById('status'), button=form.querySelector('button');
async function request(data) {
 const response=await fetch(form.action,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:data,credentials:'same-origin',redirect:'error',signal:AbortSignal.timeout(45000)});
 const text=await response.text();const doc=new DOMParser().parseFromString(text,'text/html');
 status.textContent=doc.body.textContent;return response.ok;
}
const probe=new URLSearchParams({csrf:form.elements.csrf.value,probe:'1'});
request(probe).then(ok=>{button.disabled=!ok;}).catch(()=>{status.textContent='A verificação não respondeu. A senha não foi enviada. Reabra esta página para verificar a conexão.';});
form.addEventListener('submit',async(event)=>{event.preventDefault();button.disabled=true;status.textContent='Verificando conexão com Titan e enviando teste…';
try{const data=new URLSearchParams(new FormData(form));const ok=await request(data);form.elements.password.value='';if(ok){form.hidden=true;}}
catch{status.textContent='O servidor não respondeu no prazo. Não foi possível confirmar o envio do teste. Confira a caixa de entrada antes de tentar novamente.';}
finally{button.disabled=false;}});
</script></html>`;
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',`default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'`);
 const reply=(code,text)=>{res.writeHead(code,{'Content-Type':'text/html; charset=utf-8'});res.end(text);};
 if(req.headers.host!==`127.0.0.1:${port}`||req.url!==route)return reply(404,'Indisponível');
 if(completed)return reply(200,'<h1>E-mail conectado</h1><p>Configuração salva e teste aceito pelo servidor de e-mail. Você pode fechar esta aba.</p>');
 if(req.method==='GET')return reply(200,html);
 if(req.method!=='POST'||req.headers.origin!==origin||!req.headers['content-type']?.startsWith('application/x-www-form-urlencoded'))return reply(403,'Operação não permitida');
 if(busy)return reply(409,'Aguarde a verificação atual.');
 let text='';for await(const c of req){text+=c;if(text.length>8192)return reply(413,'Dados excedem o limite');}
 const form=new URLSearchParams(text), password=form.get('password');text='';
 if(form.get('csrf')!==csrf)return reply(403,'Sessão inválida. Reabra a página de configuração.');
 if(form.get('probe')==='1'){
  try{await checkConnection();return reply(200,'Conexão com Titan verificada. Você pode inserir a senha.');}
  catch{return reply(503,'O servidor Titan não respondeu à conexão segura. Não digite a senha agora. Precisamos resolver a conexão de rede antes de continuar.');}
 }
 if(!password||password.length>512)return reply(400,'Informe a senha da caixa de e-mail.');
 busy=true;
 const smtp=nodemailer.createTransport({host:'smtp.titan.email',port:465,secure:true,auth:{user:email,pass:password},tls:{rejectUnauthorized:true,minVersion:'TLSv1.2'},connectionTimeout:8000,greetingTimeout:8000,socketTimeout:10000,dnsTimeout:8000,logger:false,debug:false,disableFileAccess:true,disableUrlAccess:true});
 try {
  await smtp.verify();
  const result=await smtp.sendMail({from:{name:'RBK Digital',address:email},to:email,subject:'RBK Digital — teste de conexão em homologação',text:'A conexão segura do e-mail da RBK Digital foi validada em homologação. Este é um teste técnico, sem dados de clientes. O envio dos links de auditoria aos clientes ainda depende da publicação do portal de homologação.'});
  if(!result.accepted?.length)throw Error('rejected');
  let env=await readFile(target,'utf8');
  const settings={AUDIT_SMTP_USER:email,AUDIT_SMTP_PASSWORD_B64:Buffer.from(password).toString('base64'),AUDIT_EMAIL_ENABLED:'false',AUDIT_EMAIL_ALLOWED_RECIPIENTS:email};
  for(const [key,value] of Object.entries(settings)){env=env.replace(new RegExp('^'+key+'=.*\\n?','gm'),'');env+='\n'+key+'='+value+'\n';}
  await writeFile(target,env,{mode:0o600});await chmod(target,0o600);
  completed=true; console.log(JSON.stringify({event:'smtp_setup_complete',verified:true,testAccepted:true}));
  reply(200,'<h1>E-mail conectado</h1><p>A conexão foi validada e o servidor aceitou o e-mail de teste. Confira sua caixa de entrada e spam.</p><p>A configuração foi salva em homologação. Nenhum cliente foi contatado.</p>');
 }catch(error){
  const authFailed=error?.code==='EAUTH';
  reply(400,authFailed ? 'O Titan recusou a autenticação. Confira a senha e a permissão de acesso SMTP da conta. Configuração não salva.' : 'Falha de conexão ou confirmação do envio. A configuração não foi salva. Confira sua caixa de entrada antes de repetir o teste.');
  console.log(JSON.stringify({event:'smtp_setup_failed',category:authFailed?'authentication':'connection_or_send'}));
 }
 finally{smtp.close();busy=false;}
});
server.listen(port,'127.0.0.1',()=>console.log('SETUP_URL='+origin+route));
setTimeout(()=>server.close(),30*60*1000).unref();

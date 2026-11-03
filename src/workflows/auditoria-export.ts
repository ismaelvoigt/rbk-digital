import {sleep} from 'workflow';
import {makeExportEngine} from '../lib/auditoria/export-server';
async function initialize(id:string){'use step';return (await makeExportEngine(id)).initialize();}
async function advance(id:string,index:number){'use step';return (await makeExportEngine(id)).advance(index);}
async function finish(id:string){'use step';return (await makeExportEngine(id)).finish();}
async function verify(id:string,number:number){'use step';await (await makeExportEngine(id)).verify(number);}
async function ready(id:string){'use step';return (await makeExportEngine(id)).ready();}
async function cleanup(id:string,state:'expired'|'failed'){'use step';await (await makeExportEngine(id)).cleanup(state);}
export async function prepararAuditoriaZip(id:string){
 'use workflow';
 try{
  await initialize(id);
  let cursor=0;while(!await advance(id,cursor))cursor++;
  const parts=await finish(id);
  for(let i=1;i<=parts;i++)await verify(id,i);
  const expires=await ready(id);await sleep(new Date(expires));await cleanup(id,'expired');
 }catch{await cleanup(id,'failed');}
}

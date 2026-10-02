import type { Summary } from './domain';
export type ReceiptFinding = {id:string; title:string; description:string; level:'pending'|'blocked'};
/** Operational metadata only: never infer authorization counts or legal findings from files. */
export function receiptFindings(detail:Summary):ReceiptFinding[] {
 const findings:ReceiptFinding[]=[];
 const received=detail.batches.flatMap(b=>b.files.filter(f=>f.received_at));
 if(!detail.offices?.some(f=>f.received_at)) findings.push({id:'office',title:'Ofício não anexado',description:'Anexe o ofício na Visão geral para orientar a conferência das autorizações solicitadas.',level:'pending'});
 if(!received.length) findings.push({id:'empty',title:'Aguardando documentos',description:'Nenhum arquivo da farmácia foi confirmado como recebido.',level:'pending'});
 for(const b of detail.batches) if(!b.completed_at) findings.push({id:`batch-${b.id}`,title:`Lote ${b.number} em andamento`,description:'O envio ainda não foi concluído pela farmácia.',level:'pending'});
 for(const f of [...received,...(detail.offices||[]).filter(f=>f.received_at)]) {
  if(f.scan==='clean') continue;
  const blocked=['infected','rejected'].includes(f.scan||'');
  findings.push({id:`file-${f.id}`,title:blocked?'Arquivo bloqueado':'Verificação de segurança pendente',description:f.filename,level:blocked?'blocked':'pending'});
 }
 return findings;
}

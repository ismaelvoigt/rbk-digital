import {bytes,date,type Summary} from '../../../lib/auditoria/domain';
import {formatCnpj} from '../../../lib/auditoria/cnpj';
import {receiptFindings} from '../../../lib/auditoria/report';
export function Occurrences({detail}:{detail:Summary}) {
 const findings=receiptFindings(detail);
 return <section className="aud-card"><h2>Ocorrências</h2>
 <p>Pendências de recebimento e segurança dos documentos. A conferência do conteúdo das autorizações ainda não foi realizada.</p>
 {!findings.length ? <p>Nenhuma pendência de recebimento identificada. Isso não atesta a regularidade das autorizações.</p> :
 <div className="aud-findings">{findings.map(f=><article key={f.id} className={`aud-finding ${f.level}`}><strong>{f.title}</strong><p>{f.description}</p></article>)}</div>}
 </section>;
}
export default function ReceiptReport({detail,generatedAt}:{detail:Summary;generatedAt:string}) {
 const findings=receiptFindings(detail);
 const files=detail.batches.flatMap(b=>b.files.filter(f=>f.received_at));
 return <section className="aud-card aud-receipt-report">
 <div className="aud-row"><h2>Relatório de recebimento documental</h2><button className="aud-no-print" onClick={()=>window.print()}>Imprimir / Salvar PDF</button></div>
 <p><strong>{detail.audit.pharmacy}</strong><br/>CNPJ {formatCnpj(detail.audit.cnpj)}<br/>{detail.audit.reference}</p>
 <p>Gerado em {date(generatedAt)} · Último envio: {date(detail.last_received)}</p>
 <div className="aud-metrics"><div><strong>{files.length}</strong><span>Arquivos recebidos</span></div><div><strong>{bytes(files.reduce((n,f)=>n+f.size,0))}</strong><span>Volume recebido</span></div><div><strong>{files.filter(f=>f.scan==='clean').length}</strong><span>Verificados pelo antivírus</span></div></div>
 <h3>Pendências de recebimento</h3>
 {findings.length ? <ul>{findings.map(f=><li key={f.id}><strong>{f.title}:</strong> {f.description}</li>)}</ul> : <p>Nenhuma pendência de recebimento identificada.</p>}
 <h3>Documentos recebidos</h3>
 {detail.batches.map(b=><article key={b.id} className="aud-batch"><h3>Lote {b.number} · {b.completed_at?'Recebido':'Em andamento'}</h3><p>{date(b.completed_at||b.started_at)} · Protocolo interno RBK: {b.protocol||'Ainda não emitido'}</p>
 <ul>{b.files.filter(f=>f.received_at).map(f=><li key={f.id}>{f.filename} · {bytes(f.size)} · {f.scan==='clean'?'Verificado pelo antivírus':['infected','rejected'].includes(f.scan||'')?'Bloqueado':'Verificação pendente'}</li>)}</ul></article>)}
 <p>Este relatório resume o recebimento documental. Não contém conclusão de auditoria nem validação das autorizações. Um arquivo pode conter várias autorizações. O protocolo RBK não é um protocolo oficial do Ministério da Saúde.</p>
 <small className="aud-no-print">Retrato dos dados no momento da geração. Salve em PDF para guardar esta versão; ao recarregar a página, gere novamente.</small>
 </section>;
}

import { ZipWriter } from '@zip.js/zip.js';
import { PortalError } from './server';

export type ZipFile = { name: string; path: string; size: number };
type FileRow = { id: string; filename: string; size: number; received_at: string | null; source: string; storage_path: string; audit_id: string; batch_id: string };
type ZipDetail = { audit: { id: string }; batches: { id: string; number: number; completed_at: string | null; files: FileRow[] }[] };
function safeName(value: string) {
  let name = value.normalize('NFC').replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, '_').replace(/[. ]+$/, '').trim();
  if (!name || name === '.' || name === '..') name = 'documento';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = '_' + name;
  return name.slice(0, 180);
}
export function selectZipFiles(detail: ZipDetail, auditId: string, batchId?: string): ZipFile[] {
  if (detail.audit.id !== auditId) throw new PortalError(403, 'Você não tem acesso a esta auditoria.');
  const batches = batchId ? detail.batches.filter(b => b.id === batchId) : detail.batches;
  if (!batches.length) throw new PortalError(404, 'Nenhum lote disponível.');
  if (batchId && !batches[0].completed_at) throw new PortalError(409, 'Aguarde a conclusão do envio deste lote.');
  const result: ZipFile[] = [];
  const used = new Set<string>();
  for (const batch of [...batches].sort((a,b) => a.number - b.number)) {
    if (!batch.completed_at) continue;
    if (!Number.isSafeInteger(batch.number) || batch.number < 1) throw new Error('Invalid batch number');
    const folder = `Lote ${String(batch.number).padStart(3, '0')}`;
    for (const file of batch.files) {
      if (!file.received_at) continue;
      if (file.source !== 'pharmacy' || file.audit_id !== auditId || file.batch_id !== batch.id || !file.storage_path.startsWith(`${auditId}/${batch.id}/`) || !Number.isSafeInteger(file.size) || file.size < 1) throw new Error('Invalid audit file');
      const base = safeName(file.filename);
      const dot = base.lastIndexOf('.');
      const stem = dot > 0 ? base.slice(0,dot) : base, extension = dot > 0 ? base.slice(dot) : '';
      let name = `${folder}/${base}`, suffix = 2;
      while (used.has(name.toLowerCase())) name = `${folder}/${stem} (${suffix++})${extension}`;
      used.add(name.toLowerCase());
      result.push({name, path:file.storage_path, size:file.size});
    }
  }
  if (!result.length) throw new PortalError(404, 'Nenhum arquivo recebido em lotes concluídos.');
  return result;
}

/** ZIP64/STORE: backpressure reaches each source; only one file is read at a time. */
export function zipStream(files: ZipFile[], open: (file: ZipFile, signal: AbortSignal) => Promise<ReadableStream<Uint8Array>>, signal?: AbortSignal): ReadableStream<Uint8Array> {
  const stop = new AbortController();
  const abort = () => stop.abort(signal?.reason);
  signal?.addEventListener('abort', abort, {once:true});
  if (signal?.aborted) abort();
  let output: TransformStreamDefaultController<Uint8Array>;
  const pipe = new TransformStream<Uint8Array,Uint8Array>({start(controller){output=controller;}});
  const writer = new ZipWriter(pipe.writable, {zip64:true, level:0, bufferedWrite:false, dataDescriptor:true, useWebWorkers:false});
  const reader = pipe.readable.getReader();
  void (async () => {
    try {
      for (const file of files) {
        stop.signal.throwIfAborted();
        const source = await open(file, stop.signal);
        let bytes = 0;
        const checked = source.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({
          transform(chunk,controller){bytes += chunk.byteLength;if(bytes>file.size) throw new Error('Tamanho do arquivo divergente.');controller.enqueue(chunk);},
          flush(){if(bytes!==file.size) throw new Error('Download do arquivo incompleto.');},
        }), {signal:stop.signal});
        await writer.add(file.name, checked, {signal:stop.signal});
      }
      await writer.close();
    } catch (error) {
      stop.abort(error);
      output!.error(error);
    }
  })();
  return new ReadableStream<Uint8Array>({
    async pull(controller){try{const next=await reader.read();if(next.done){signal?.removeEventListener('abort',abort);controller.close();}else controller.enqueue(next.value);}catch(error){signal?.removeEventListener('abort',abort);controller.error(error);}},
    async cancel(reason){signal?.removeEventListener('abort',abort);stop.abort(reason);await reader.cancel(reason);},
  });
}

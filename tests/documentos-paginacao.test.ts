import {expect,it} from 'vitest';
import {listarPaginas} from '../src/lib/documentos/paginacao';
it('carrega além do limite do servidor sem perder registros',async()=>{
 const rows=Array.from({length:1201},(_,i)=>i),ranges:number[][]=[];
 const actual=await listarPaginas<number>(async(from,to)=>{ranges.push([from,to]);return{data:rows.slice(from,to+1),error:null}});
 expect(actual).toHaveLength(1201);expect(actual[1200]).toBe(1200);expect(ranges).toEqual([[0,499],[500,999],[1000,1499]]);
});
it('não transforma erro de consulta em contagem zero',async()=>{
 await expect(listarPaginas(async()=>({data:null,error:{message:'offline'}}))).rejects.toThrow('offline');
});

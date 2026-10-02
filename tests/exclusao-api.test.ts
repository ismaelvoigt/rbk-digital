import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({getUser:vi.fn(),maybeSingle:vi.fn(),rpc:vi.fn(),remove:vi.fn(),from:vi.fn()}));
vi.mock('../src/lib/supabase/admin',()=>({createAdminClient:()=>({auth:{getUser:mocks.getUser},from:()=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:mocks.maybeSingle})})})}),rpc:mocks.rpc,storage:{from:mocks.from}})}));
import {GET,DELETE} from '../src/app/api/usuarios/exclusao/route';
const farm='10000000-0000-4000-8000-000000000001';
const req=(body:unknown={farm_id:farm,cnpj:'12345678000190'},token='valid')=>new Request('https://example.com/api/usuarios/exclusao',{method:'DELETE',headers:token?{authorization:`Bearer ${token}`}:{},body:JSON.stringify(body)});
beforeEach(()=>{vi.resetAllMocks();mocks.getUser.mockResolvedValue({data:{user:{id:'actor'}},error:null});mocks.maybeSingle.mockResolvedValue({data:{user_id:'actor'},error:null});mocks.from.mockReturnValue({remove:mocks.remove});mocks.remove.mockResolvedValue({error:null});});
describe('exclusão definitiva API',()=>{
it('recusa sessão ausente, usuário comum e permissão indisponível antes de consultar alvo',async()=>{
expect((await DELETE(req(undefined,''))).status).toBe(401);mocks.maybeSingle.mockResolvedValue({data:null,error:null});expect((await DELETE(req())).status).toBe(403);expect(mocks.rpc).not.toHaveBeenCalled();
});
it('recusa CNPJ ausente e farm_id inválido',async()=>{expect((await DELETE(req({farm_id:farm}))).status).toBe(400);expect((await DELETE(req({farm_id:'invalid',cnpj:'12345678000190'}))).status).toBe(400);expect(mocks.rpc).not.toHaveBeenCalled();});
it('não remove objetos quando servidor recusa elegibilidade',async()=>{mocks.rpc.mockResolvedValue({error:{code:'P0001',message:'Já acessou e possui documentos'}});expect((await DELETE(req())).status).toBe(409);expect(mocks.remove).not.toHaveBeenCalled();});
it('remove somente paths do manifesto e finaliza após Storage',async()=>{
mocks.rpc.mockResolvedValueOnce({data:{pending:true,objects:[{bucket:'documentos',name:'server/doc.pdf'}]}}).mockResolvedValueOnce({data:{completed:true}});
expect((await DELETE(req({farm_id:farm,cnpj:'12345678000190',objects:[{bucket:'documentos',name:'other.pdf'}]}))).status).toBe(200);
expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(['server/doc.pdf']);expect(mocks.rpc).toHaveBeenLastCalledWith('farmacia_exclusao',expect.objectContaining({p_actor:'actor',p_farm:farm,p_action:'finish'}));
});
it('falha no Storage deixa pendente sem finalizar ou anunciar sucesso',async()=>{mocks.rpc.mockResolvedValue({data:{pending:true,objects:[{bucket:'documentos',name:'server/doc.pdf'}]}});mocks.remove.mockResolvedValue({error:{message:'failed'}});const res=await DELETE(req());expect(res.status).toBe(503);expect(await res.json()).toMatchObject({pending:true});expect(mocks.rpc).toHaveBeenCalledTimes(1);});
it('lotes restantes retornam 202 e repetição concluída não apaga objetos novamente',async()=>{mocks.rpc.mockResolvedValueOnce({data:{pending:true,objects:[]}}).mockResolvedValueOnce({data:{pending:true,objects:[{name:'private'}]}});let r=await DELETE(req());expect(r.status).toBe(202);expect(await r.json()).toEqual({pending:true});mocks.rpc.mockResolvedValue({data:{completed:true}});r=await DELETE(req());expect(r.status).toBe(200);expect(mocks.remove).not.toHaveBeenCalled();});
it('prévia não tem efeitos de exclusão nem expõe o manifesto',async()=>{mocks.rpc.mockResolvedValue({data:{eligible:true,objects:[{name:'private'}]}});const r=await GET(new Request(`https://example.com/api/usuarios/exclusao?farm_id=${farm}`,{headers:{authorization:'Bearer valid'}}));expect(await r.json()).toEqual({eligible:true});expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('farmacia_exclusao',expect.objectContaining({p_action:'preview'}));expect(mocks.remove).not.toHaveBeenCalled();});
});

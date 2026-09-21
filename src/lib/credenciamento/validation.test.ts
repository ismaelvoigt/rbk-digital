import {describe,it,expect} from 'vitest';
import {missingFichaFields} from './validation';
import fields from '../processos/fields.json';
const full=()=>Object.fromEntries(fields.filter(f=>!f.group.startsWith('Sócio ')||f.group==='Sócio 1').map(f=>[f.cell,f.type==='date'?'2027-12-31':/MAIL|ELETRÔNICO/.test(f.label)?'teste@example.invalid':['B19','B20'].includes(f.cell)?'11.222.333/0001-81':'TESTE']));
describe('Salvar ficha completa',()=>{
 it('bloqueia ficha vazia e aceita todos os campos aplicáveis',()=>{expect(missingFichaFields({},1).length).toBeGreaterThan(0);expect(missingFichaFields(full(),1)).toEqual([]);});
 it('bloqueia campos em branco e email/data inválidos',()=>{for(const [key,value] of [['B26','  '],['B32','email inválido'],['B35','2027-02-30'],['B19','123']])expect(missingFichaFields({...full(),[key]:value},1).length).toBeGreaterThan(0);});
 it('aceita complemento vazio e qualquer um dos telefones',()=>{expect(missingFichaFields({...full(),B28:'',B33:'',B34:'11999999999'},1)).toEqual([]);expect(missingFichaFields({...full(),B28:'',B33:'11999999999',B34:''},1)).toEqual([]);expect(missingFichaFields({...full(),B33:'',B34:''},1).length).toBeGreaterThan(0);});
 it('exige somente os sócios selecionados',()=>{expect(missingFichaFields(full(),2).length).toBeGreaterThan(0);expect(missingFichaFields(full(),1)).toEqual([]);expect(()=>missingFichaFields(full(),0)).toThrow();});
});

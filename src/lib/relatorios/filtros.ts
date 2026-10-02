export const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'] as const;
export type FiltrosRelatorios = { modoData?: string; dia?: string; inicio?: string; fim?: string; numero?: string; cpf?: string; crm?: string; uf?: string };

function numeroCrm(value: string) {
  const numero = value.trim().replace(/^0+(?=\d)/, '');
  if (numero && !/^[1-9]\d{0,9}$/.test(numero)) throw new Error('Informe um CRM numérico válido, com até 10 dígitos.');
  return numero;
}
function ufCrm(value: string) {
  const uf = value.trim().toUpperCase();
  if (uf && !UFS.some(item => item === uf)) throw new Error('Selecione uma UF válida.');
  return uf;
}
export function normalizarCrm(numero: string, estado: string) {
  const crm = numeroCrm(numero), uf = ufCrm(estado);
  if (crm && !uf) throw new Error('Selecione a UF do CRM.');
  if (uf && !crm) throw new Error('Informe o número do CRM.');
  return { crm: crm || null, crm_uf: uf || null };
}
function validarData(data: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(data)) || new Date(data).toISOString().slice(0,10) !== data) throw new Error('Informe uma data válida.');
}
export function normalizarFiltros(f: FiltrosRelatorios) {
  let inicio = '', fim = '';
  if (f.modoData === 'dia') {
    inicio = fim = f.dia || '';
    validarData(inicio);
  } else if (f.modoData === 'periodo') {
    inicio = f.inicio || ''; fim = f.fim || '';
    if (!inicio || !fim) throw new Error('Informe o início e o fim do período.');
    validarData(inicio); validarData(fim);
    if (inicio > fim) throw new Error('A data inicial não pode ser maior que a data final.');
  }
  const cpf = (f.cpf || '').replace(/[.\s-]/g, '');
  const numero = (f.numero || '').replace(/[.\s]/g, '');
  if (cpf && !/^\d{11}$/.test(cpf)) throw new Error('Informe o CPF com 11 dígitos.');
  if (numero && !/^\d{15}$/.test(numero)) throw new Error('Informe a autorização com 15 dígitos.');
  return { inicio, fim, numero, cpf, crm: numeroCrm(f.crm || ''), uf: ufCrm(f.uf || '') };
}

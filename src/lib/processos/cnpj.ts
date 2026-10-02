/** Display mask; does not assert registration or authenticity. */
export function formatCnpj(value: string): string {
 const digits = value.replace(/\D/g, '').slice(0, 14);
 return digits.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2}\.\d{3})(\d)/, '$1.$2').replace(/^(\d{2}\.\d{3}\.\d{3})(\d)/, '$1/$2').replace(/(\/\d{4})(\d)/, '$1-$2');
}
export const isCnpjCell = (cell: string) => cell === 'B19' || cell === 'B20';

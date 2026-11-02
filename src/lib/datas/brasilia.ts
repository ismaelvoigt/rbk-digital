/** Brasília/DF uses the IANA America/Sao_Paulo calendar, independent of the device zone. */
export const FUSO_BRASILIA = "America/Sao_Paulo";
const dia = new Intl.DateTimeFormat("en-US", {
  timeZone: FUSO_BRASILIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function dataISOBrasilia(instante: Date = new Date()): string {
  const partes = Object.fromEntries(
    dia.formatToParts(instante).map(({ type, value }) => [type, value]),
  );
  return `${partes.year}-${partes.month}-${partes.day}`;
}

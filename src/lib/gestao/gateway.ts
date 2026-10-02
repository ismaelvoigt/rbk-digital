/** Contract for a future server-only adapter. No provider is configured or called. */
export type GatewayMethod='pix_automatico'|'boleto_pix'|'cartao_recorrente';
export interface GatewayCobranca {
 cobrancaId:string; clienteId:string; valorCentavos:number; vencimento:string;
 metodo:GatewayMethod; idempotencyKey:string;
}
export interface CobrancaGateway {
 readonly provider:string;
 criarCobranca(input:GatewayCobranca):Promise<{externalId:string;paymentUrl?:string}>;
 cancelarCobranca(externalId:string):Promise<void>;
 validarWebhook(rawBody:string,signature:string):Promise<{eventId:string;externalId:string;valorCentavos:number;paidAt:string}>;
}
// Future activation requires credentials, verified webhook signatures, idempotent reconciliation,
// and audited mapping to an existing invoice. Manual payments remain available independently.
export const gatewayConfigurado=false;

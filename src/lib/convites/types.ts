export type DeliveryStatus = 'pending' | 'accepted' | 'failed' | 'manual' | 'not_configured' | 'invalid_contact' | 'unsafe_link' | 'unavailable';
export type ChannelResult = { status: DeliveryStatus; recorded: boolean; url?: string };
export type DeliveryResult = { email: ChannelResult; whatsapp: ChannelResult };
export type DeliveryEvent = { channel: 'email' | 'whatsapp'; status: DeliveryStatus; created_at: string };
export const deliveryLabels: Record<DeliveryStatus, string> = {
 pending: 'Tentativa iniciada; resultado ainda não confirmado',
 accepted: 'Aceito pelo provedor de e-mail (entrega não confirmada)',
 failed: 'Falha no envio; use o compartilhamento manual',
 manual: 'Envio manual pendente: abra o WhatsApp e confirme o envio',
 not_configured: 'Envio automático não configurado',
 invalid_contact: 'Contato ausente ou inválido',
 unsafe_link: 'Envio indisponível: configure a URL pública HTTPS do portal',
 unavailable: 'Envio indisponível: não foi possível registrar a tentativa',
};

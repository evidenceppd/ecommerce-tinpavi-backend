export interface PaymentInitiationInput {
  orderId: string;
  amount: number; // total em reais (Decimal → number)
  paymentMethod: string; // ex: 'MOCK', 'PIX', 'CREDIT_CARD'
  customerEmail: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentInitiationResult {
  externalId: string; // ID gerado pelo provider
  status: 'PENDING' | 'AWAITING_PAYMENT' | 'PAID';
  checkoutUrl?: string;
  qrCode?: string;
  expiresAt?: Date;
}

export interface PaymentStatusResult {
  externalId: string;
  status: 'PENDING' | 'AWAITING_PAYMENT' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  paidAt?: Date;
}

export interface NormalizedWebhookPayload {
  externalId: string;
  status: string;
  rawPayload: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly name: string;
  initiatePayment(input: PaymentInitiationInput): Promise<PaymentInitiationResult>;
  getPaymentStatus(externalId: string): Promise<PaymentStatusResult>;
  processWebhook(payload: NormalizedWebhookPayload): Promise<PaymentStatusResult>;
}

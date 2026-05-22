import { prisma } from '@/shared/infra/prisma';
import { cache } from '@/shared/infra/memory-cache';
import { cachePrefixes } from '@/shared/infra/cache-keys';
import { MockPaymentProvider } from './mock-payment.provider';
import type { PaymentProvider, NormalizedWebhookPayload } from './payment-provider.interface';
import type { InitiatePaymentDto } from './payments.schemas';

// Registro de providers — adicionar novos providers aqui futuramente
const providers: Record<string, PaymentProvider> = {
  MOCK: new MockPaymentProvider(),
};
const WEBHOOK_DONE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const WEBHOOK_LOCK_TTL_SECONDS = 30;

function getProvider(method: string): PaymentProvider {
  const provider = providers[method.toUpperCase()];
  if (!provider) {
    throw Object.assign(new Error(`Payment method not supported: ${method}`), {
      statusCode: 400,
      code: 'PAYMENT_PROVIDER_NOT_FOUND',
    });
  }
  return provider;
}

export class PaymentsService {
  /**
   * Inicia pagamento e atualiza order com status e externalId.
   * Verifica que o pedido pertence ao customer autenticado.
   */
  async initiatePayment(
    dto: InitiatePaymentDto,
    customerId: string,
  ): Promise<{
    orderId: string;
    paymentStatus: string;
    externalId: string;
    checkoutUrl?: string;
  }> {
    const order = await prisma.order.findUnique({
      where: { id: dto.orderId },
      select: { id: true, customerId: true, totalAmount: true, paymentStatus: true },
    });

    if (!order) {
      throw Object.assign(new Error('Order not found'), { statusCode: 404, code: 'ORDER_NOT_FOUND' });
    }

    if (order.customerId !== customerId) {
      throw Object.assign(new Error('Order not found'), { statusCode: 404, code: 'ORDER_NOT_FOUND' });
    }

    if (order.paymentStatus === 'PAID') {
      throw Object.assign(new Error('Order is already paid'), { statusCode: 409, code: 'ORDER_ALREADY_PAID' });
    }

    const provider = getProvider(dto.paymentMethod);
    const result = await provider.initiatePayment({
      orderId: dto.orderId,
      amount: Number(order.totalAmount),
      paymentMethod: dto.paymentMethod,
      customerEmail: '',
    });

    await prisma.order.update({
      where: { id: dto.orderId },
      data: {
        paymentMethod: dto.paymentMethod,
        paymentStatus: result.status,
        paymentExternalId: result.externalId,
        paidAt: result.status === 'PAID' ? new Date() : null,
        ...(result.status === 'PAID'
          ? {
              status: 'PAID',
              statusHistory: { create: { status: 'PAID' } },
            }
          : {}),
      },
    });

    cache.delByPrefix(cachePrefixes.catalog);

    return {
      orderId: dto.orderId,
      paymentStatus: result.status,
      externalId: result.externalId,
      checkoutUrl: result.checkoutUrl,
    };
  }

  /**
   * Processa webhook genérico do gateway.
   * Localiza o order pelo externalId e atualiza paymentStatus.
   */
  async processWebhook(rawPayload: Record<string, unknown>): Promise<{ processed: boolean }> {
    const eventId = String(rawPayload['eventId'] ?? '');
    const externalId = String(rawPayload['externalId'] ?? '');
    const status = String(rawPayload['status'] ?? '');

    if (!externalId || !status) return { processed: false };

    const eventKey = eventId || `${externalId}:${status}`;
    const doneKey = `payment:webhook:done:${eventKey}`;
    const lockKey = `payment:webhook:lock:${eventKey}`;

    const alreadyDone = await prisma.paymentWebhookEvent.findUnique({ where: { eventKey: doneKey } });
    if (alreadyDone) return { processed: true };

    const acquired = cache.setNX(lockKey, '1', WEBHOOK_LOCK_TTL_SECONDS);
    if (!acquired) return { processed: true };

    try {
      const order = await prisma.order.findFirst({
        where: { paymentExternalId: externalId },
        select: { id: true, paymentStatus: true, status: true },
      });

      if (!order) return { processed: false };

      const provider = getProvider('MOCK'); // provider determinado pelo prefix no futuro
      const normalizedPayload: NormalizedWebhookPayload = { externalId, status, rawPayload };
      const result = await provider.processWebhook(normalizedPayload);

      const samePaymentStatus = order.paymentStatus === result.status;
      const nextOrderStatus =
        result.status === 'PAID'
          ? 'PAID'
          : result.status === 'REFUNDED'
            ? 'REFUNDED'
            : result.status === 'CANCELLED'
              ? 'CANCELLED'
              : null;

      const shouldAppendHistory = Boolean(nextOrderStatus && order.status !== nextOrderStatus);

      await prisma.order.update({
        where: { id: order.id },
        data: {
          ...(samePaymentStatus ? {} : { paymentStatus: result.status }),
          ...(result.paidAt ? { paidAt: result.paidAt } : {}),
          ...(nextOrderStatus ? { status: nextOrderStatus } : {}),
          ...(shouldAppendHistory ? { statusHistory: { create: { status: nextOrderStatus! } } } : {}),
        },
      });

      cache.delByPrefix(cachePrefixes.catalog);

      await prisma.paymentWebhookEvent.upsert({
        where: { eventKey: doneKey },
        update: {},
        create: { eventKey: doneKey, externalId, status },
      });

      return { processed: true };
    } finally {
      cache.del(lockKey);
    }
  }
}

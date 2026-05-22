import type { ShippingOption, ShippingProvider, ShippingQuoteInput } from './shipping-provider.interface';

type MelhorEnvioRate = {
  company?: { name?: string };
  name?: string;
  price?: string | number;
  custom_price?: string | number;
  delivery_time?: number | string;
  error?: string;
};

function normalizeZipCode(value: string): string {
  return value.replace(/\D/g, '');
}

function toNumber(value: string | number | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export class MelhorEnvioProvider implements ShippingProvider {
  readonly name = 'MELHOR_ENVIO';

  async quote(input: ShippingQuoteInput): Promise<ShippingOption[]> {
    const baseUrl = process.env['MELHOR_ENVIO_BASE_URL'];
    const token = process.env['MELHOR_ENVIO_TOKEN'];

    if (!baseUrl || !token) {
      throw Object.assign(new Error('Shipping provider unavailable'), {
        statusCode: 503,
        code: 'SHIPPING_PROVIDER_UNAVAILABLE',
      });
    }

    const payload = {
      from: {
        postal_code: normalizeZipCode(input.origin.zipCode),
      },
      to: {
        postal_code: normalizeZipCode(input.destinationZipCode),
      },
      products: input.items.map((item) => ({
        id: item.variantId ?? item.productId,
        width: item.widthCm,
        height: item.heightCm,
        length: item.lengthCm,
        weight: item.weightKg,
        insurance_value: 0,
        quantity: item.quantity,
      })),
    };

    let response: Response;
    try {
      response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v2/me/shipment/calculate`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      throw Object.assign(new Error('Shipping provider unavailable'), {
        statusCode: 503,
        code: 'SHIPPING_PROVIDER_UNAVAILABLE',
      });
    }

    if (!response.ok) {
      throw Object.assign(new Error('Shipping provider unavailable'), {
        statusCode: 503,
        code: 'SHIPPING_PROVIDER_UNAVAILABLE',
      });
    }

    const rawRates = (await response.json()) as MelhorEnvioRate[];
    const options: ShippingOption[] = rawRates
      .filter((rate) => !rate.error)
      .map((rate) => {
        const carrier = rate.company?.name ?? 'Melhor Envio';
        const service = rate.name ?? 'Shipping';
        const rawPrice = rate.custom_price ?? rate.price;
        const estimatedDays = Number(rate.delivery_time ?? 0);
        return {
          carrier,
          service,
          price: toNumber(rawPrice),
          estimatedDays: Number.isFinite(estimatedDays) ? estimatedDays : 0,
          providerMeta: rate as Record<string, unknown>,
        };
      })
      .filter((option) => option.price > 0 && option.estimatedDays >= 0);

    if (options.length === 0) {
      throw Object.assign(new Error('Shipping provider unavailable'), {
        statusCode: 503,
        code: 'SHIPPING_PROVIDER_UNAVAILABLE',
      });
    }

    return options;
  }
}

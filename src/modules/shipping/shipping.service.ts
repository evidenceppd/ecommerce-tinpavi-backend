import { createHash, randomUUID } from 'crypto';

import { prisma } from '@/shared/infra/prisma';
import { cache } from '@/shared/infra/memory-cache';

import { resolveManualShippingOptions } from './manual-shipping-table';
import { MelhorEnvioProvider } from './melhor-envio.provider';
import type { ShippingAddressInput, ShippingQuoteDto } from './shipping.schemas';
import type {
  ShippingOption,
  ShippingProvider,
  ShippingQuoteInput,
  ShippingQuoteItem,
} from './shipping-provider.interface';

const CACHE_TTL_SECONDS = 3600;
const SELECTION_TTL_SECONDS = 3600;
const SELECTION_KEY_PREFIX = 'shipping:selection:';

type QuotedShippingOption = ShippingOption & { quoteId: string };

type ShippingSelectionSnapshot = {
  customerId: string;
  shippingAddressId: string | null;
  shippingAddress: ShippingAddressInput;
  price: number;
  carrier: string;
  service: string;
  estimatedDays: number;
};

type ResolvedShippingAddress = {
  shippingAddressId: string | null;
  shippingAddress: ShippingAddressInput;
};

function parseNumberEnv(key: string, fallback: number): number {
  const value = process.env[key];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeZipCode(value: string): string {
  return value.replace(/\D/g, '');
}

function normalizeShippingAddress(address: ShippingAddressInput): ShippingAddressInput {
  return {
    zipCode: normalizeZipCode(address.zipCode),
    street: address.street.trim(),
    number: address.number.trim(),
    complement: address.complement?.trim() || undefined,
    district: address.district.trim(),
    city: address.city.trim(),
    state: address.state.trim().toUpperCase(),
    country: address.country.trim().toUpperCase(),
  };
}

function buildCacheKey(destinationZipCode: string, items: ShippingQuoteItem[]): string {
  const itemSignatures = items
    .map((item) => [
      item.variantId ?? item.productId,
      item.quantity,
      item.weightKg,
      item.widthCm,
      item.heightCm,
      item.lengthCm,
    ])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  const payload = JSON.stringify({
    destinationZipCode: normalizeZipCode(destinationZipCode),
    itemSignatures,
  });

  const digest = createHash('sha256').update(payload).digest('hex');
  return `shipping:quote:${digest}`;
}

function toShippingProviderInput(params: {
  customerId: string;
  destinationZipCode: string;
  shippingAddressId?: string | null;
  items: ShippingQuoteItem[];
}): ShippingQuoteInput {
  return {
    customerId: params.customerId,
    shippingAddressId: params.shippingAddressId ?? 'inline',
    destinationZipCode: params.destinationZipCode,
    origin: {
      zipCode: process.env['SHIP_ORIGIN_ZIP_CODE'] ?? '01001000',
      city: process.env['SHIP_ORIGIN_CITY'] ?? 'Sao Paulo',
      state: process.env['SHIP_ORIGIN_STATE'] ?? 'SP',
    },
    items: params.items,
  };
}

export class ShippingService {
  private readonly provider: ShippingProvider;

  constructor(provider: ShippingProvider = new MelhorEnvioProvider()) {
    this.provider = provider;
  }

  async quoteForCustomer(
    dto: ShippingQuoteDto,
    customerId: string,
  ): Promise<{ source: 'provider' | 'fallback'; options: QuotedShippingOption[] }> {
    const resolvedAddress = await this.resolveAddress(dto, customerId);

    const quoteItems: ShippingQuoteItem[] = [];
    const defaultWeight = parseNumberEnv('SHIP_DEFAULT_WEIGHT_KG', 0.3);
    const defaultLength = parseNumberEnv('SHIP_DEFAULT_LENGTH_CM', 16);
    const defaultHeight = parseNumberEnv('SHIP_DEFAULT_HEIGHT_CM', 4);
    const defaultWidth = parseNumberEnv('SHIP_DEFAULT_WIDTH_CM', 11);

    for (const item of dto.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { id: true, title: true },
      });

      if (!product) {
        throw Object.assign(new Error('Product not found'), {
          statusCode: 404,
          code: 'PRODUCT_NOT_FOUND',
        });
      }

      quoteItems.push({
        productId: product.id,
        variantId: undefined,
        quantity: item.quantity,
        description: product.title,
        weightKg: defaultWeight,
        widthCm: defaultWidth,
        heightCm: defaultHeight,
        lengthCm: defaultLength,
      });
    }

    const destinationZipCode = normalizeZipCode(resolvedAddress.shippingAddress.zipCode);
    const cacheKey = buildCacheKey(destinationZipCode, quoteItems);

    const cached = cache.get<ShippingOption[]>(cacheKey);
    const bindSelections = async (options: ShippingOption[]): Promise<QuotedShippingOption[]> => {
      const bound: QuotedShippingOption[] = [];
      for (const option of options) {
        const quoteId = randomUUID();
        const selectionKey = `${SELECTION_KEY_PREFIX}${quoteId}`;
        const selectionPayload: ShippingSelectionSnapshot = {
          customerId,
          shippingAddressId: resolvedAddress.shippingAddressId,
          shippingAddress: resolvedAddress.shippingAddress,
          price: option.price,
          carrier: option.carrier,
          service: option.service,
          estimatedDays: option.estimatedDays,
        };
        cache.set(selectionKey, selectionPayload, SELECTION_TTL_SECONDS);
        bound.push({ ...option, quoteId });
      }
      return bound;
    };

    if (cached) {
      return { source: 'provider', options: await bindSelections(cached) };
    }

    try {
      const providerInput = toShippingProviderInput({
        customerId,
        shippingAddressId: resolvedAddress.shippingAddressId,
        destinationZipCode,
        items: quoteItems,
      });
      const options = await this.provider.quote(providerInput);

      cache.set(cacheKey, options, CACHE_TTL_SECONDS);

      return { source: 'provider', options: await bindSelections(options) };
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== 'SHIPPING_PROVIDER_UNAVAILABLE') {
        throw err;
      }

      const fallbackOptions = resolveManualShippingOptions(resolvedAddress.shippingAddress.state);
      return { source: 'fallback', options: await bindSelections(fallbackOptions) };
    }
  }

  private async resolveAddress(dto: ShippingQuoteDto, customerId: string): Promise<ResolvedShippingAddress> {
    if (dto.shippingAddressId) {
      const address = await prisma.address.findUnique({
        where: { id: dto.shippingAddressId },
        select: {
          id: true,
          customerId: true,
          zipCode: true,
          street: true,
          number: true,
          complement: true,
          district: true,
          city: true,
          state: true,
          country: true,
        },
      });

      if (!address || address.customerId !== customerId) {
        throw Object.assign(new Error('Shipping address not found'), {
          statusCode: 404,
          code: 'SHIPPING_ADDRESS_NOT_FOUND',
        });
      }

      return {
        shippingAddressId: address.id,
        shippingAddress: normalizeShippingAddress({
          zipCode: address.zipCode,
          street: address.street,
          number: address.number,
          complement: address.complement ?? undefined,
          district: address.district,
          city: address.city,
          state: address.state,
          country: address.country,
        }),
      };
    }

    if (!dto.shippingAddress) {
      throw Object.assign(new Error('Shipping address is required'), {
        statusCode: 400,
        code: 'SHIPPING_ADDRESS_REQUIRED',
      });
    }

    return {
      shippingAddressId: null,
      shippingAddress: normalizeShippingAddress(dto.shippingAddress),
    };
  }
}

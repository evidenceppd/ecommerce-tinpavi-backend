export type ShippingQuoteOrigin = {
  zipCode: string;
  city: string;
  state: string;
};

export interface ShippingQuoteItem {
  productId: string;
  variantId?: string;
  quantity: number;
  description: string;
  weightKg: number;
  widthCm: number;
  heightCm: number;
  lengthCm: number;
}

export interface ShippingQuoteInput {
  customerId: string;
  shippingAddressId: string;
  origin: ShippingQuoteOrigin;
  destinationZipCode: string;
  items: ShippingQuoteItem[];
}

export interface ShippingOption {
  carrier: string;
  service: string;
  price: number;
  estimatedDays: number;
  providerMeta?: Record<string, unknown>;
}

export interface ShippingProvider {
  readonly name: string;
  quote(input: ShippingQuoteInput): Promise<ShippingOption[]>;
}

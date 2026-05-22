import type { ShippingOption } from './shipping-provider.interface';

const SOUTH_STATES = new Set(['RS', 'SC', 'PR']);
const SOUTHEAST_STATES = new Set(['SP', 'RJ', 'MG', 'ES']);

function sameMacroRegion(state: string): boolean {
  return SOUTH_STATES.has(state) || SOUTHEAST_STATES.has(state);
}

export function resolveManualShippingOptions(destinationState: string): ShippingOption[] {
  const normalizedState = destinationState.trim().toUpperCase();

  if (normalizedState === 'SP') {
    return [
      { carrier: 'Manual Carrier', service: 'Express Sao Paulo', price: 19.9, estimatedDays: 2 },
      { carrier: 'Manual Carrier', service: 'Standard Sao Paulo', price: 14.9, estimatedDays: 4 },
      { carrier: 'Manual Carrier', service: 'Economy Sao Paulo', price: 11.5, estimatedDays: 6 },
    ];
  }

  if (sameMacroRegion(normalizedState)) {
    return [
      { carrier: 'Manual Carrier', service: 'Express Regional', price: 26.9, estimatedDays: 3 },
      { carrier: 'Manual Carrier', service: 'Standard Regional', price: 21.4, estimatedDays: 5 },
      { carrier: 'Manual Carrier', service: 'Economy Regional', price: 17.9, estimatedDays: 8 },
    ];
  }

  return [
    { carrier: 'Manual Carrier', service: 'Express National', price: 38.5, estimatedDays: 5 },
    { carrier: 'Manual Carrier', service: 'Standard National', price: 31.9, estimatedDays: 8 },
    { carrier: 'Manual Carrier', service: 'Economy National', price: 25.5, estimatedDays: 11 },
  ];
}

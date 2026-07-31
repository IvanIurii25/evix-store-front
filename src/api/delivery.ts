/**
 * Delivery methods and Nova Post reference lookups.
 *
 * `listDeliveryMethods` is the storefront's single source of truth for what the
 * checkout may offer: the option list, the free-delivery thresholds and the
 * carrier's address-field contract all come from the server, so turning a
 * method on or off is a back-end change alone.
 *
 * The lookups back the city and pickup-point pickers. They are rate-limited and
 * cached server-side; callers should still debounce typing.
 */
import { api } from './client';

export interface DeliveryMethod {
  /** `own` (pickup / our courier) or `novapost`. */
  service: string;
  /** `pickup` | `courier` | `branch` | `postomat`. */
  type: string;
  /** Flat price for own logistics; null when the carrier quotes it. */
  flat_cost: string | null;
  /** Goods amount (after discount) above which this method ships free. */
  free_from: string | null;
  /** Fields to collect for a carrier courier address. */
  address_fields: AddressField[];
}

export interface AddressField {
  name: string;
  required: boolean;
  max_length: number;
  label_ru: string;
  label_ro: string;
}

export interface DeliveryMethods {
  methods: DeliveryMethod[];
  novapost_enabled: boolean;
}

export interface Settlement {
  id: string;
  name: string;
}

export interface Division {
  id: string;
  number: string;
  address: string;
  settlement_name: string;
}

/**
 * Return the delivery options the checkout may offer.
 *
 * Never throws: a failure degrades to "carrier off", which leaves the customer
 * with pickup and our own courier rather than an error page.
 */
export async function listDeliveryMethods(): Promise<DeliveryMethods> {
  const { data, error } = await api.GET('/api/v1/delivery/methods', {
    credentials: 'include',
  });
  if (error || !data) return { methods: [], novapost_enabled: false };
  // Mapped rather than cast: the generated type models address_fields as an
  // open record, and a blind cast would hide a real contract change.
  return {
    novapost_enabled: Boolean(data.novapost_enabled),
    methods: (data.methods ?? []).map((m) => ({
      service: m.service,
      type: m.type,
      flat_cost: m.flat_cost ?? null,
      free_from: m.free_from ?? null,
      address_fields: (
        (m.address_fields ?? []) as Record<string, unknown>[]
      ).map((f) => ({
        name: String(f.name ?? ''),
        required: Boolean(f.required),
        max_length: Number(f.max_length ?? 0),
        label_ru: String(f.label_ru ?? ''),
        label_ro: String(f.label_ro ?? ''),
      })),
    })),
  };
}

/** Search carrier cities; returns an empty list on any failure. */
export async function searchSettlements(
  query: string,
  lang?: string,
): Promise<Settlement[]> {
  const { data, error } = await api.POST(
    '/api/v1/delivery/novapost/settlements',
    {
      params: { query: { lang } },
      body: { query },
      credentials: 'include',
    },
  );
  if (error || !data) return [];
  return (data.data ?? []) as Settlement[];
}

/** List branches or postomats in a city; returns an empty list on any failure. */
export async function listDivisions(
  settlementId: string,
  category: 'branch' | 'postomat',
  query: string,
  lang?: string,
): Promise<Division[]> {
  const { data, error } = await api.POST(
    '/api/v1/delivery/novapost/divisions',
    {
      params: { query: { lang } },
      body: { settlement_id: settlementId, category, query },
      credentials: 'include',
    },
  );
  if (error || !data) return [];
  return (data.data ?? []) as Division[];
}

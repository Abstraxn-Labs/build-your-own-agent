'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export interface DraftCartItem {
  key: string;
  menuItemId?: string;
  name: string;
  size?: string;
  /** Available sizes from menu (or inferred). Shown in draft cart picker. */
  sizeOptions?: string[];
  quantity: number;
  unitPrice?: number;
  restaurantId?: string;
  restaurantName?: string;
  imageUrl?: string;
}

export interface DraftCartContextValue {
  items: DraftCartItem[];
  addressId?: string;
  addressLabel?: string;
  /** True when an address card was tapped (or hydrated from chat pick). */
  addressReady: boolean;
  /** Cleared after Swiggy rejects the addressId — user must pick again. */
  addressInvalid: boolean;
  /** True only when Swiggy rejected the address — Sync stays available otherwise. */
  needsAddressPick: boolean;
  restaurantId?: string;
  restaurantName?: string;
  itemCount: number;
  estimatedTotal: number;
  missingSizeCount: number;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  setAddress: (id: string, label: string) => void;
  /** Drop stored address after Swiggy "not found" / invalid id. */
  invalidateAddress: () => void;
  setRestaurant: (id: string, name: string) => void;
  addItem: (
    item: Omit<DraftCartItem, 'key' | 'quantity'> & { quantity?: number },
  ) => void;
  setQuantity: (key: string, quantity: number) => void;
  setItemSize: (key: string, size: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  buildConfirmMessage: () => string;
  /** Prompt the agent to re-fetch addresses (no sync). */
  buildRefreshAddressMessage: () => string;
}

const DraftCartContext = createContext<DraftCartContextValue | null>(null);

const DEFAULT_WEIGHT_SIZES = ['250 g', '500 g', '1 kg'];

export function itemLikelyNeedsSize(item: {
  name: string;
  size?: string;
  sizeOptions?: string[];
  tags?: string;
}): boolean {
  if (item.size) return false;
  if (item.sizeOptions && item.sizeOptions.length > 0) return true;
  const blob = `${item.name} ${item.tags || ''}`;
  return /laddu|motichoor|kalakand|halwa|barfi|burfi|rasgulla|gulab|mithai|sweet box|variant/i.test(
    blob,
  );
}

export function sizeChoicesForItem(item: {
  name: string;
  size?: string;
  sizeOptions?: string[];
  tags?: string;
}): string[] {
  if (item.sizeOptions && item.sizeOptions.length > 0) return item.sizeOptions;
  // Keep size chips visible even after a size is chosen (so user can change it).
  const looksWeighted =
    itemLikelyNeedsSize({ ...item, size: undefined }) ||
    /variant/i.test(item.tags || '');
  if (looksWeighted) return DEFAULT_WEIGHT_SIZES;
  return [];
}

function itemKey(item: {
  menuItemId?: string;
  name: string;
  size?: string;
  restaurantId?: string;
}): string {
  return [item.restaurantId || '', item.menuItemId || item.name, item.size || ''].join(
    '::',
  );
}

export function parsePrice(value?: string | number): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return undefined;
  const m = value.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : undefined;
}

export function DraftCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<DraftCartItem[]>([]);
  const [addressId, setAddressId] = useState<string | undefined>();
  const [addressLabel, setAddressLabel] = useState<string | undefined>();
  const [addressReady, setAddressReady] = useState(false);
  const [addressInvalid, setAddressInvalid] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | undefined>();
  const [restaurantName, setRestaurantName] = useState<string | undefined>();
  const [cartOpen, setCartOpen] = useState(false);

  const setAddress = useCallback((id: string, label: string) => {
    const trimmed = id.trim();
    if (!trimmed) return;
    setAddressId(trimmed);
    setAddressLabel(label);
    setAddressReady(true);
    setAddressInvalid(false);
  }, []);

  const invalidateAddress = useCallback(() => {
    setAddressId(undefined);
    setAddressReady(false);
    setAddressInvalid(true);
    // Keep label briefly so the sheet can say which one failed.
  }, []);

  const setRestaurant = useCallback((id: string, name: string) => {
    setRestaurantId((prev) => {
      if (prev && prev !== id) {
        setItems([]);
      }
      return id;
    });
    setRestaurantName(name);
  }, []);

  const addItem = useCallback(
    (item: Omit<DraftCartItem, 'key' | 'quantity'> & { quantity?: number }) => {
      const sizeOptions =
        item.sizeOptions && item.sizeOptions.length > 0
          ? item.sizeOptions
          : itemLikelyNeedsSize(item)
            ? DEFAULT_WEIGHT_SIZES
            : undefined;
      const normalized = { ...item, sizeOptions };
      const key = itemKey(normalized);
      const qty = item.quantity && item.quantity > 0 ? item.quantity : 1;
      setItems((prev) => {
        const existing = prev.find((row) => row.key === key);
        if (existing) {
          return prev.map((row) =>
            row.key === key
              ? {
                  ...row,
                  quantity: row.quantity + qty,
                  sizeOptions: row.sizeOptions?.length
                    ? row.sizeOptions
                    : sizeOptions,
                }
              : row,
          );
        }
        return [...prev, { ...normalized, key, quantity: qty }];
      });
      if (item.restaurantId) setRestaurantId(item.restaurantId);
      if (item.restaurantName) setRestaurantName(item.restaurantName);
      // Open draft when an item still needs a size so the user can pick it.
      if (!normalized.size && sizeChoicesForItem(normalized).length > 0) {
        setCartOpen(true);
      }
    },
    [],
  );

  const setQuantity = useCallback((key: string, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) return prev.filter((row) => row.key !== key);
      return prev.map((row) => (row.key === key ? { ...row, quantity } : row));
    });
  }, []);

  const setItemSize = useCallback((key: string, size: string) => {
    setItems((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        const next = { ...row, size };
        return { ...next, key: itemKey(next) };
      }),
    );
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((row) => row.key !== key));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const itemCount = useMemo(
    () => items.reduce((sum, row) => sum + row.quantity, 0),
    [items],
  );

  const estimatedTotal = useMemo(
    () => items.reduce((sum, row) => sum + (row.unitPrice ?? 0) * row.quantity, 0),
    [items],
  );

  const missingSizeCount = useMemo(
    () => items.filter((row) => itemLikelyNeedsSize(row)).length,
    [items],
  );

  const needsAddressPick = addressInvalid;

  const buildRefreshAddressMessage = useCallback(
    () =>
      [
        'My saved delivery address is missing or no longer valid.',
        'Call swiggy_get_addresses now and show fresh address cards.',
        'Do NOT call manage_cart or place_order until I tap a new address card.',
        'Do not reuse any addressId from earlier in this chat.',
        'Do not ask me to refresh the page.',
      ].join(' '),
    [],
  );

  const buildConfirmMessage = useCallback(() => {
    const lines = items.map((row) => {
      const size = row.size ? ` (${row.size})` : '';
      const idBit = row.menuItemId ? ` menu_item_id ${row.menuItemId}` : '';
      const needsOptions = !row.size && itemLikelyNeedsSize(row)
        ? ' [needs size — user will pick in draft cart]'
        : '';
      return `- ${row.name}${size} × ${row.quantity}${idBit}${needsOptions}`;
    });
    const missingOptions = items.some((row) => itemLikelyNeedsSize(row));
    if (addressInvalid) {
      return buildRefreshAddressMessage();
    }
    return [
      'Confirm and sync my draft cart to Swiggy with swiggy_manage_cart (action add), then show the priced cart.',
      addressId
        ? `addressId ${addressId}`
        : 'Use the addressId from my latest "Use address … (addressId …)" pick in this chat.',
      addressId
        ? 'Use ONLY this addressId — do not substitute an older addressId from chat history.'
        : 'Do not invent an addressId.',
      restaurantId
        ? `restaurantId ${restaurantId}${restaurantName ? ` (${restaurantName})` : ''}`
        : 'Use my previously selected restaurantId.',
      'Items:',
      ...lines,
      missingOptions
        ? 'STOP: some items still have no size. Do not call manage_cart yet. Tell me to open the draft cart and tap a size chip (250 g / 500 g / 1 kg).'
        : 'Include variants/variantsV2/addons from the latest menu search when a size is listed. Map 250 g / 500 g / 1 kg to the closest variant.',
      'If addressId fails (not found / invalid): STOP cart work, call swiggy_get_addresses, wait for me to tap a fresh card, then retry with the new addressId only. Never reuse the failed id.',
      'If a previous UPI QR / payment is pending, abandon it and rebuild the cart for this new order.',
      'After the cart shows a ₹ total, offer payment options.',
    ].join('\n');
  }, [
    items,
    addressId,
    restaurantId,
    restaurantName,
    addressInvalid,
    buildRefreshAddressMessage,
  ]);

  const value = useMemo<DraftCartContextValue>(
    () => ({
      items,
      addressId,
      addressLabel,
      addressReady,
      addressInvalid,
      needsAddressPick,
      restaurantId,
      restaurantName,
      itemCount,
      estimatedTotal,
      missingSizeCount,
      cartOpen,
      setCartOpen,
      setAddress,
      invalidateAddress,
      setRestaurant,
      addItem,
      setQuantity,
      setItemSize,
      removeItem,
      clear,
      buildConfirmMessage,
      buildRefreshAddressMessage,
    }),
    [
      items,
      addressId,
      addressLabel,
      addressReady,
      addressInvalid,
      needsAddressPick,
      restaurantId,
      restaurantName,
      itemCount,
      estimatedTotal,
      missingSizeCount,
      cartOpen,
      setAddress,
      invalidateAddress,
      setRestaurant,
      addItem,
      setQuantity,
      setItemSize,
      removeItem,
      clear,
      buildConfirmMessage,
      buildRefreshAddressMessage,
    ],
  );

  return (
    <DraftCartContext.Provider value={value}>{children}</DraftCartContext.Provider>
  );
}

export function useDraftCart(): DraftCartContextValue {
  const ctx = useContext(DraftCartContext);
  if (!ctx) throw new Error('useDraftCart must be used within DraftCartProvider');
  return ctx;
}

export function useDraftCartOptional(): DraftCartContextValue | null {
  return useContext(DraftCartContext);
}

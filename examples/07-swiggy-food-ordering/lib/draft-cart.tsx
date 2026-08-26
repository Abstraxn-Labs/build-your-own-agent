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
  restaurantId?: string;
  restaurantName?: string;
  itemCount: number;
  estimatedTotal: number;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  setAddress: (id: string, label: string) => void;
  setRestaurant: (id: string, name: string) => void;
  addItem: (
    item: Omit<DraftCartItem, 'key' | 'quantity'> & { quantity?: number },
  ) => void;
  setQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  buildConfirmMessage: () => string;
}

const DraftCartContext = createContext<DraftCartContextValue | null>(null);

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
  const [restaurantId, setRestaurantId] = useState<string | undefined>();
  const [restaurantName, setRestaurantName] = useState<string | undefined>();
  const [cartOpen, setCartOpen] = useState(false);

  const setAddress = useCallback((id: string, label: string) => {
    setAddressId(id);
    setAddressLabel(label);
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
      const key = itemKey(item);
      const qty = item.quantity && item.quantity > 0 ? item.quantity : 1;
      setItems((prev) => {
        const existing = prev.find((row) => row.key === key);
        if (existing) {
          return prev.map((row) =>
            row.key === key ? { ...row, quantity: row.quantity + qty } : row,
          );
        }
        return [...prev, { ...item, key, quantity: qty }];
      });
      if (item.restaurantId) setRestaurantId(item.restaurantId);
      if (item.restaurantName) setRestaurantName(item.restaurantName);
    },
    [],
  );

  const setQuantity = useCallback((key: string, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) return prev.filter((row) => row.key !== key);
      return prev.map((row) => (row.key === key ? { ...row, quantity } : row));
    });
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

  const buildConfirmMessage = useCallback(() => {
    const lines = items.map((row) => {
      const size = row.size ? ` (${row.size})` : '';
      const idBit = row.menuItemId ? ` menu_item_id ${row.menuItemId}` : '';
      return `- ${row.name}${size} × ${row.quantity}${idBit}`;
    });
    return [
      'Confirm and sync my draft cart to Swiggy with swiggy_manage_cart (action add), then show the priced cart.',
      addressId ? `addressId ${addressId}` : 'Use my previously selected addressId.',
      restaurantId
        ? `restaurantId ${restaurantId}${restaurantName ? ` (${restaurantName})` : ''}`
        : 'Use my previously selected restaurantId.',
      'Items:',
      ...lines,
      'Include variants/variantsV2/addons from the latest menu search when a size is listed.',
      'After the cart shows a ₹ total, offer payment options.',
    ].join('\n');
  }, [items, addressId, restaurantId, restaurantName]);

  const value = useMemo<DraftCartContextValue>(
    () => ({
      items,
      addressId,
      addressLabel,
      restaurantId,
      restaurantName,
      itemCount,
      estimatedTotal,
      cartOpen,
      setCartOpen,
      setAddress,
      setRestaurant,
      addItem,
      setQuantity,
      removeItem,
      clear,
      buildConfirmMessage,
    }),
    [
      items,
      addressId,
      addressLabel,
      restaurantId,
      restaurantName,
      itemCount,
      estimatedTotal,
      cartOpen,
      setAddress,
      setRestaurant,
      addItem,
      setQuantity,
      removeItem,
      clear,
      buildConfirmMessage,
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

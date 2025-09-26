import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Product = {
  id: string;
  name: string;
  price: number;          // dalam IDR (Rupiah)
  description?: string;
};

export type CartItem = {
  product: Product;
  qty: number;
};

type CartContextType = {
  products: Product[];
  items: CartItem[];
  add: (p: Product) => void;
  inc: (id: string) => void;
  dec: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  count: number;
  subtotal: number;
  tax: number;
  total: number;
  formatRupiah: (n: number) => string;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

// ===== Helper Rupiah =====
const formatRupiahIntl = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
});
export const formatRupiah = (n: number) => formatRupiahIntl.format(n);

// ===== Sample data (dalam Rupiah) =====
const SAMPLE_PRODUCTS: Product[] = [
  { id: 'p1', name: 'Product Name A', price: 169_500, description: 'Short description' },
  { id: 'p2', name: 'Product Name B', price: 169_500, description: 'Short description' },
  { id: 'p3', name: 'Product Name C', price: 49_000,  description: 'Short description' },
  { id: 'p4', name: 'Product Name D', price: 29_000,  description: 'Short description' },
];

const STORAGE_KEY = 'web_pg_cart';

export const CartProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items]);

  const add = (p: Product) => {
    setItems(prev => {
      const idx = prev.findIndex(ci => ci.product.id === p.id);
      if (idx >= 0) {
        const clone = [...prev];
        clone[idx] = { ...clone[idx], qty: clone[idx].qty + 1 };
        return clone;
      }
      return [...prev, { product: p, qty: 1 }];
    });
  };

  const inc = (id: string) =>
    setItems(prev => prev.map(ci => (ci.product.id === id ? { ...ci, qty: ci.qty + 1 } : ci)));
  const dec = (id: string) =>
    setItems(prev =>
      prev
        .map(ci => (ci.product.id === id ? { ...ci, qty: Math.max(0, ci.qty - 1) } : ci))
        .filter(ci => ci.qty > 0)
    );
  const remove = (id: string) => setItems(prev => prev.filter(ci => ci.product.id !== id));
  const clear = () => setItems([]);

  const subtotal = useMemo(
    () => items.reduce((s, ci) => s + ci.product.price * ci.qty, 0),
    [items]
  );
  const taxRate = 0.11; // contoh PPN 11%
  const tax = useMemo(() => Math.round(subtotal * taxRate), [subtotal]);
  const total = useMemo(() => subtotal + tax, [subtotal, tax]);
  const count = useMemo(() => items.reduce((s, ci) => s + ci.qty, 0), [items]);

  return (
    <CartContext.Provider
      value={{
        products: SAMPLE_PRODUCTS,
        items,
        add,
        inc,
        dec,
        remove,
        clear,
        count,
        subtotal,
        tax,
        total,
        formatRupiah,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};

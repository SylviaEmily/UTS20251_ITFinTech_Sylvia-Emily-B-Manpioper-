import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

/** ====== Types ====== */
export type Product = {
  id: string;
  name: string;
  price: number;          // IDR (Rupiah)
  description?: string;
  imageUrl?: string;      // URL gambar (opsional)
  category?: string;      // All/Drinks/Snacks/Bundle (opsional)
};

export type CartItem = { product: Product; qty: number };

type CartContextType = {
  // data produk
  products: Product[];
  loadingProducts: boolean;

  // cart
  items: CartItem[];
  add: (p: Product) => void;
  inc: (id: string) => void;
  dec: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;

  // ringkasan
  count: number;
  subtotal: number;
  tax: number;
  total: number;

  // helper rupiah
  formatRupiah: (n: number) => string;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

/** ====== Helper Rupiah ====== */
const formatRupiahIntl = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
});
export const formatRupiah = (n: number) => formatRupiahIntl.format(n);

/** ====== Fallback Sample (dipakai jika fetch gagal) ====== */
const SAMPLE_PRODUCTS: Product[] = [
  { id: 'p1', name: 'Product Name A', price: 169_500, description: 'Short description', imageUrl: '/images/prod-a.jpg', category: 'Drinks' },
  { id: 'p2', name: 'Product Name B', price: 169_500, description: 'Short description', imageUrl: '/images/prod-b.jpg', category: 'Snacks' },
  { id: 'p3', name: 'Product Name C', price: 49_000,  description: 'Short description', imageUrl: '/images/prod-c.jpg', category: 'All' },
  { id: 'p4', name: 'Product Name D', price: 29_000,  description: 'Short description', imageUrl: '/images/prod-d.jpg', category: 'All' },
];

const STORAGE_KEY = 'web_pg_cart';

/** ====== Provider ====== */
export const CartProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Product[]>(SAMPLE_PRODUCTS);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(true);

  // Load cart from localStorage
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

  // Fetch products from backend (MongoDB) -> fallback ke SAMPLE_PRODUCTS bila gagal
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingProducts(true);
        const res = await fetch('/api/products'); // pastikan API ini sudah ada
        if (!res.ok) throw new Error('Failed to fetch products');
        const data = await res.json();
        if (!mounted) return;

        const mapped: Product[] = (Array.isArray(data) ? data : []).map((p: any) => ({
          id: String(p._id ?? p.id),
          name: p.name,
          price: Number(p.price),
          description: p.description ?? '',
          imageUrl: p.imageUrl ?? '',
          category: p.category ?? 'All',
        }));

        if (mapped.length > 0) setProducts(mapped);
        else setProducts(SAMPLE_PRODUCTS);
      } catch (e) {
        console.warn('Fetch products failed, using SAMPLE_PRODUCTS. Reason:', (e as Error)?.message);
        setProducts(SAMPLE_PRODUCTS);
      } finally {
        setLoadingProducts(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  /** ====== Cart ops ====== */
  const add = (p: Product) => {
    setItems((prev) => {
      const idx = prev.findIndex((ci) => ci.product.id === p.id);
      if (idx >= 0) {
        const clone = [...prev];
        clone[idx] = { ...clone[idx], qty: clone[idx].qty + 1 };
        return clone;
      }
      return [...prev, { product: p, qty: 1 }];
    });
  };

  const inc = (id: string) =>
    setItems((prev) => prev.map((ci) => (ci.product.id === id ? { ...ci, qty: ci.qty + 1 } : ci)));

  const dec = (id: string) =>
    setItems((prev) =>
      prev
        .map((ci) => (ci.product.id === id ? { ...ci, qty: Math.max(0, ci.qty - 1) } : ci))
        .filter((ci) => ci.qty > 0)
    );

  const remove = (id: string) => setItems((prev) => prev.filter((ci) => ci.product.id !== id));
  const clear = () => setItems([]);

  /** ====== Summary ====== */
  const subtotal = useMemo(() => items.reduce((s, ci) => s + ci.product.price * ci.qty, 0), [items]);
  const taxRate = 0.11; // PPN 11%
  const tax = useMemo(() => Math.round(subtotal * taxRate), [subtotal]);
  const total = useMemo(() => subtotal + tax, [subtotal, tax]);
  const count = useMemo(() => items.reduce((s, ci) => s + ci.qty, 0), [items]);

  return (
    <CartContext.Provider
      value={{
        products,
        loadingProducts,
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

/** ====== Hook ====== */
export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};

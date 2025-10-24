// hooks/useProducts.ts
import useSWR, { type BareFetcher } from "swr";
import { clientFetchJSON } from "@/lib/clientFetch";

export type ProductRow = {
  _id: string;
  name: string;
  price: number;
  description?: string;
  imageUrl?: string;
  category?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ApiList<T> = { data: T[] };
type ApiOne<T>  = { data: T };

const LIST_URL = "/api/admin-proxy/products";
const ONE_URL  = (id: string) => `/api/admin-proxy/products/${id}`;

// ✅ Tulis fetcher dengan tipe yang benar
const listFetcher: BareFetcher<ApiList<ProductRow>> = (url: string) =>
  clientFetchJSON<ApiList<ProductRow>>(url);

export function useProducts() {
  // ✅ Sekarang SWR tahu argumen ke-2 adalah fetcher, bukan config
  const { data, error, isLoading, mutate } =
    useSWR<ApiList<ProductRow>>(LIST_URL, listFetcher);

  const products: ProductRow[] = data?.data ?? [];

  // --- CREATE
  async function createProduct(payload: {
    name: string;
    price: number;
    description?: string;
    imageUrl?: string;
    category?: string;
    isActive?: boolean;
  }): Promise<ProductRow> {
    if (!payload.name?.trim()) throw new Error("Nama produk wajib diisi");
    if (!Number.isFinite(payload.price) || payload.price <= 0)
      throw new Error("Harga harus > 0");

    const optimistic: ProductRow[] = [
      ...products,
      {
        _id: `tmp-${Date.now()}`,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...payload,
      },
    ];

    await mutate({ data: optimistic }, { revalidate: false });

    try {
      const res = await clientFetchJSON<ApiOne<ProductRow>>(LIST_URL, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await mutate();
      return res.data;
    } catch (e) {
      await mutate(); // rollback
      throw e;
    }
  }

  // --- UPDATE (partial)
  async function updateProduct(id: string, patch: Partial<ProductRow>): Promise<ProductRow> {
    const optimistic = products.map((p) =>
      p._id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p
    );

    await mutate({ data: optimistic }, { revalidate: false });

    try {
      const res = await clientFetchJSON<ApiOne<ProductRow>>(ONE_URL(id), {
        method: "PUT",
        body: JSON.stringify(patch),
      });
      await mutate();
      return res.data;
    } catch (e) {
      await mutate(); // rollback
      throw e;
    }
  }

  // --- TOGGLE ACTIVE
  async function toggleActive(p: ProductRow): Promise<void> {
    await updateProduct(p._id, { isActive: !p.isActive });
  }

  // --- DELETE
  async function removeProduct(id: string): Promise<void> {
    const optimistic = products.filter((p) => p._id !== id);
    await mutate({ data: optimistic }, { revalidate: false });

    try {
      await clientFetchJSON(ONE_URL(id), { method: "DELETE" });
      await mutate();
    } catch (e) {
      await mutate(); // rollback
      throw e;
    }
  }

  return {
    products,
    isLoading,
    error: error as Error | undefined,
    createProduct,
    updateProduct,
    toggleActive,
    removeProduct,
    refresh: () => mutate(),
  };
}

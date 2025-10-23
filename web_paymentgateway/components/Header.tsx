import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/context/CartContext';

type Props = {
  showMenu?: boolean; // default true
};

export default function Header({ showMenu = true }: Props) {
  const { count } = useCart();

  return (
    <div className="flex items-center justify-between rounded-2xl border p-3 shadow-sm">
      <div className="flex items-center gap-2">
        {showMenu && (
          <button
            aria-label="menu"
            className="grid h-9 w-9 place-items-center rounded-lg border"
          >
            ☰
          </button>
        )}
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/images/logo.png"
            alt="Logo"
            width={60}
            height={60}
            className="h-[60px] w-[60px]"
          />
        </Link>
      </div>

      <div className="flex items-center gap-2">
        {/* Register & Login di header */}
        <Link
          href="/register"
          className="px-3 py-2 rounded-lg border hover:bg-gray-50 text-sm"
        >
          Register
        </Link>
        <Link
          href="/login"
          className="px-3 py-2 rounded-lg border bg-black text-white hover:opacity-90 text-sm"
        >
          Login
        </Link>

        {/* Keranjang: selalu link ke /checkout.
            Jika belum login, middleware/SSR akan redirect ke /login?from=/checkout */}
        <Link
          href="/checkout"
          className="relative grid h-9 w-9 place-items-center rounded-lg border"
          aria-label="Keranjang"
          title="Keranjang"
        >
          🛒
          {count > 0 && (
            <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-black px-1 text-center text-[10px] font-semibold text-white">
              {count}
            </span>
          )}
        </Link>
      </div>
    </div>
  );
}

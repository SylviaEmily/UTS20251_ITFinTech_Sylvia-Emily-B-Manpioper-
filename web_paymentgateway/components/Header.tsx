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
        {/* Logo dengan ukuran lebih kecil */}
        <Image
          src="/images/logo.png"
          alt="Logo"
          width={60} // misalnya 80px
          height={30} // misalnya 30px
          className="h-[60px] w-[60px]" // supaya rasio tetap
        />
      </div>

      <Link
        href="/checkout"
        className="relative grid h-9 w-9 place-items-center rounded-lg border"
      >
        🛒
        {count > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-black px-1 text-center text-[10px] font-semibold text-white">
            {count}
          </span>
        )}
      </Link>
    </div>
  );
}

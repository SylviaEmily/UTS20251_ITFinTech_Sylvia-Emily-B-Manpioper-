import type { NextApiRequest, NextApiResponse } from 'next';
import { dbConnect } from '@/lib/mongodb';
import Product from '@/models/product';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });
  await dbConnect();

  const demo = [
    {
      name: 'Kaos Hitam, ',
      price: 169_500,
      description: 'Kaos berbahan lembut',
      imageUrl: '/images/bajukaos.jpeg',
      category: 'baju',
    },
    {
      name: 'topi',
      price: 49_000,
      description: 'topi keren',
      imageUrl: '/images/topihitam.jpeg',
      category: 'All',
    },
    {
    name: 'Kaos Polos Katun Premium',
    price: 85_000,
    description: 'Kaos polos bahan katun combed 30s, nyaman dipakai sehari-hari.',
    imageUrl: '/images/kaospolos.jpeg',
    category: 'baju',
  },
  {
    name: 'Kemeja Flanel Kotak-Kotak',
    price: 169_500,
    description: 'Kemeja flanel motif kotak-kotak, cocok untuk tampilan casual.',
    imageUrl: '/images/kemeja-flanel.jpeg',
    category: 'baju',
  },
  {
    name: 'Celana Jeans Slim Fit',
    price: 235_000,
    description: 'Celana jeans slim fit warna biru navy, awet dan stylish.',
    imageUrl: '/images/celanajeans.jpeg',
    category: 'celana',
  },
  {
    name: 'Celana Chino Pria',
    price: 199_000,
    description: 'Celana chino bahan twill, nyaman untuk kerja maupun santai.',
    imageUrl: '/images/celanachino.jpeg',
    category: 'celana',
  },
  {
    name: 'Hoodie Oversize Unisex',
    price: 185_000,
    description: 'Hoodie oversize dengan bahan fleece, hangat dan trendy.',
    imageUrl: '/images/hoodie.jpeg',
    category: 'baju',
  },
  {
    name: 'Sneakers Putih Classic',
    price: 320_000,
    description: 'Sepatu sneakers putih klasik, cocok untuk semua outfit.',
    imageUrl: '/images/sneakers-putih.jpeg',
    category: 'sepatu',
  },
  {
    name: 'Topi Baseball',
    price: 55_000,
    description: 'Topi baseball, adjustable strap di belakang.',
    imageUrl: '/images/topibaseball.jpeg',
    category: 'aksesoris',
  },
  {
    name: 'Tas Ransel Canvas',
    price: 210_000,
    description: 'Ransel bahan canvas kuat dengan banyak kantong penyimpanan.',
    imageUrl: '/images/tasransel.jpeg',
    category: 'tas',
  },
  {
    name: 'Sepatu Slip On Denim',
    price: 275_000,
    description: 'Sepatu slip on denim, ringan dan nyaman untuk sehari-hari.',
    imageUrl: '/images/slipon.jpeg',
    category: 'sepatu',
  },
  {
    name: 'Kacamata Hitam Aviator',
    price: 95_000,
    description: 'Kacamata hitam model aviator dengan frame metal ringan.',
    imageUrl: '/images/kacamata.jpeg',
    category: 'aksesoris',
  },
  ];

  // idempotent: hapus contoh lama berdasarkan nama
  await Product.deleteMany({ name: { $in: demo.map(d => d.name) } });
  const created = await Product.insertMany(demo);
  return res.status(201).json({ inserted: created.length });
}

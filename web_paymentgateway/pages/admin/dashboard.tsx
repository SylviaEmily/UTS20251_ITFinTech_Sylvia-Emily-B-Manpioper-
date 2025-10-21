// pages/admin/dashboard.tsx
import type { GetServerSideProps } from 'next';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET as string;

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const token = req.cookies?.auth_token;
  if (!token) {
    return { redirect: { destination: '/auth/login', permanent: false } };
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.role !== 'admin') {
      return { redirect: { destination: '/', permanent: false } };
    }
    return { props: {} };
  } catch {
    return { redirect: { destination: '/auth/login', permanent: false } };
  }
};

export default function Dashboard() {
  return <div>Dashboard Admin</div>;
}

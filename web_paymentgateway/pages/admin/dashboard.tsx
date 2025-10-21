// pages/admin/dashboard.tsx
import type { GetServerSideProps } from 'next';
import jwt, { JwtPayload } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? '';

type AppJwtPayload = JwtPayload & { role?: string };

function hasRole(payload: string | JwtPayload): payload is AppJwtPayload {
  return typeof payload === 'object' && payload !== null && 'role' in payload;
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const token = req.cookies?.auth_token;

  // Tidak ada token atau secret → paksa login
  if (!token || !JWT_SECRET) {
    return { redirect: { destination: '/auth/login', permanent: false } };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Pastikan payload object & punya field role
    if (!hasRole(decoded) || decoded.role !== 'admin') {
      return { redirect: { destination: '/', permanent: false } };
    }

    return { props: {} };
  } catch {
    // Token invalid/expired → paksa login
    return { redirect: { destination: '/auth/login', permanent: false } };
  }
};

export default function Dashboard() {
  return <div>Dashboard Admin</div>;
}

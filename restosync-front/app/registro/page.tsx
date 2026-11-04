import { Suspense } from 'react';
import RegistroClient from './registro-client';

export default function RegistroPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-resto-manteca flex items-center justify-center text-resto-ciruela">
          <p>Cargando registro...</p>
        </main>
      }
    >
      <RegistroClient />
    </Suspense>
  );
}

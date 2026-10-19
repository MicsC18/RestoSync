
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [nombreRestaurante, setNombreRestaurante] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(apiUrl('/api/v1/auth/register'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            contrasena,
            nombreRestaurante,
          }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || 'Error al registrar el usuario'
        );
      }

      if (typeof data.token !== 'string') {
        throw new Error('El backend no devolvió una sesión válida.');
      }

      localStorage.setItem('token', data.token);
      router.push('/dashboard');

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al registrar el usuario');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-resto-manteca flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">

        {/* Título */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-resto-ciruela">
            Crear cuenta
          </h1>

          <p className="text-resto-acero mt-2">
            Registrá tu restaurante en RestoSync
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleRegister} className="space-y-5">

          {/* Nombre restaurante */}
          <div>
            <label
              htmlFor="nombreRestaurante"
              className="block text-sm font-medium text-resto-ciruela mb-2"
            >
              Nombre del restaurante
            </label>

            <input
              id="nombreRestaurante"
              type="text"
              value={nombreRestaurante}
              onChange={(e) => setNombreRestaurante(e.target.value)}
              placeholder="Ej: La Esquina"
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-3
                         text-resto-ciruela
                         focus:outline-none focus:ring-2 focus:ring-resto-oliva
                         focus:border-resto-oliva"
            />
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-resto-ciruela mb-2"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tuemail@gmail.com"
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-3
                         text-resto-ciruela
                         focus:outline-none focus:ring-2 focus:ring-resto-oliva
                         focus:border-resto-oliva"
            />
          </div>

          {/* Contraseña */}
          <div>
            <label
              htmlFor="contrasena"
              className="block text-sm font-medium text-resto-ciruela mb-2"
            >
              Contraseña
            </label>

            <input
              id="contrasena"
              type="password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              placeholder="********"
              required
              minLength={6}
              className="w-full rounded-lg border border-gray-300 px-4 py-3
                         text-resto-ciruela
                         focus:outline-none focus:ring-2 focus:ring-resto-oliva
                         focus:border-resto-oliva"
            />

            <p className="text-xs text-resto-acero mt-2">
              La contraseña debe tener al menos 6 caracteres.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-100 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Botón */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-resto-oliva text-white py-3 rounded-lg
                       font-semibold transition duration-200
                       hover:bg-resto-dorado
                       disabled:opacity-50
                       disabled:cursor-not-allowed"
          >
            {loading ? 'Registrando...' : 'Crear cuenta'}
          </button>

        </form>

        {/* Link al login */}
        <div className="text-center mt-6">
          <p className="text-sm text-resto-acero">
            ¿Ya tenés una cuenta?{' '}
            <a
              href="/login"
              className="font-semibold text-resto-oliva hover:text-resto-dorado transition"
            >
              Iniciá sesión
            </a>
          </p>
        </div>

      </div>
    </main>
  );
}

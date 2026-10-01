
'use client';

import { useState, FormEvent } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(
        'http://localhost:8080/api/v1/auth/login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            contrasena,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || 'Error al iniciar sesión'
        );
      }

      localStorage.setItem('token', data.token);

      alert('¡Login exitoso! Bienvenido a RestoSync.');
      window.location.href = '/dashboard';

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-resto-manteca flex items-center justify-center p-4 md:p-8">

      <div className="w-full max-w-6xl min-h-[680px] bg-resto-manteca rounded-[2rem] overflow-hidden shadow-2xl grid grid-cols-1 lg:grid-cols-2 border border-resto-ciruela/10">

        <section className="relative bg-resto-ciruela text-resto-manteca p-10 md:p-14 flex flex-col justify-between overflow-hidden">

          {/* Decoración */}
          <div className="absolute -bottom-32 -right-20 w-80 h-80 rounded-full bg-resto-dorado/20" />
          <div className="absolute top-1/2 -right-24 w-48 h-48 rounded-full border border-resto-dorado/20" />

          {/* Marca */}
          <div className="relative z-10">

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-resto-dorado/30 bg-resto-dorado/10 text-resto-dorado text-sm font-medium mb-8">
              <span className="w-2 h-2 rounded-full bg-resto-dorado" />
              Plataforma Gastronómica
            </div>

            <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-none">
              Resto<span className="text-resto-dorado">Sync.</span>
            </h1>

            <div className="w-16 h-1 bg-resto-dorado rounded-full mt-6 mb-8" />

            <p className="max-w-md text-lg md:text-xl leading-relaxed text-resto-manteca/80">
              “La sincronización perfecta entre la cocina,
              el salón y la administración de tu restaurante.”
            </p>
          </div>

          {/* Concepto visual */}
          <div className="relative z-10 my-10">

            <div className="grid grid-cols-3 gap-3 max-w-md">

              <div className="rounded-2xl border border-resto-manteca/10 bg-resto-manteca/5 p-4">
                <div className="text-2xl mb-3">🍽️</div>
                <p className="text-sm font-semibold">
                  Salón
                </p>
                <p className="text-xs text-resto-manteca/50 mt-1">
                  Pedidos
                </p>
              </div>

              <div className="rounded-2xl border border-resto-manteca/10 bg-resto-manteca/5 p-4">
                <div className="text-2xl mb-3">👨‍🍳</div>
                <p className="text-sm font-semibold">
                  Cocina
                </p>
                <p className="text-xs text-resto-manteca/50 mt-1">
                  Producción
                </p>
              </div>

              <div className="rounded-2xl border border-resto-manteca/10 bg-resto-manteca/5 p-4">
                <div className="text-2xl mb-3">📊</div>
                <p className="text-sm font-semibold">
                  Gestión
                </p>
                <p className="text-xs text-resto-manteca/50 mt-1">
                  Control
                </p>
              </div>

            </div>

            <div className="flex items-center gap-3 mt-6 text-sm text-resto-dorado">
              <div className="h-px w-10 bg-resto-dorado/50" />
              Todo conectado.
              <div className="h-px w-10 bg-resto-dorado/50" />
            </div>

          </div>

          {/* Footer */}
          <div className="relative z-10 text-sm text-resto-manteca/40">
            © 2026 RestoSync. Todos los derechos reservados.
          </div>

        </section>


      
        <section className="bg-resto-manteca p-8 md:p-14 flex items-center justify-center">

          <div className="w-full max-w-md">

            {/* Encabezado */}
            <div className="mb-8">

              <h2 className="text-4xl md:text-5xl font-black text-resto-ciruela mt-3">
                Bienvenido
                <br />
                de nuevo.
              </h2>

              <p className="text-resto-acero mt-4 leading-relaxed">
                Ingresá tus credenciales para administrar
                tu local y mantener todo bajo control.
              </p>

            </div>


            {/* Error */}
            {error && (
              <div className="mb-6 rounded-xl border border-resto-dorado/40 bg-resto-dorado/10 px-4 py-3 text-sm text-resto-ciruela">
                {error}
              </div>
            )}


            {/* Formulario */}
            <form onSubmit={handleLogin} className="space-y-6">

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-semibold text-resto-ciruela mb-2"
                >
                  Correo Electrónico
                </label>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@tu-restaurante.com"
                  required
                  className="w-full rounded-xl border border-resto-acero/20 px-4 py-3.5 bg-resto-manteca/40 text-resto-ciruela placeholder:text-resto-acero/50 focus:outline-none focus:ring-2 focus:ring-resto-oliva focus:border-resto-oliva transition-all"
                />
              </div>


              {/* Contraseña */}
              <div>
                <div className="flex items-center justify-between mb-2">

                  <label
                    htmlFor="contrasena"
                    className="block text-sm font-semibold text-resto-ciruela"
                  >
                    Contraseña
                  </label>

                  <a
                    href="#"
                    className="text-xs font-semibold text-resto-oliva hover:text-resto-dorado transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </a>

                </div>

                <input
                  id="contrasena"
                  type="password"
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-xl border border-resto-acero/20 px-4 py-3.5 bg-resto-manteca/40 text-resto-ciruela placeholder:text-resto-acero/50 focus:outline-none focus:ring-2 focus:ring-resto-oliva focus:border-resto-oliva transition-all"
                />
              </div>


              {/* Botón */}
              <button
                type="submit"
                disabled={loading}
                className="group w-full bg-resto-oliva text-resto-manteca py-4 rounded-xl font-bold text-base hover:bg-resto-dorado hover:text-resto-ciruela transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-resto-oliva/10"
              >
                <span className="flex items-center justify-center gap-3">
                  {loading
                    ? 'Verificando credenciales...'
                    : 'Iniciar Sesión'}

                  {!loading && (
                    <span className="text-lg group-hover:translate-x-1 transition-transform">
                      →
                    </span>
                  )}
                </span>
              </button>

            </form>


            {/* Registro */}
            <div className="mt-8 pt-6 border-t border-resto-acero/15 text-center">

              <p className="text-sm text-resto-acero">
                ¿Tu local aún no forma parte?{' '}
                <a
                  href="/register"
                  className="font-bold text-resto-oliva hover:text-resto-dorado transition-colors"
                >
                  Registrar restaurante
                </a>
              </p>

            </div>

          </div>

        </section>

      </div>

    </main>
  );
}


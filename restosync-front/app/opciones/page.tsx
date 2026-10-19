'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuthSession } from '@/lib/use-auth-session';
import AppNavigation from '@/components/app-navigation';

export default function OpcionesPage() {
  const { token, checking, logout } = useAuthSession();
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('user_gemini_api_key', apiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (checking || !token) {
    return (
      <main className="min-h-screen bg-resto-manteca flex items-center justify-center text-resto-ciruela">
        <p>Verificando sesión...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-resto-manteca text-resto-ciruela">
      {/* NAVBAR */}
      <header className="sticky top-0 z-50 border-b border-resto-ciruela/10 bg-resto-manteca/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-20 flex items-center justify-between">
          <Link href="/dashboard" className="shrink-0">
            <h1 className="text-2xl font-black tracking-tight">
              Resto<span className="text-resto-dorado">Sync.</span>
            </h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-resto-acero">Tu cocina sincronizada</p>
          </Link>

          <AppNavigation activePage="opciones" onLogout={logout} />
        </div>
      </header>

      {/* CONTENIDO */}
      <section className="max-w-3xl mx-auto px-6 lg:px-10 py-12">
        <div className="mb-10">
          <h2 className="text-4xl font-black leading-tight">
            Configuración de <span className="text-resto-oliva">Mi Cuenta.</span>
          </h2>
          <p className="mt-4 text-resto-acero text-lg">
            Administra tus preferencias, integraciones y seguridad del sistema.
          </p>
        </div>

        <div className="bg-white rounded-[2rem] border border-resto-ciruela/10 p-8 shadow-sm">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-resto-ciruela/10">
            <div className="w-12 h-12 rounded-xl bg-resto-dorado/20 flex items-center justify-center text-2xl shrink-0">
              🔑
            </div>
            <div>
              <h3 className="text-xl font-bold">Inteligencia Artificial (Gemini API)</h3>
              <p className="text-sm text-resto-acero mt-1">Configura tu propia clave para procesar los tickets.</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label htmlFor="apiKey" className="block text-sm font-bold mb-2">
                Google Gemini API Key
              </label>
              <input
                id="apiKey"
                type="password"
                placeholder="AIzaSyA..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full bg-resto-manteca/50 border border-resto-ciruela/20 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-resto-oliva focus:ring-1 focus:ring-resto-oliva transition-all"
              />
              <p className="text-xs text-resto-acero mt-2">
                Esta clave se guardará localmente de forma segura. El microservicio la utilizará para los escaneos de cámara.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-resto-oliva text-resto-manteca font-bold hover:bg-resto-dorado hover:text-resto-ciruela transition-all"
              >
                Guardar cambios
              </button>
              {saved && (
                <span className="text-sm font-bold text-resto-oliva flex items-center gap-1 animate-pulse">
                  ✓ Clave guardada con éxito
                </span>
              )}
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

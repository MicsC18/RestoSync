'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function OpcionesPage() {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Solo verificamos si existe para dar feedback visual, pero NO la mostramos
    const savedKey = localStorage.getItem('user_gemini_api_key');
    if (savedKey) {
      setApiKey('••••••••••••••••••••••••••••••••••••••');
    }
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('user_gemini_api_key', apiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

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

          <nav className="hidden md:flex items-center gap-2">
            <Link href="/dashboard" className="px-4 py-2 rounded-xl text-resto-ciruela text-sm font-semibold hover:bg-resto-oliva/10 transition-colors">Inicio</Link>
            <Link href="/inventario" className="px-4 py-2 rounded-xl text-resto-ciruela text-sm font-semibold hover:bg-resto-oliva/10 transition-colors">Inventario</Link>
            <Link href="/registro?modo=ticket" className="px-4 py-2 rounded-xl text-resto-ciruela text-sm font-semibold hover:bg-resto-oliva/10 transition-colors">Agregar compra</Link>
            <Link href="/analitica" className="px-4 py-2 rounded-xl text-resto-ciruela text-sm font-semibold hover:bg-resto-oliva/10 transition-colors">Analítica</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/opciones" className="hidden lg:flex items-center gap-3 px-4 py-2 rounded-xl border border-resto-oliva bg-resto-oliva/5">
              <div className="w-8 h-8 rounded-full bg-resto-oliva text-resto-manteca flex items-center justify-center font-bold">M</div>
              <div>
                <p className="text-xs font-bold text-resto-ciruela">Mi cocina</p>
                <p className="text-[10px] text-resto-acero">Configuración</p>
              </div>
            </Link>
            <Link href="/login" className="text-xs font-bold text-resto-ciruela px-3 py-2 rounded-lg hover:bg-resto-ciruela hover:text-resto-manteca transition-all">Salir</Link>
          </div>
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

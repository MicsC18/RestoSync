'use client';

import { useEffect, useState } from 'react';
import { useAuthSession } from '@/lib/use-auth-session';
import AppHeader from '@/components/app-header';
import { aiServiceUrl } from '@/lib/api';
import { usarMockIa } from '@/lib/ia-mock';

type EstadoIA = 'verificando' | 'conectado' | 'desconectado';

export default function OpcionesPage() {
  const {
    token,
    checking,
    logout,
    sesion,
    localActivoId,
    setLocalActivoId,
  } = useAuthSession();

  const [estadoIa, setEstadoIa] = useState<EstadoIA>('verificando');
  const [esMock, setEsMock] = useState(false);

  useEffect(() => {
    // Limpieza de cualquier clave legacy guardada previamente en el navegador
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user_gemini_api_key');
      setEsMock(usarMockIa());
    }

    // Verificación de conectividad con el microservicio de IA
    const verificarIa = async () => {
      try {
        const res = await fetch(aiServiceUrl('/'), { method: 'GET' });
        if (res.ok) {
          setEstadoIa('conectado');
        } else {
          setEstadoIa('desconectado');
        }
      } catch {
        setEstadoIa('desconectado');
      }
    };

    void verificarIa();
  }, []);

  if (checking || !token) {
    return (
      <main className="min-h-screen bg-resto-manteca flex items-center justify-center text-resto-ciruela">
        <p>Verificando sesión...</p>
      </main>
    );
  }

  const rolLegible =
    sesion?.rol === 'ADMIN_RESTAURANTE'
      ? 'Administrador del Restaurante'
      : 'Gerente de Local';

  return (
    <main className="min-h-screen bg-resto-manteca text-resto-ciruela">
      <AppHeader
        activePage="opciones"
        onLogout={logout}
        rol={sesion?.rol}
        locales={sesion?.locales ?? []}
        localActivoId={localActivoId}
        onLocalChange={setLocalActivoId}
      />

      <section className="max-w-4xl mx-auto px-6 lg:px-10 py-12">
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-resto-dorado/10 border border-resto-dorado/20 text-resto-dorado text-xs font-bold uppercase tracking-wider mb-4">
            <span className="w-2 h-2 rounded-full bg-resto-dorado" />
            Configuración del Sistema
          </div>
          <h2 className="text-4xl font-black leading-tight">
            Preferencias e <span className="text-resto-oliva">Integraciones.</span>
          </h2>
          <p className="mt-4 text-resto-acero text-lg">
            Consultá el estado de los servicios conectados y los datos de tu cuenta.
          </p>
        </div>

        <div className="space-y-6">
          {/* TARJETA 1: INTELIGENCIA ARTIFICIAL */}
          <div className="bg-white rounded-[2rem] border border-resto-ciruela/10 p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-resto-ciruela/10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-resto-dorado/20 flex items-center justify-center text-2xl shrink-0">
                  ✨
                </div>
                <div>
                  <h3 className="text-xl font-bold">Motor de IA (Google Gemini)</h3>
                  <p className="text-sm text-resto-acero mt-0.5">
                    Extracción inteligente de insumos y fechas desde tickets de compra.
                  </p>
                </div>
              </div>

              <div>
                {esMock ? (
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-resto-dorado/20 text-resto-dorado text-xs font-bold">
                    <span className="w-2 h-2 rounded-full bg-resto-dorado" />
                    Modo Mock (Desarrollo)
                  </span>
                ) : estadoIa === 'conectado' ? (
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-resto-oliva/15 text-resto-oliva text-xs font-bold">
                    <span className="w-2 h-2 rounded-full bg-resto-oliva" />
                    Servicio en línea (Puerto 8000)
                  </span>
                ) : estadoIa === 'verificando' ? (
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-resto-acero/20 text-resto-acero text-xs font-bold">
                    <span className="w-2 h-2 rounded-full bg-resto-acero animate-ping" />
                    Verificando...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    Microservicio desconectado
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-resto-manteca/60 border border-resto-ciruela/10 p-5 space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <span className="text-lg">🛡️</span>
                <div>
                  <p className="font-bold text-resto-ciruela">
                    Seguridad y gestión centralizada de credenciales
                  </p>
                  <p className="text-resto-acero text-xs mt-1 leading-relaxed">
                    Por arquitectura de seguridad, la clave <code className="bg-resto-ciruela/5 px-1.5 py-0.5 rounded text-resto-ciruela font-mono font-bold">GEMINI_API_KEY</code> se administra exclusivamente en el servidor dentro de <code className="bg-resto-ciruela/5 px-1.5 py-0.5 rounded text-resto-ciruela font-mono">restosync-ia/.env</code>. De esta manera tus credenciales nunca se exponen al navegador ni pueden ser interceptadas por terceros.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-resto-ciruela/10 flex flex-wrap items-center justify-between text-xs text-resto-acero gap-2">
                <span>Endpoint de procesamiento: <code className="font-mono text-resto-ciruela">POST /api/v1/ia/escanear-ticket</code></span>
                <span>Modelos soportados: <strong className="text-resto-ciruela">Gemini Flash Multimodal</strong></span>
              </div>
            </div>
          </div>

          {/* TARJETA 2: PERFIL Y CUENTA */}
          <div className="bg-white rounded-[2rem] border border-resto-ciruela/10 p-8 shadow-sm">
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-resto-ciruela/10">
              <div className="w-12 h-12 rounded-xl bg-resto-oliva/20 flex items-center justify-center text-2xl shrink-0">
                👤
              </div>
              <div>
                <h3 className="text-xl font-bold">Datos de la Sesión</h3>
                <p className="text-sm text-resto-acero mt-0.5">Información sobre tu usuario y permisos activos.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="p-4 rounded-xl bg-resto-manteca/50 border border-resto-ciruela/10">
                <span className="text-xs text-resto-acero uppercase font-bold block mb-1">Restaurante</span>
                <span className="font-black text-lg text-resto-ciruela">{sesion?.restauranteNombre ?? '—'}</span>
              </div>

              <div className="p-4 rounded-xl bg-resto-manteca/50 border border-resto-ciruela/10">
                <span className="text-xs text-resto-acero uppercase font-bold block mb-1">Rol en el Sistema</span>
                <span className="font-bold text-resto-oliva block">{rolLegible}</span>
              </div>

              <div className="p-4 rounded-xl bg-resto-manteca/50 border border-resto-ciruela/10">
                <span className="text-xs text-resto-acero uppercase font-bold block mb-1">Email Registrado</span>
                <span className="font-medium text-resto-ciruela break-all">{sesion?.email ?? '—'}</span>
              </div>

              <div className="p-4 rounded-xl bg-resto-manteca/50 border border-resto-ciruela/10">
                <span className="text-xs text-resto-acero uppercase font-bold block mb-1">Locales Disponibles</span>
                <span className="font-medium text-resto-ciruela">
                  {sesion?.locales?.length ? `${sesion.locales.length} sucursal(es)` : 'Sin sucursales creadas'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

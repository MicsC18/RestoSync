'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuthSession } from '@/lib/use-auth-session';
import { apiUrl, authHeaders } from '@/lib/api';
import { formatearCantidad } from '@/lib/numero';
import { etiquetaUnidad } from '@/lib/insumos';
import AppHeader from '@/components/app-header';

type Insumo = {
  id: number;
  nombre: string;
  categoria: string | null;
  icono: string | null;
  unidadMedida: string;
  stockMinimo: number | null;
  cantidad: number | null;
  diasRestantes: number;
};

type Plato = { id: number; nombre: string; activo: boolean };

type Mesa = { id: number; nombre: string; estado: 'LIBRE' | 'OCUPADA' | 'RESERVADA' };

type Produccion = {
  id: number;
  platoNombre: string;
  cantidad: number;
  mesaNombre: string | null;
  fechaHora: string;
};

// Colores fijos para las barras de categoría (clases completas para Tailwind).
const COLORES = [
  { barra: 'bg-resto-oliva', punto: 'bg-resto-oliva' },
  { barra: 'bg-resto-dorado', punto: 'bg-resto-dorado' },
  { barra: 'bg-resto-ciruela', punto: 'bg-resto-ciruela' },
  { barra: 'bg-resto-acero', punto: 'bg-resto-acero' },
];

// `cantidadLegible` es el formateador compartido (`lib/numero`); se lo re-exporta con el
// nombre que ya usaban las vistas de esta pantalla.
const cantidadLegible = formatearCantidad;

export default function AnaliticaPage() {
  const { token, checking, logout, sesion, localActivoId, setLocalActivoId } = useAuthSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [platos, setPlatos] = useState<Plato[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [producciones, setProducciones] = useState<Produccion[]>([]);

  useEffect(() => {
    if (!token || localActivoId == null) return;
    let activo = true;
    setLoading(true);
    setError('');

    const headers = authHeaders(token, localActivoId);
    const pedir = async <T,>(path: string): Promise<T[]> => {
      const respuesta = await fetch(apiUrl(path), { headers });
      if (!respuesta.ok) throw new Error(`No se pudo cargar ${path}`);
      return (await respuesta.json()) as T[];
    };

    Promise.all([
      pedir<Insumo>('/api/v1/insumos'),
      pedir<Plato>('/api/v1/platos'),
      pedir<Mesa>('/api/v1/mesas'),
      pedir<Produccion>('/api/v1/producciones'),
    ])
      .then(([ins, pla, mes, pro]) => {
        if (!activo) return;
        setInsumos(ins);
        setPlatos(pla);
        setMesas(mes);
        setProducciones(pro);
      })
      .catch(() => {
        if (activo) setError('No pudimos cargar los datos del local. Revisá que el backend esté corriendo.');
      })
      .finally(() => {
        if (activo) setLoading(false);
      });

    return () => {
      activo = false;
    };
  }, [token, localActivoId]);

  if (checking || !token) {
    return (
      <main className="min-h-screen bg-resto-manteca flex items-center justify-center text-resto-ciruela">
        <p role="status">Verificando sesión...</p>
      </main>
    );
  }

  // Métricas reales del local activo (sin predicciones de IA).
  const conStock = insumos.filter((i) => (i.cantidad ?? 0) > 0);
  const porVencer = conStock.filter((i) => i.diasRestantes >= 0 && i.diasRestantes <= 3);
  const vencidos = conStock.filter((i) => i.diasRestantes < 0);
  const platosActivos = platos.filter((p) => p.activo);
  const mesasOcupadas = mesas.filter((m) => m.estado === 'OCUPADA');

  // Reposición sugerida por regla simple: stock por debajo del mínimo configurado.
  const stockBajo = conStock
    .filter((i) => i.stockMinimo != null && (i.cantidad ?? 0) <= i.stockMinimo)
    .sort((a, b) => (a.cantidad ?? 0) - (b.cantidad ?? 0));
  const agotados = insumos.filter((i) => (i.cantidad ?? 0) <= 0);

  // Distribución real de insumos con stock por categoría.
  const porCategoria = new Map<string, number>();
  for (const insumo of conStock) {
    const categoria = insumo.categoria?.trim() || 'Sin categoría';
    porCategoria.set(categoria, (porCategoria.get(categoria) ?? 0) + 1);
  }
  const categorias = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const totalConStock = conStock.length;

  const ultimasProducciones = producciones.slice(0, 5);

  const kpis = [
    { etiqueta: 'Insumos con stock', valor: conStock.length, detalle: `${agotados.length} agotado(s)`, icono: '📦' },
    { etiqueta: 'Por vencer (≤ 3 días)', valor: porVencer.length, detalle: `${vencidos.length} vencido(s)`, icono: '⏳' },
    { etiqueta: 'Platos activos', valor: platosActivos.length, detalle: `${platos.length} en el menú`, icono: '🍽️' },
    { etiqueta: 'Mesas ocupadas', valor: mesasOcupadas.length, detalle: `${mesas.length} en el mapa`, icono: '🪑' },
  ];

  return (
    <main className="min-h-screen bg-resto-manteca text-resto-ciruela">
      <AppHeader
        activePage="analitica"
        onLogout={logout}
        rol={sesion?.rol}
        locales={sesion?.locales ?? []}
        localActivoId={localActivoId}
        onLocalChange={setLocalActivoId}
      />

      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-10">
        {/* ENCABEZADO */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-resto-dorado/10 border border-resto-dorado/20 text-resto-canela text-xs font-bold uppercase tracking-wider mb-4">
              <span className="w-2 h-2 rounded-full bg-resto-dorado" />
              Resumen del local
            </div>
            <h2 className="text-4xl md:text-5xl font-black leading-tight">
              Analítica de tu <span className="text-resto-canela">operación.</span>
            </h2>
            <p className="mt-4 text-resto-acero text-lg leading-relaxed">
              Mirá el estado real de tu inventario, tu menú y tus mesas. Descubrí qué está por vencer
              y qué conviene reponer antes de que se agote.
            </p>
          </div>
          <Link
            href="/prediccion"
            className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-resto-oliva text-resto-manteca text-sm font-bold hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resto-oliva"
          >
            Ver IA Predictiva →
          </Link>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-resto-ciruela/20 bg-resto-ciruela/5 px-5 py-4 text-sm font-bold" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-32 text-center" role="status">
            <div className="w-12 h-12 mx-auto mb-6 rounded-full border-4 border-resto-dorado/20 border-t-resto-dorado animate-spin" />
            <p className="text-resto-ciruela text-lg font-bold">Calculando el resumen del local...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {kpis.map((kpi) => (
                <div key={kpi.etiqueta} className="bg-white rounded-[2rem] border border-resto-ciruela/10 p-6 shadow-sm">
                  <div className="text-2xl mb-3">{kpi.icono}</div>
                  <div className="text-4xl font-black">{kpi.valor}</div>
                  <div className="mt-1 text-sm font-bold">{kpi.etiqueta}</div>
                  <div className="text-xs text-resto-acero mt-1">{kpi.detalle}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* DISTRIBUCIÓN POR CATEGORÍA (real) */}
              <div className="lg:col-span-2 bg-white rounded-[2rem] border border-resto-ciruela/10 p-8 shadow-sm">
                <h3 className="text-xl font-black mb-1">Inventario por categoría</h3>
                <p className="text-sm text-resto-acero mb-8">
                  Cantidad de insumos con stock en cada categoría del local.
                </p>

                {categorias.length === 0 ? (
                  <p className="text-sm text-resto-acero">Todavía no hay insumos con stock en este local.</p>
                ) : (
                  <div className="space-y-5">
                    {categorias.map(([categoria, cantidad], indice) => {
                      const porcentaje = totalConStock > 0 ? Math.round((cantidad / totalConStock) * 100) : 0;
                      const color = COLORES[indice % COLORES.length];
                      return (
                        <div key={categoria}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-3">
                              <span className={`w-3 h-3 rounded-full ${color.punto}`} />
                              <span className="font-bold text-sm">{categoria}</span>
                            </div>
                            <span className="text-sm font-bold text-resto-acero">
                              {cantidad} · {porcentaje}%
                            </span>
                          </div>
                          <div className="h-2.5 rounded-full bg-resto-manteca overflow-hidden">
                            <div className={`h-full rounded-full ${color.barra}`} style={{ width: `${porcentaje}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* REPOSICIÓN SUGERIDA (regla simple, sin IA) */}
              <div className="bg-resto-ciruela text-resto-manteca rounded-[2rem] p-8 shadow-sm relative overflow-hidden">
                <div className="relative z-10">
                  <div className="text-3xl mb-4">🛒</div>
                  <h3 className="text-xl font-black mb-2">Para reponer</h3>
                  <p className="text-sm text-resto-manteca/70 leading-relaxed mb-6">
                    Insumos por debajo de su stock mínimo o agotados. Revisalos antes de tu próxima compra.
                  </p>

                  {stockBajo.length === 0 && agotados.length === 0 ? (
                    <p className="text-sm font-bold text-resto-oliva">Todo en orden: nada por debajo del mínimo. ✓</p>
                  ) : (
                    <ul className="space-y-3">
                      {agotados.slice(0, 4).map((insumo) => (
                        <li key={`agotado-${insumo.id}`} className="flex items-center justify-between gap-2 text-sm">
                          <span className="font-bold truncate">
                            {insumo.icono ?? '📦'} {insumo.nombre}
                          </span>
                          <span className="shrink-0 px-2 py-0.5 rounded-full bg-resto-dorado/20 text-resto-dorado text-xs font-bold">
                            Agotado
                          </span>
                        </li>
                      ))}
                      {stockBajo.slice(0, 4).map((insumo) => (
                        <li key={`bajo-${insumo.id}`} className="flex items-center justify-between gap-2 text-sm">
                          <span className="font-bold truncate">
                            {insumo.icono ?? '📦'} {insumo.nombre}
                          </span>
                          <span className="shrink-0 text-xs font-bold text-resto-manteca/70">
                            {cantidadLegible(insumo.cantidad ?? 0)} {etiquetaUnidad(insumo.unidadMedida)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-resto-dorado/10 rounded-full blur-2xl" />
              </div>

              {/* ÚLTIMAS PREPARACIONES */}
              <div className="lg:col-span-3 bg-white rounded-[2rem] border border-resto-ciruela/10 p-8 shadow-sm">
                <h3 className="text-xl font-black mb-1">Últimas preparaciones</h3>
                <p className="text-sm text-resto-acero mb-6">Los platos más recientes preparados en este local.</p>

                {ultimasProducciones.length === 0 ? (
                  <p className="text-sm text-resto-acero">
                    Todavía no preparaste ningún plato. Andá a Menú y prepará el primero para una mesa.
                  </p>
                ) : (
                  <div className="divide-y divide-resto-ciruela/10">
                    {ultimasProducciones.map((produccion) => (
                      <div key={produccion.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">🍽️</span>
                          <div>
                            <div className="font-bold text-sm">
                              {produccion.platoNombre} × {cantidadLegible(produccion.cantidad)}
                            </div>
                            <div className="text-xs text-resto-acero">
                              {produccion.mesaNombre ? `Para ${produccion.mesaNombre}` : 'Sin mesa asignada'}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-resto-acero">
                          {new Date(produccion.fechaHora).toLocaleString('es-AR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      <footer className="border-t border-resto-ciruela/10 mt-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-resto-acero">© 2026 RestoSync. Todos los derechos reservados.</p>
          <p className="text-xs text-resto-acero">Gestión inteligente de tu cocina.</p>
        </div>
      </footer>
    </main>
  );
}

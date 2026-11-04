'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthSession } from '@/lib/use-auth-session';
import { apiUrl, authHeaders } from '@/lib/api';
import AppHeader from '@/components/app-header';
import DemandaChart from '@/components/graficos/demanda-chart';
import ComprasChart from '@/components/graficos/compras-chart';
import {
  diasHasta,
  fechaDDMM,
  pedirHistorial,
  pedirPrediccion,
  type HistorialResponse,
  type PrediccionResponse,
  type PrioridadCompra,
} from '@/lib/prediccion';

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

// Badge de prioridad para la lista de compras del monitor predictivo.
const BADGE_PRIORIDAD: Record<PrioridadCompra, string> = {
  ALTA: 'bg-resto-ciruela text-resto-manteca',
  MEDIA: 'bg-resto-dorado/20 text-resto-dorado',
  BAJA: 'bg-resto-acero/20 text-resto-acero',
};

const HORIZONTES = [7, 14, 30];

function cantidadLegible(valor: number) {
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(2).replace(/\.?0+$/, '');
}

export default function AnaliticaPage() {
  const { token, checking, logout, sesion, localActivoId, setLocalActivoId } = useAuthSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [platos, setPlatos] = useState<Plato[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [producciones, setProducciones] = useState<Produccion[]>([]);

  // Estado del monitor predictivo (Plan-IA §4.3).
  const [prediccion, setPrediccion] = useState<PrediccionResponse | null>(null);
  const [cargandoPrediccion, setCargandoPrediccion] = useState(true);
  const [errorPrediccion, setErrorPrediccion] = useState('');
  const [horizonte, setHorizonte] = useState(7);
  const historialRef = useRef<HistorialResponse | null>(null);
  const horizonteRef = useRef(7);

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

  // ---------- Monitor predictivo: historial del core → predicción de la IA (§0.3) ----------

  const proyectar = useCallback(async (historial: HistorialResponse, horizonteDias: number) => {
    setCargandoPrediccion(true);
    setErrorPrediccion('');
    try {
      setPrediccion(await pedirPrediccion(historial, horizonteDias));
    } catch {
      setPrediccion(null);
      setErrorPrediccion('El servicio de IA no está disponible. Verificá que restosync-ia esté corriendo.');
    } finally {
      setCargandoPrediccion(false);
    }
  }, []);

  const cargarMonitor = useCallback(async () => {
    if (!token || localActivoId == null) return;
    setCargandoPrediccion(true);
    setErrorPrediccion('');
    setPrediccion(null);
    try {
      const historial = await pedirHistorial(token, localActivoId, 90);
      historialRef.current = historial;
      await proyectar(historial, horizonteRef.current);
    } catch {
      historialRef.current = null;
      setErrorPrediccion('No pudimos cargar el historial del local. Revisá que el backend esté corriendo.');
      setCargandoPrediccion(false);
    }
  }, [token, localActivoId, proyectar]);

  useEffect(() => {
    void cargarMonitor();
  }, [cargarMonitor]);

  // Cambiar el horizonte re-llama a la IA con el historial ya cargado (sin volver al core).
  const cambiarHorizonte = (nuevo: number) => {
    setHorizonte(nuevo);
    horizonteRef.current = nuevo;
    if (historialRef.current) void proyectar(historialRef.current, nuevo);
  };

  const reintentar = () => {
    if (historialRef.current) void proyectar(historialRef.current, horizonteRef.current);
    else void cargarMonitor();
  };

  if (checking || !token) {
    return (
      <main className="min-h-screen bg-resto-manteca flex items-center justify-center text-resto-ciruela">
        <p>Verificando sesión...</p>
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

  // Insumo con la fecha de quiebre más próxima (tarjeta destacada del monitor).
  const quiebreMasUrgente =
    prediccion && !prediccion.datosInsuficientes
      ? prediccion.demanda
          .filter((d) => d.fechaQuiebre)
          .sort((a, b) => String(a.fechaQuiebre).localeCompare(String(b.fechaQuiebre)))[0] ?? null
      : null;

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
        <div className="mb-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-resto-dorado/10 border border-resto-dorado/20 text-resto-dorado text-xs font-bold uppercase tracking-wider mb-4">
            <span className="w-2 h-2 rounded-full bg-resto-dorado" />
            Resumen del local
          </div>
          <h2 className="text-4xl md:text-5xl font-black leading-tight">
            Analítica de tu <span className="text-resto-dorado">operación.</span>
          </h2>
          <p className="mt-4 text-resto-acero text-lg leading-relaxed">
            Mirá el estado real de tu inventario, tu menú y tus mesas. Descubrí qué está por vencer
            y qué conviene reponer antes de que se agote.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-resto-ciruela/20 bg-resto-ciruela/5 px-5 py-4 text-sm font-bold">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-32 text-center">
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
                            {cantidadLegible(insumo.cantidad ?? 0)} {insumo.unidadMedida}
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

        {/* MONITOR PREDICTIVO (IA) — Plan-IA §4.3 */}
        <div className="mt-12">
          <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-resto-oliva/10 border border-resto-oliva/20 text-resto-oliva text-xs font-bold uppercase tracking-wider mb-4">
                <span className="w-2 h-2 rounded-full bg-resto-oliva" />
                Monitor predictivo · IA
              </div>
              <h3 className="text-3xl md:text-4xl font-black leading-tight">
                Qué viene en tu <span className="text-resto-oliva">cocina.</span>
              </h3>
              <p className="mt-3 text-resto-acero">
                Proyectamos la demanda de insumos, las mermas y las compras antes de que ocurran.
              </p>
            </div>
            <div className="flex items-center gap-2" role="group" aria-label="Horizonte de proyección">
              {HORIZONTES.map((dias) => (
                <button
                  key={dias}
                  type="button"
                  onClick={() => cambiarHorizonte(dias)}
                  aria-pressed={horizonte === dias}
                  className={`px-4 py-2 rounded-full text-sm font-bold border transition ${
                    horizonte === dias
                      ? 'bg-resto-oliva text-resto-manteca border-resto-oliva'
                      : 'bg-white text-resto-acero border-resto-ciruela/15 hover:border-resto-oliva/50'
                  }`}
                >
                  {dias} días
                </button>
              ))}
            </div>
          </div>

          {cargandoPrediccion ? (
            <div className="py-20 text-center rounded-[2rem] bg-white border border-resto-ciruela/10">
              <div className="w-10 h-10 mx-auto mb-4 rounded-full border-4 border-resto-oliva/20 border-t-resto-oliva animate-spin" />
              <p className="text-resto-ciruela font-bold">Proyectando la demanda de tu local...</p>
            </div>
          ) : errorPrediccion ? (
            <div className="rounded-[2rem] border border-resto-dorado/40 bg-resto-dorado/10 px-6 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="font-black">IA fuera de servicio</p>
                <p className="text-sm text-resto-acero mt-1">{errorPrediccion}</p>
              </div>
              <button
                type="button"
                onClick={reintentar}
                className="px-5 py-2.5 rounded-full bg-resto-ciruela text-resto-manteca text-sm font-bold hover:opacity-90"
              >
                Reintentar
              </button>
            </div>
          ) : prediccion?.datosInsuficientes ? (
            <div className="rounded-[2rem] border border-dashed border-resto-ciruela/25 bg-white px-6 py-14 text-center">
              <div className="text-4xl mb-4">🔮</div>
              <p className="font-black">Todavía no hay historial suficiente para proyectar.</p>
              <p className="text-sm text-resto-acero mt-2">Seguí registrando compras y preparaciones.</p>
            </div>
          ) : prediccion ? (
            <div className="space-y-6">
              {quiebreMasUrgente && (
                <div className="bg-resto-ciruela text-resto-manteca rounded-[2rem] p-6 flex items-center gap-4 shadow-sm">
                  <span className="text-3xl">{quiebreMasUrgente.icono ?? '⚠️'}</span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-resto-dorado">Próximo quiebre</p>
                    <p className="font-black text-lg leading-snug">
                      {quiebreMasUrgente.nombre} se agota el {fechaDDMM(String(quiebreMasUrgente.fechaQuiebre))}
                    </p>
                    <p className="text-sm text-resto-manteca/70">
                      Cobertura de {quiebreMasUrgente.coberturaDias} días · consumo base{' '}
                      {quiebreMasUrgente.consumoDiarioBase} {quiebreMasUrgente.unidadMedida}/día.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Proyección de demanda */}
                <div className="lg:col-span-2 bg-white rounded-[2rem] border border-resto-ciruela/10 p-8 shadow-sm">
                  <h4 className="text-xl font-black mb-1">Proyección de demanda</h4>
                  <p className="text-sm text-resto-acero mb-6">
                    Consumo diario estimado para los próximos {prediccion.horizonteDias} días.
                  </p>
                  <DemandaChart demanda={prediccion.demanda} />
                </div>

                {/* Insights (Gemini o reglas) */}
                <div className="bg-white rounded-[2rem] border border-resto-ciruela/10 p-8 shadow-sm">
                  <h4 className="text-xl font-black mb-1">Recomendaciones</h4>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-resto-oliva/10 text-resto-oliva text-xs font-bold mb-4">
                    {prediccion.insights.fuente === 'gemini' ? 'Generado por Gemini' : 'Basado en reglas de consumo'}
                  </span>
                  <ul className="space-y-4">
                    {prediccion.insights.recomendaciones.map((recomendacion, indice) => (
                      <li key={`${recomendacion.titulo}-${indice}`}>
                        <p className="font-bold text-sm">{recomendacion.titulo}</p>
                        <p className="text-xs text-resto-acero mt-0.5 leading-relaxed">{recomendacion.detalle}</p>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Compras sugeridas */}
                <div className="lg:col-span-2 bg-white rounded-[2rem] border border-resto-ciruela/10 p-8 shadow-sm">
                  <h4 className="text-xl font-black mb-1">Compras sugeridas</h4>
                  <p className="text-sm text-resto-acero mb-6">
                    Qué reponer y en qué cantidad para cubrir la demanda proyectada.
                  </p>
                  <ComprasChart compras={prediccion.compras} />
                  {prediccion.compras.length > 0 && (
                    <ul className="mt-4 divide-y divide-resto-ciruela/10">
                      {prediccion.compras.map((compra) => (
                        <li key={`lista-${compra.insumoId}`} className="py-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate">
                              {compra.icono ?? '📦'} {compra.nombre} · {compra.cantidadSugerida} {compra.unidadMedida}
                            </p>
                            <p className="text-xs text-resto-acero">{compra.motivo}</p>
                          </div>
                          <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-bold ${BADGE_PRIORIDAD[compra.prioridad]}`}>
                            {compra.prioridad}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Mermas proyectadas */}
                <div className="bg-white rounded-[2rem] border border-resto-ciruela/10 p-8 shadow-sm">
                  <h4 className="text-xl font-black mb-1">Mermas proyectadas</h4>
                  <p className="text-sm text-resto-acero mb-6">Lotes que vencen antes de consumirse.</p>
                  {prediccion.mermas.length === 0 ? (
                    <p className="text-sm text-resto-acero">Nada en riesgo de merma para este horizonte. ✓</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wider text-resto-acero">
                          <th className="pb-2 font-bold">Insumo</th>
                          <th className="pb-2 font-bold">En riesgo</th>
                          <th className="pb-2 font-bold">Vence</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-resto-ciruela/10">
                        {prediccion.mermas.map((merma) => (
                          <tr key={`merma-${merma.insumoId}-${merma.fechaVencimiento}`}>
                            <td className="py-2.5 font-bold">{merma.icono ?? '📦'} {merma.nombre}</td>
                            <td className="py-2.5 text-resto-acero">
                              {merma.cantidadEnRiesgo} {merma.unidadMedida}
                            </td>
                            <td className="py-2.5">
                              <div className="flex items-center gap-2">
                                <span>{fechaDDMM(merma.fechaVencimiento)}</span>
                                {diasHasta(merma.fechaVencimiento) <= 3 && (
                                  <span className="px-2 py-0.5 rounded-full bg-resto-ciruela text-resto-manteca text-xs font-bold">
                                    urgente
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
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
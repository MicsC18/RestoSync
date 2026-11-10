'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatearCantidad } from '@/lib/numero';
import { useAuthSession } from '@/lib/use-auth-session';
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

// Badge de prioridad para la lista de compras del monitor predictivo.
const BADGE_PRIORIDAD: Record<PrioridadCompra, string> = {
  ALTA: 'bg-resto-ciruela text-resto-manteca',
  MEDIA: 'bg-resto-dorado/20 text-resto-canela',
  BAJA: 'bg-resto-acero/20 text-resto-acero',
};

const HORIZONTES = [7, 14, 30];

export default function PrediccionPage() {
  const { token, checking, logout, sesion, localActivoId, setLocalActivoId } = useAuthSession();

  // Estado del monitor predictivo (Plan-IA §4.3).
  const [prediccion, setPrediccion] = useState<PrediccionResponse | null>(null);
  const [cargandoPrediccion, setCargandoPrediccion] = useState(true);
  const [errorPrediccion, setErrorPrediccion] = useState('');
  const [horizonte, setHorizonte] = useState(7);
  const historialRef = useRef<HistorialResponse | null>(null);
  const horizonteRef = useRef(7);

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
        <p role="status">Verificando sesión...</p>
      </main>
    );
  }

  // Insumo con la fecha de quiebre más próxima (tarjeta destacada del monitor).
  const quiebreMasUrgente =
    prediccion && !prediccion.datosInsuficientes
      ? prediccion.demanda
          .filter((d) => d.fechaQuiebre)
          .sort((a, b) => String(a.fechaQuiebre).localeCompare(String(b.fechaQuiebre)))[0] ?? null
      : null;

  return (
    <main className="min-h-screen bg-resto-manteca text-resto-ciruela">
      <AppHeader
        activePage="prediccion"
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
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-resto-oliva/10 border border-resto-oliva/20 text-resto-oliva text-xs font-bold uppercase tracking-wider mb-4">
              <span className="w-2 h-2 rounded-full bg-resto-oliva" />
              IA Predictiva
            </div>
            <h2 className="text-4xl md:text-5xl font-black leading-tight">
              Qué viene en tu <span className="text-resto-oliva">cocina.</span>
            </h2>
            <p className="mt-4 text-resto-acero text-lg leading-relaxed">
              Proyectamos la demanda de insumos, las mermas y las compras antes de que ocurran,
              con el historial de los últimos 90 días del local.
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
          <div className="py-20 text-center rounded-[2rem] bg-white border border-resto-ciruela/10" role="status">
            <div className="w-10 h-10 mx-auto mb-4 rounded-full border-4 border-resto-oliva/20 border-t-resto-oliva animate-spin" />
            <p className="text-resto-ciruela font-bold">Proyectando la demanda de tu local...</p>
          </div>
        ) : errorPrediccion ? (
          <div className="rounded-[2rem] border border-resto-dorado/40 bg-resto-dorado/10 px-6 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" role="alert">
            <div>
              <p className="font-black">IA fuera de servicio</p>
              <p className="text-sm text-resto-acero mt-1">{errorPrediccion}</p>
            </div>
            <button
              type="button"
              onClick={reintentar}
              className="px-5 py-2.5 rounded-full bg-resto-ciruela text-resto-manteca text-sm font-bold hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resto-oliva"
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
                    {formatearCantidad(quiebreMasUrgente.consumoDiarioBase)} {quiebreMasUrgente.unidadMedida}/día.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Proyección de demanda */}
              <div className="lg:col-span-2 bg-white rounded-[2rem] border border-resto-ciruela/10 p-8 shadow-sm">
                <h3 className="text-xl font-black mb-1">Proyección de demanda</h3>
                <p className="text-sm text-resto-acero mb-6">
                  Consumo diario estimado para los próximos {prediccion.horizonteDias} días.
                </p>
                <DemandaChart demanda={prediccion.demanda} />
              </div>

              {/* Insights (Gemini o reglas) */}
              <div className="bg-white rounded-[2rem] border border-resto-ciruela/10 p-8 shadow-sm">
                <h3 className="text-xl font-black mb-1">Recomendaciones</h3>
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
                <h3 className="text-xl font-black mb-1">Compras sugeridas</h3>
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
                            {compra.icono ?? '📦'} {compra.nombre} · {formatearCantidad(compra.cantidadSugerida)} {compra.unidadMedida}
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
                <h3 className="text-xl font-black mb-1">Mermas proyectadas</h3>
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
                            {formatearCantidad(merma.cantidadEnRiesgo)} {merma.unidadMedida}
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

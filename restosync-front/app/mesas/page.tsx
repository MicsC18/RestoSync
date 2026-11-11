'use client';

import Link from 'next/link';
import { FormEvent, PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { apiUrl, authHeaders } from '@/lib/api';
import { formatearCantidad } from '@/lib/numero';
import { useAuthSession } from '@/lib/use-auth-session';
import AppHeader from '@/components/app-header';
import Modal from '@/components/modal';
import ConfirmDialog from '@/components/confirm-dialog';

type EstadoMesa = 'LIBRE' | 'OCUPADA' | 'RESERVADA';

type Mesa = {
  id: number;
  nombre: string;
  capacidad?: number | null;
  posicionX?: number | null;
  posicionY?: number | null;
  estado: EstadoMesa;
  /** Inicio de la ocupación actual (solo con estado OCUPADA). */
  fechaOcupacion?: string | null;
};

type Produccion = {
  id: number | null;
  platoNombre: string;
  cantidad: number;
  mesaNombre: string | null;
  fechaHora: string;
  usuarioEmail: string | null;
};

type FormMesa = { nombre: string; capacidad: string; estado: EstadoMesa };

const formVacio: FormMesa = { nombre: '', capacidad: '', estado: 'LIBRE' };

const ESTILOS_ESTADO: Record<EstadoMesa, { tarjeta: string; punto: string; etiqueta: string }> = {
  LIBRE: {
    tarjeta: 'bg-white border-resto-oliva/40 hover:border-resto-oliva',
    punto: 'bg-resto-oliva',
    etiqueta: 'bg-resto-oliva/10 text-resto-oliva',
  },
  OCUPADA: {
    tarjeta: 'bg-resto-dorado/10 border-resto-dorado/50 hover:border-resto-dorado',
    punto: 'bg-resto-dorado',
    etiqueta: 'bg-resto-dorado/20 text-resto-canela',
  },
  RESERVADA: {
    tarjeta: 'bg-resto-ciruela/5 border-resto-ciruela/40 hover:border-resto-ciruela',
    punto: 'bg-resto-ciruela',
    etiqueta: 'bg-resto-ciruela/10 text-resto-ciruela',
  },
};

const ETIQUETAS_ESTADO: Record<EstadoMesa, string> = {
  LIBRE: 'Libre',
  OCUPADA: 'Ocupada',
  RESERVADA: 'Reservada',
};

/** Posición en grilla para las mesas que todavía no tienen coordenadas guardadas. */
function posicionGrilla(indice: number): { x: number; y: number } {
  return { x: 4 + (indice % 5) * 19, y: 6 + Math.floor(indice / 5) * 24 };
}

export default function MesasPage() {
  const { token, checking, logout, sesion, localActivoId, setLocalActivoId } = useAuthSession();

  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  // Mesa seleccionada + platos actuales (solo se muestran durante la ocupación actual).
  const [seleccionadaId, setSeleccionadaId] = useState<number | null>(null);
  const [producciones, setProducciones] = useState<Produccion[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  // Confirmación informativa al liberar una mesa con platos visibles.
  const [mesaALiberar, setMesaALiberar] = useState<{ mesa: Mesa; estado: EstadoMesa } | null>(null);

  // Modal alta/edición.
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState<FormMesa>(formVacio);
  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState('');
  const [cambiandoEstado, setCambiandoEstado] = useState(false);

  // Confirmación de eliminación (reemplaza al confirm() nativo).
  const [mesaAEliminar, setMesaAEliminar] = useState<Mesa | null>(null);

  // Arrastre sobre el mapa (posiciones en porcentaje del canvas).
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: number; offsetX: number; offsetY: number; movido: boolean } | null>(null);
  const mesasRef = useRef<Mesa[]>([]);
  useEffect(() => {
    mesasRef.current = mesas;
  }, [mesas]);

  const cargarMesas = useCallback(async () => {
    if (!token || localActivoId == null) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(apiUrl('/api/v1/mesas'), { headers: authHeaders(token, localActivoId) });
      if (!response.ok) throw new Error('No se pudieron cargar las mesas.');
      setMesas(await response.json());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error de conexión con el backend.');
    } finally {
      setLoading(false);
    }
  }, [token, localActivoId]);

  useEffect(() => {
    if (checking || !token) return;
    if (localActivoId == null) {
      setLoading(false);
      setError('Creá un local para gestionar las mesas.');
      return;
    }
    setSeleccionadaId(null);
    setProducciones([]);
    void cargarMesas();
  }, [checking, token, localActivoId, retryCount, cargarMesas]);

  const seleccionada = mesas.find((mesa) => mesa.id === seleccionadaId) ?? null;
  const ocupadaSeleccionada = seleccionada?.estado === 'OCUPADA';

  // Platos actuales de la mesa seleccionada: solo se consultan si está OCUPADA
  // (la regla dura la tiene el core filtrando por fechaOcupacion).
  useEffect(() => {
    if (!token || localActivoId == null || seleccionadaId == null || !ocupadaSeleccionada) {
      setProducciones([]);
      return;
    }
    let activo = true;
    const cargar = async () => {
      setLoadingHistorial(true);
      try {
        const response = await fetch(apiUrl(`/api/v1/producciones?mesaId=${seleccionadaId}`), {
          headers: authHeaders(token, localActivoId),
        });
        if (response.ok && activo) setProducciones(await response.json());
      } catch {
        // Los platos actuales son accesorios: si falla, el mapa sigue operativo.
      } finally {
        if (activo) setLoadingHistorial(false);
      }
    };
    void cargar();
    return () => {
      activo = false;
    };
  }, [token, localActivoId, seleccionadaId, ocupadaSeleccionada, retryCount]);

  const conteoEstados = {
    LIBRE: mesas.filter((m) => m.estado === 'LIBRE').length,
    OCUPADA: mesas.filter((m) => m.estado === 'OCUPADA').length,
    RESERVADA: mesas.filter((m) => m.estado === 'RESERVADA').length,
  };

  // =========================
  // ARRASTRE EN EL MAPA
  // =========================
  const posicionDe = (mesa: Mesa, indiceSinPosicion: number) => {
    if (mesa.posicionX != null && mesa.posicionY != null) {
      return { x: mesa.posicionX, y: mesa.posicionY };
    }
    return posicionGrilla(indiceSinPosicion);
  };

  const iniciarArrastre = (e: ReactPointerEvent<HTMLDivElement>, mesa: Mesa) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    const indiceSinPosicion = mesas.filter((m) => m.posicionX == null).findIndex((m) => m.id === mesa.id);
    const pos = posicionDe(mesa, Math.max(indiceSinPosicion, 0));
    dragRef.current = { id: mesa.id, offsetX: xPct - pos.x, offsetY: yPct - pos.y, movido: false };
  };

  const moverArrastre = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.min(88, Math.max(1, ((e.clientX - rect.left) / rect.width) * 100 - drag.offsetX));
    const y = Math.min(82, Math.max(2, ((e.clientY - rect.top) / rect.height) * 100 - drag.offsetY));
    if (!drag.movido) {
      const actual = mesasRef.current.find((m) => m.id === drag.id);
      const indice = mesasRef.current.filter((m) => m.posicionX == null).findIndex((m) => m.id === drag.id);
      const posActual = actual ? posicionDe(actual, Math.max(indice, 0)) : { x: 0, y: 0 };
      if (Math.abs(x - posActual.x) < 1 && Math.abs(y - posActual.y) < 1) return;
      drag.movido = true;
    }
    setMesas((actuales) => actuales.map((m) => (m.id === drag.id ? { ...m, posicionX: x, posicionY: y } : m)));
  };

  const finArrastre = async (mesa: Mesa) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.id !== mesa.id) return;
    if (!drag.movido) {
      // Fue un click, no un arrastre: seleccionar la mesa.
      setSeleccionadaId((actual) => (actual === mesa.id ? null : mesa.id));
      return;
    }
    const actual = mesasRef.current.find((m) => m.id === mesa.id);
    if (!actual || !token || actual.posicionX == null || actual.posicionY == null) return;
    try {
      const response = await fetch(apiUrl(`/api/v1/mesas/${mesa.id}`), {
        method: 'PUT',
        headers: authHeaders(token, localActivoId),
        body: JSON.stringify({ nombre: actual.nombre, posicionX: actual.posicionX, posicionY: actual.posicionY }),
      });
      if (!response.ok) throw new Error('No se pudo guardar la posición.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar la posición.');
      setRetryCount((c) => c + 1);
    }
  };

  // =========================
  // CRUD DE MESAS
  // =========================
  const abrirNueva = () => {
    setEditandoId(null);
    setForm(formVacio);
    setErrorModal('');
    setModal(true);
  };

  const abrirEditar = (mesa: Mesa) => {
    setEditandoId(mesa.id);
    setForm({ nombre: mesa.nombre, capacidad: mesa.capacidad != null ? String(mesa.capacidad) : '', estado: mesa.estado });
    setErrorModal('');
    setModal(true);
  };

  const cerrarModal = () => {
    if (guardando) return;
    setModal(false);
    setEditandoId(null);
    setErrorModal('');
  };

  const guardarMesa = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const nombre = form.nombre.trim();
    if (!nombre) {
      setErrorModal('El nombre de la mesa es obligatorio.');
      return;
    }
    const capacidad = form.capacidad.trim() === '' ? null : Number(form.capacidad);
    if (capacidad != null && (!Number.isInteger(capacidad) || capacidad <= 0)) {
      setErrorModal('La capacidad debe ser un número entero mayor a cero (o dejala vacía).');
      return;
    }
    setGuardando(true);
    setErrorModal('');
    try {
      const payload: Record<string, unknown> = { nombre, capacidad, estado: form.estado };
      if (editandoId == null) {
        // Las mesas nuevas arrancan en la grilla; después se arrastran a gusto.
        const sinPosicion = mesas.filter((m) => m.posicionX == null).length;
        const pos = posicionGrilla(sinPosicion);
        payload.posicionX = pos.x;
        payload.posicionY = pos.y;
      }
      const response = await fetch(apiUrl(editandoId != null ? `/api/v1/mesas/${editandoId}` : '/api/v1/mesas'), {
        method: editandoId != null ? 'PUT' : 'POST',
        headers: authHeaders(token, localActivoId),
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || data?.error || 'No se pudo guardar la mesa.');
      }
      setModal(false);
      setEditandoId(null);
      setExito(editandoId != null ? 'Mesa actualizada.' : `"${nombre}" agregada al mapa.`);
      setRetryCount((c) => c + 1);
    } catch (err: unknown) {
      setErrorModal(err instanceof Error ? err.message : 'Error al guardar la mesa.');
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = (mesa: Mesa, estado: EstadoMesa) => {
    if (mesa.estado === estado) return;
    // Liberar una mesa ocupada que tiene platos actuales muestra una confirmación
    // informativa; el PUT se ejecuta recién al confirmar.
    if (mesa.estado === 'OCUPADA' && mesa.id === seleccionadaId && producciones.length > 0) {
      setMesaALiberar({ mesa, estado });
      return;
    }
    void ejecutarCambioEstado(mesa, estado);
  };

  const ejecutarCambioEstado = async (mesa: Mesa, estado: EstadoMesa) => {
    if (!token || mesa.estado === estado) return;
    setCambiandoEstado(true);
    setError('');
    try {
      const response = await fetch(apiUrl(`/api/v1/mesas/${mesa.id}`), {
        method: 'PUT',
        headers: authHeaders(token, localActivoId),
        body: JSON.stringify({ nombre: mesa.nombre, estado }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || data?.error || 'No se pudo cambiar el estado.');
      }
      const actualizada: Mesa = await response.json();
      setMesas((actuales) => actuales.map((m) => (m.id === actualizada.id ? actualizada : m)));
      // Al salir de la ocupación, el panel pasa a mostrar la sesión vacía de inmediato.
      if (mesa.id === seleccionadaId && estado !== 'OCUPADA') setProducciones([]);
      setExito(estado === 'LIBRE' ? `${mesa.nombre} liberada.` : `${mesa.nombre} marcada como ${ETIQUETAS_ESTADO[estado].toLowerCase()}.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cambiar el estado.');
    } finally {
      setCambiandoEstado(false);
    }
  };

  const eliminarMesa = async (mesa: Mesa) => {
    if (!token) return;
    setError('');
    try {
      const response = await fetch(apiUrl(`/api/v1/mesas/${mesa.id}`), {
        method: 'DELETE',
        headers: authHeaders(token, localActivoId),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || data?.error || 'No se pudo eliminar la mesa.');
      }
      if (seleccionadaId === mesa.id) setSeleccionadaId(null);
      setExito(`"${mesa.nombre}" eliminada del mapa.`);
      setRetryCount((c) => c + 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al eliminar la mesa.');
    }
  };

  const formatearFecha = (fechaHora: string) => {
    const fecha = new Date(fechaHora);
    return Number.isNaN(fecha.getTime())
      ? fechaHora
      : fecha.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  if (checking || !token) {
    return (
      <main className="min-h-screen bg-resto-manteca flex items-center justify-center text-resto-ciruela">
        <p role="status">Verificando sesión...</p>
      </main>
    );
  }

  let indiceSinPosicion = 0;

  return (
    <main className="min-h-screen bg-resto-manteca text-resto-ciruela">
      <AppHeader
        activePage="mesas"
        onLogout={logout}
        rol={sesion?.rol}
        locales={sesion?.locales ?? []}
        localActivoId={localActivoId}
        onLocalChange={setLocalActivoId}
      />

      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-10">
        {/* ENCABEZADO */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-resto-dorado/10 border border-resto-dorado/20 text-resto-canela text-xs font-bold uppercase tracking-wider mb-4">
              <span className="w-2 h-2 rounded-full bg-resto-dorado" />
              Salón
            </div>
            <h2 className="text-4xl md:text-5xl font-black leading-tight">
              Mapa de <span className="text-resto-oliva">mesas.</span>
            </h2>
            <p className="mt-4 text-resto-acero max-w-xl leading-relaxed">
              Arrastrá las mesas para ordenar el salón, cambiá su estado y mirá los{' '}
              <span className="font-bold">platos actuales</span> de cada una: solo se muestran los
              preparados durante la ocupación en curso. Los platos se preparan desde el{' '}
              <Link href="/menu" className="font-bold text-resto-oliva hover:text-resto-canela">Menú</Link>.
            </p>
          </div>
          <div className="shrink-0">
            <button
              type="button"
              onClick={abrirNueva}
              className="px-6 py-3.5 rounded-xl bg-resto-oliva text-resto-manteca font-bold hover:bg-resto-dorado hover:text-resto-ciruela transition-all shadow-lg shadow-resto-oliva/20"
            >
              + Nueva mesa
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-resto-dorado/40 bg-resto-dorado/10 px-4 py-3 text-sm" role="alert">
            {error}
          </div>
        )}
        {exito && (
          <div className="mb-6 rounded-xl border border-resto-oliva/40 bg-resto-oliva/10 px-4 py-3 text-sm font-semibold text-resto-oliva" role="status">
            {exito}
          </div>
        )}

        {/* LEYENDA DE ESTADOS */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {(Object.keys(ETIQUETAS_ESTADO) as EstadoMesa[]).map((estado) => (
            <span key={estado} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold ${ESTILOS_ESTADO[estado].etiqueta}`}>
              <span className={`w-2 h-2 rounded-full ${ESTILOS_ESTADO[estado].punto}`} />
              {ETIQUETAS_ESTADO[estado]} · {conteoEstados[estado]}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-8">
          {/* MAPA */}
          <div>
            {loading ? (
              <div className="py-20 text-center bg-white rounded-[2rem] border border-resto-ciruela/10" role="status">
                <div className="w-10 h-10 mx-auto mb-4 rounded-full border-4 border-resto-oliva/20 border-t-resto-oliva animate-spin" />
                <p className="text-resto-acero font-semibold">Cargando el salón...</p>
              </div>
            ) : mesas.length === 0 ? (
              <div className="bg-white rounded-[2rem] border border-resto-ciruela/10 py-16 text-center shadow-sm">
                <div className="text-4xl mb-4">🪑</div>
                <h3 className="text-lg font-bold">Todavía no hay mesas</h3>
                <p className="text-resto-acero text-sm mt-1">Creá la primera con &quot;+ Nueva mesa&quot;.</p>
              </div>
            ) : (
              <div
                ref={canvasRef}
                className="relative h-[520px] rounded-[2rem] border border-resto-ciruela/10 bg-white shadow-sm overflow-hidden"
                style={{
                  backgroundImage: 'radial-gradient(circle, rgba(62, 39, 35, 0.08) 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
              >
                {mesas.map((mesa) => {
                  const sinPosicion = mesa.posicionX == null || mesa.posicionY == null;
                  const pos = posicionDe(mesa, sinPosicion ? indiceSinPosicion++ : 0);
                  const estilos = ESTILOS_ESTADO[mesa.estado];
                  const esSeleccionada = mesa.id === seleccionadaId;
                  return (
                    <div
                      key={mesa.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${mesa.nombre}, ${ETIQUETAS_ESTADO[mesa.estado]}. Arrastrá para mover o Enter para ver sus platos actuales.`}
                      onPointerDown={(e) => iniciarArrastre(e, mesa)}
                      onPointerMove={moverArrastre}
                      onPointerUp={() => void finArrastre(mesa)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSeleccionadaId((actual) => (actual === mesa.id ? null : mesa.id));
                        }
                      }}
                      className={`absolute w-28 select-none touch-none cursor-grab active:cursor-grabbing rounded-2xl border-2 p-3 shadow-sm transition-shadow ${estilos.tarjeta} ${
                        esSeleccionada ? 'ring-2 ring-resto-oliva ring-offset-2' : ''
                      }`}
                      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${estilos.punto}`} />
                        <span className="text-[9px] font-bold uppercase tracking-wide text-resto-acero truncate">
                          {ETIQUETAS_ESTADO[mesa.estado]}
                        </span>
                      </div>
                      <p className="mt-1.5 font-black text-sm leading-tight truncate">{mesa.nombre}</p>
                      <p className="text-[10px] text-resto-acero mt-0.5">
                        {mesa.capacidad != null ? `${mesa.capacidad} pers.` : 'Sin capacidad'}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-[11px] text-resto-acero mt-3">
              Arrastrá una mesa para cambiar su posición (se guarda sola). Hacé click para ver sus platos actuales.
            </p>
          </div>

          {/* PANEL DE DETALLE */}
          <div className="bg-white rounded-[2rem] border border-resto-ciruela/10 p-6 shadow-sm h-fit">
            {!seleccionada ? (
              <div className="py-10 text-center">
                <div className="text-3xl mb-3">👆</div>
                <h3 className="font-bold">Elegí una mesa</h3>
                <p className="text-sm text-resto-acero mt-1">
                  Hacé click en una mesa del mapa para ver su estado y sus platos actuales.
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-2xl font-black truncate">{seleccionada.nombre}</h3>
                    <p className="text-sm text-resto-acero mt-1">
                      {seleccionada.capacidad != null ? `Capacidad: ${seleccionada.capacidad} personas` : 'Capacidad sin definir'}
                    </p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${ESTILOS_ESTADO[seleccionada.estado].etiqueta}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${ESTILOS_ESTADO[seleccionada.estado].punto}`} />
                    {ETIQUETAS_ESTADO[seleccionada.estado]}
                  </span>
                </div>

                {/* CAMBIO DE ESTADO */}
                <div className="mt-5">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-resto-acero mb-2">Estado</p>
                  <div className="flex gap-2">
                    {(Object.keys(ETIQUETAS_ESTADO) as EstadoMesa[]).map((estado) => (
                      <button
                        key={estado}
                        type="button"
                        disabled={cambiandoEstado || seleccionada.estado === estado}
                        onClick={() => cambiarEstado(seleccionada, estado)}
                        className={`flex-1 rounded-xl px-2 py-2 text-xs font-bold border transition-all disabled:opacity-50 ${
                          seleccionada.estado === estado
                            ? ESTILOS_ESTADO[estado].etiqueta + ' border-transparent'
                            : 'border-resto-ciruela/15 text-resto-acero hover:border-resto-oliva hover:text-resto-oliva'
                        }`}
                      >
                        {ETIQUETAS_ESTADO[estado]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ACCIONES */}
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => abrirEditar(seleccionada)}
                    className="flex-1 rounded-xl border border-resto-ciruela/15 px-4 py-2.5 text-sm font-bold hover:border-resto-oliva hover:text-resto-oliva transition-colors"
                  >
                    ✎ Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setMesaAEliminar(seleccionada)}
                    className="flex-1 rounded-xl border border-resto-ciruela/15 px-4 py-2.5 text-sm font-bold text-resto-acero hover:border-resto-dorado hover:text-resto-canela transition-colors"
                  >
                    🗑 Eliminar
                  </button>
                </div>

                {/* PLATOS ACTUALES (sesión de la ocupación en curso) */}
                <div className="mt-6">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-resto-acero mb-2">
                    Platos actuales
                  </p>
                  {loadingHistorial ? (
                    <p className="text-sm text-resto-acero italic">Cargando platos...</p>
                  ) : producciones.length === 0 ? (
                    <p className="text-sm text-resto-acero italic">
                      {seleccionada.estado === 'OCUPADA'
                        ? 'Todavía no se preparó ningún plato en esta ocupación. Hacelo desde el Menú.'
                        : 'Marcá la mesa como Ocupada y prepará platos desde el Menú para verlos acá.'}
                    </p>
                  ) : (
                    <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {producciones.map((produccion) => (
                        <li key={produccion.id ?? `${produccion.platoNombre}-${produccion.fechaHora}`} className="rounded-xl border border-resto-ciruela/10 bg-resto-manteca/50 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-bold truncate">{produccion.platoNombre}</p>
                            <span className="shrink-0 text-xs font-black text-resto-oliva">x{formatearCantidad(produccion.cantidad)}</span>
                          </div>
                          <p className="text-[11px] text-resto-acero mt-0.5">
                            {formatearFecha(produccion.fechaHora)}
                            {produccion.usuarioEmail ? ` · ${produccion.usuarioEmail}` : ''}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* MODAL ALTA / EDICIÓN DE MESA */}
      {modal && (
        <Modal
          ariaLabel={editandoId != null ? 'Editar mesa' : 'Nueva mesa'}
          onClose={cerrarModal}
        >
          <form onSubmit={guardarMesa} className="w-full max-w-md rounded-[2rem] bg-white p-6 md:p-8 shadow-xl">
            <h3 className="text-2xl font-black">{editandoId != null ? 'Editar mesa' : 'Nueva mesa'}</h3>
            <p className="text-sm text-resto-acero mt-2">
              {editandoId != null
                ? 'Corregí el nombre, la capacidad o el estado.'
                : 'Se agrega al mapa; después la arrastrás a su lugar.'}
            </p>

            {errorModal && (
              <div className="mt-4 rounded-xl border border-resto-dorado/40 bg-resto-dorado/10 px-4 py-3 text-sm" role="alert">
                {errorModal}
              </div>
            )}

            <div className="mt-6 space-y-4">
              <div>
                <label htmlFor="mesaNombre" className="block text-sm font-semibold mb-1.5">Nombre</label>
                <input
                  id="mesaNombre"
                  required
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Mesa 1, Barra, Terraza 2"
                  className="w-full rounded-xl border border-resto-acero/20 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-resto-oliva"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="mesaCapacidad" className="block text-sm font-semibold mb-1.5">Capacidad</label>
                  <input
                    id="mesaCapacidad"
                    type="number"
                    min="1"
                    step="1"
                    value={form.capacidad}
                    onChange={(e) => setForm((f) => ({ ...f, capacidad: e.target.value }))}
                    placeholder="Personas"
                    className="w-full rounded-xl border border-resto-acero/20 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-resto-oliva"
                  />
                </div>
                <div>
                  <label htmlFor="mesaEstado" className="block text-sm font-semibold mb-1.5">Estado</label>
                  <select
                    id="mesaEstado"
                    value={form.estado}
                    onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value as EstadoMesa }))}
                    className="w-full rounded-xl border border-resto-acero/20 px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-resto-oliva"
                  >
                    <option value="LIBRE">Libre</option>
                    <option value="OCUPADA">Ocupada</option>
                    <option value="RESERVADA">Reservada</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="submit"
                disabled={guardando}
                className="rounded-xl bg-resto-oliva px-5 py-3 text-sm font-bold text-resto-manteca hover:bg-resto-dorado hover:text-resto-ciruela disabled:opacity-60"
              >
                {guardando ? 'Guardando...' : editandoId != null ? 'Guardar cambios' : 'Crear mesa'}
              </button>
              <button type="button" onClick={cerrarModal} className="rounded-xl border border-resto-ciruela/15 px-5 py-3 text-sm font-bold">
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {mesaAEliminar && (
        <ConfirmDialog
          titulo="Eliminar mesa"
          mensaje={`¿Eliminar "${mesaAEliminar.nombre}" del mapa? El historial de platos preparados se conserva.`}
          onCancel={() => setMesaAEliminar(null)}
          onConfirm={() => {
            const mesa = mesaAEliminar;
            setMesaAEliminar(null);
            void eliminarMesa(mesa);
          }}
        />
      )}

      {mesaALiberar && (
        <ConfirmDialog
          titulo="Liberar mesa"
          mensaje={`${producciones.length} plato(s) dejarán de mostrarse. El historial de producción se conserva.`}
          onCancel={() => setMesaALiberar(null)}
          onConfirm={() => {
            const { mesa, estado } = mesaALiberar;
            setMesaALiberar(null);
            void ejecutarCambioEstado(mesa, estado);
          }}
        />
      )}
    </main>
  );
}
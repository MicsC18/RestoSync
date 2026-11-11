'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiUrl, authHeaders } from '@/lib/api';
import { formatearCantidad } from '@/lib/numero';
import { etiquetaUnidad } from '@/lib/insumos';
import { useAuthSession } from '@/lib/use-auth-session';
import AppHeader from '@/components/app-header';
import Modal from '@/components/modal';
import ConfirmDialog from '@/components/confirm-dialog';

type RecetaLinea = {
  id: number;
  insumoId: number;
  insumoNombre: string;
  icono?: string | null;
  unidadMedida: string;
  cantidad: number;
};

type Plato = {
  id: number;
  nombre: string;
  descripcion?: string | null;
  precio?: number | null;
  activo: boolean;
  ingredientes: RecetaLinea[];
};

type Insumo = {
  id: number;
  nombre: string;
  icono?: string | null;
  categoria?: string | null;
  unidadMedida?: string;
  cantidad?: number | null;
};

type Mesa = {
  id: number;
  nombre: string;
  capacidad?: number | null;
  estado: 'LIBRE' | 'OCUPADA' | 'RESERVADA';
};

type StockRestante = { nombre: string; unidadMedida: string; cantidadRestante: number };

type Preparacion = {
  produccionId: number | null;
  platoNombre: string;
  cantidad: number;
  mesaId: number | null;
  mesaNombre: string | null;
  stockRestante: StockRestante[];
};

type LineaForm = { insumoId: number; cantidad: string };

const formPlatoVacio = { nombre: '', descripcion: '', precio: '', activo: true };

export default function MenuPage() {
  const { token, checking, logout, sesion, localActivoId, setLocalActivoId } = useAuthSession();

  const [platos, setPlatos] = useState<Plato[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  // Modal alta/edición de plato + receta.
  const [modalPlato, setModalPlato] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [formPlato, setFormPlato] = useState(formPlatoVacio);
  const [lineas, setLineas] = useState<LineaForm[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState('');

  // Modal preparar.
  const [platoAPreparar, setPlatoAPreparar] = useState<Plato | null>(null);
  const [cantidadPreparar, setCantidadPreparar] = useState('1');
  const [mesaIdPreparar, setMesaIdPreparar] = useState('');
  const [preparando, setPreparando] = useState(false);
  const [errorPreparar, setErrorPreparar] = useState('');
  const [resultado, setResultado] = useState<Preparacion | null>(null);
  const [nuevaMesa, setNuevaMesa] = useState('');
  const [creandoMesa, setCreandoMesa] = useState(false);

  // Confirmación de eliminación (reemplaza al confirm() nativo).
  const [platoAEliminar, setPlatoAEliminar] = useState<Plato | null>(null);

  const cargarDatos = useCallback(async () => {
    if (!token || localActivoId == null) return;
    setLoading(true);
    setError('');
    try {
      const headers = authHeaders(token, localActivoId);
      const [resPlatos, resInsumos, resMesas] = await Promise.all([
        fetch(apiUrl('/api/v1/platos'), { headers }),
        fetch(apiUrl('/api/v1/insumos'), { headers }),
        fetch(apiUrl('/api/v1/mesas'), { headers }),
      ]);
      if (!resPlatos.ok) throw new Error('No se pudo cargar el menú.');
      setPlatos(await resPlatos.json());
      setInsumos(resInsumos.ok ? await resInsumos.json() : []);
      setMesas(resMesas.ok ? await resMesas.json() : []);
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
      setError('Creá un local para gestionar el menú.');
      return;
    }
    void cargarDatos();
  }, [checking, token, localActivoId, retryCount, cargarDatos]);

  // =========================
  // ALTA / EDICIÓN DE PLATO
  // =========================
  const abrirNuevoPlato = () => {
    setEditandoId(null);
    setFormPlato(formPlatoVacio);
    setLineas([]);
    setErrorModal('');
    setModalPlato(true);
  };

  const abrirEditarPlato = (plato: Plato) => {
    setEditandoId(plato.id);
    setFormPlato({
      nombre: plato.nombre,
      descripcion: plato.descripcion ?? '',
      precio: plato.precio != null ? String(plato.precio) : '',
      activo: plato.activo,
    });
    setLineas(plato.ingredientes.map((l) => ({ insumoId: l.insumoId, cantidad: formatearCantidad(l.cantidad) })));
    setErrorModal('');
    setModalPlato(true);
  };

  const cerrarModalPlato = () => {
    if (guardando) return;
    setModalPlato(false);
    setEditandoId(null);
    setErrorModal('');
  };

  const agregarLinea = () => {
    const primero = insumos[0]?.id ?? 0;
    setLineas((actuales) => [...actuales, { insumoId: primero, cantidad: '1' }]);
  };

  const guardarPlato = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const nombre = formPlato.nombre.trim();
    if (!nombre) {
      setErrorModal('El nombre del plato es obligatorio.');
      return;
    }
    const precio = formPlato.precio.trim() === '' ? null : Number(formPlato.precio);
    if (precio != null && (!Number.isFinite(precio) || precio < 0)) {
      setErrorModal('El precio debe ser un número positivo (o dejalo vacío).');
      return;
    }
    const ingredientes = lineas.map((l) => ({ insumoId: l.insumoId, cantidad: Number(l.cantidad) }));
    if (ingredientes.some((l) => !l.insumoId || !Number.isFinite(l.cantidad) || l.cantidad <= 0)) {
      setErrorModal('Cada ingrediente necesita un insumo y una cantidad mayor a cero.');
      return;
    }

    setGuardando(true);
    setErrorModal('');
    try {
      const payload = {
        nombre,
        descripcion: formPlato.descripcion.trim() || null,
        precio,
        activo: formPlato.activo,
        ingredientes,
      };
      const response = await fetch(
        apiUrl(editandoId != null ? `/api/v1/platos/${editandoId}` : '/api/v1/platos'),
        {
          method: editandoId != null ? 'PUT' : 'POST',
          headers: authHeaders(token, localActivoId),
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || data?.error || 'No se pudo guardar el plato.');
      }
      setModalPlato(false);
      setEditandoId(null);
      setExito(editandoId != null ? 'Plato actualizado.' : 'Plato creado en el menú.');
      setRetryCount((c) => c + 1);
    } catch (err: unknown) {
      setErrorModal(err instanceof Error ? err.message : 'Error al guardar el plato.');
    } finally {
      setGuardando(false);
    }
  };

  const eliminarPlato = async (plato: Plato) => {
    if (!token) return;
    try {
      const response = await fetch(apiUrl(`/api/v1/platos/${plato.id}`), {
        method: 'DELETE',
        headers: authHeaders(token, localActivoId),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || data?.error || 'No se pudo eliminar el plato.');
      }
      setExito(`"${plato.nombre}" eliminado del menú.`);
      setRetryCount((c) => c + 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al eliminar el plato.');
    }
  };

  // =========================
  // PREPARAR
  // =========================
  const abrirPreparar = (plato: Plato) => {
    setPlatoAPreparar(plato);
    setCantidadPreparar('1');
    setMesaIdPreparar('');
    setErrorPreparar('');
    setResultado(null);
    setNuevaMesa('');
  };

  const cerrarPreparar = () => {
    if (preparando) return;
    setPlatoAPreparar(null);
    setResultado(null);
    setErrorPreparar('');
  };

  const crearMesaRapida = async () => {
    if (!token) return;
    const nombre = nuevaMesa.trim();
    if (!nombre) return;
    setCreandoMesa(true);
    setErrorPreparar('');
    try {
      const response = await fetch(apiUrl('/api/v1/mesas'), {
        method: 'POST',
        headers: authHeaders(token, localActivoId),
        body: JSON.stringify({ nombre }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || data?.error || 'No se pudo crear la mesa.');
      }
      const mesa: Mesa = await response.json();
      setMesas((actuales) => [...actuales, mesa].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setMesaIdPreparar(String(mesa.id));
      setNuevaMesa('');
    } catch (err: unknown) {
      setErrorPreparar(err instanceof Error ? err.message : 'Error al crear la mesa.');
    } finally {
      setCreandoMesa(false);
    }
  };

  const confirmarPreparar = async () => {
    if (!token || !platoAPreparar) return;
    const cantidad = Number(cantidadPreparar);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      setErrorPreparar('La cantidad a preparar debe ser mayor a cero.');
      return;
    }
    setPreparando(true);
    setErrorPreparar('');
    try {
      const response = await fetch(apiUrl(`/api/v1/platos/${platoAPreparar.id}/preparar`), {
        method: 'POST',
        headers: authHeaders(token, localActivoId),
        body: JSON.stringify({
          cantidad,
          mesaId: mesaIdPreparar === '' ? null : Number(mesaIdPreparar),
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || data?.error || 'No se pudo preparar el plato.');
      }
      const data: Preparacion = await response.json();
      setResultado(data);
      setExito(`"${data.platoNombre}" preparado${data.mesaNombre ? ` para ${data.mesaNombre}` : ''}. Stock descontado.`);
      setRetryCount((c) => c + 1);
    } catch (err: unknown) {
      setErrorPreparar(err instanceof Error ? err.message : 'Error al preparar el plato.');
    } finally {
      setPreparando(false);
    }
  };

  if (checking || !token) {
    return (
      <main className="min-h-screen bg-resto-manteca flex items-center justify-center text-resto-ciruela">
        <p role="status">Verificando sesión...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-resto-manteca text-resto-ciruela">
      <AppHeader
        activePage="menu"
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
              Cocina
            </div>
            <h2 className="text-4xl md:text-5xl font-black leading-tight">
              Menú <span className="text-resto-oliva">del local.</span>
            </h2>
            <p className="mt-4 text-resto-acero max-w-xl leading-relaxed">
              Creá los platos con sus ingredientes y preparalos para una mesa. Al preparar se
              descuenta el stock FIFO por vencimiento, agrupando los insumos del mismo nombre.
            </p>
          </div>
          <div className="shrink-0">
            <button
              type="button"
              onClick={abrirNuevoPlato}
              className="px-6 py-3.5 rounded-xl bg-resto-oliva text-resto-manteca font-bold hover:bg-resto-dorado hover:text-resto-ciruela transition-all shadow-lg shadow-resto-oliva/20"
            >
              + Nuevo plato
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

        {/* LISTADO DE PLATOS */}
        {loading ? (
          <div className="py-20 text-center" role="status">
            <div className="w-10 h-10 mx-auto mb-4 rounded-full border-4 border-resto-oliva/20 border-t-resto-oliva animate-spin" />
            <p className="text-resto-acero font-semibold">Cargando el menú...</p>
          </div>
        ) : platos.length === 0 ? (
          <div className="bg-white rounded-[2rem] border border-resto-ciruela/10 py-16 text-center shadow-sm">
            <div className="text-4xl mb-4">🍽️</div>
            <h3 className="text-lg font-bold">Todavía no hay platos</h3>
            <p className="text-resto-acero text-sm mt-1">Creá el primero con &quot;+ Nuevo plato&quot;.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {platos.map((plato) => (
              <article key={plato.id} className="bg-white rounded-[2rem] border border-resto-ciruela/10 p-6 shadow-sm flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-xl font-black truncate">{plato.nombre}</h3>
                    {plato.descripcion && (
                      <p className="text-sm text-resto-acero mt-1 line-clamp-2">{plato.descripcion}</p>
                    )}
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full ${
                    plato.activo ? 'bg-resto-oliva/10 text-resto-oliva' : 'bg-resto-acero/10 text-resto-acero'
                  }`}>
                    {plato.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                {plato.precio != null && (
                  <p className="mt-3 text-2xl font-black text-resto-oliva">
                    ${plato.precio.toLocaleString('es-AR')}
                  </p>
                )}

                <div className="mt-4 flex-1">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-resto-acero mb-2">
                    Ingredientes ({plato.ingredientes.length})
                  </p>
                  {plato.ingredientes.length === 0 ? (
                    <p className="text-sm text-resto-acero italic">Sin ingredientes cargados.</p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {plato.ingredientes.map((linea) => (
                        <li key={linea.id} className="inline-flex items-center gap-1.5 rounded-full bg-resto-manteca border border-resto-ciruela/10 px-3 py-1 text-xs font-semibold">
                          <span>{linea.icono || '📦'}</span>
                          <span>{linea.insumoNombre}</span>
                          <span className="text-resto-acero">· {formatearCantidad(linea.cantidad)} {etiquetaUnidad(linea.unidadMedida)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-6 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => abrirPreparar(plato)}
                    disabled={!plato.activo || plato.ingredientes.length === 0}
                    title={!plato.activo ? 'El plato está inactivo' : plato.ingredientes.length === 0 ? 'Cargá ingredientes primero' : `Preparar ${plato.nombre}`}
                    className="flex-1 rounded-xl bg-resto-oliva px-4 py-2.5 text-sm font-bold text-resto-manteca hover:bg-resto-dorado hover:text-resto-ciruela transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    🍳 Preparar
                  </button>
                  <button
                    type="button"
                    onClick={() => abrirEditarPlato(plato)}
                    title={`Editar ${plato.nombre}`}
                    aria-label={`Editar ${plato.nombre}`}
                    className="w-10 h-10 rounded-xl border border-resto-ciruela/10 text-resto-acero hover:border-resto-oliva hover:text-resto-oliva transition-colors"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlatoAEliminar(plato)}
                    title={`Eliminar ${plato.nombre}`}
                    aria-label={`Eliminar ${plato.nombre}`}
                    className="w-10 h-10 rounded-xl border border-resto-ciruela/10 text-resto-acero hover:border-resto-dorado hover:text-resto-canela transition-colors"
                  >
                    🗑
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* MODAL ALTA / EDICIÓN DE PLATO */}
      {modalPlato && (
        <Modal
          ariaLabel={editandoId != null ? 'Editar plato' : 'Nuevo plato'}
          onClose={cerrarModalPlato}
        >
          <form onSubmit={guardarPlato} className="w-full max-w-2xl rounded-[2rem] bg-white p-6 md:p-8 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-black">{editandoId != null ? 'Editar plato' : 'Nuevo plato'}</h3>
            <p className="text-sm text-resto-acero mt-2">
              Definí el plato y sus ingredientes. Las cantidades son por unidad de plato.
            </p>

            {errorModal && (
              <div className="mt-4 rounded-xl border border-resto-dorado/40 bg-resto-dorado/10 px-4 py-3 text-sm" role="alert">
                {errorModal}
              </div>
            )}

            <div className="mt-6 space-y-4">
              <div>
                <label htmlFor="platoNombre" className="block text-sm font-semibold mb-1.5">Nombre</label>
                <input
                  id="platoNombre"
                  required
                  value={formPlato.nombre}
                  onChange={(e) => setFormPlato((f) => ({ ...f, nombre: e.target.value }))}
                  className="w-full rounded-xl border border-resto-acero/20 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-resto-oliva"
                />
              </div>
              <div>
                <label htmlFor="platoDescripcion" className="block text-sm font-semibold mb-1.5">Descripción</label>
                <textarea
                  id="platoDescripcion"
                  rows={2}
                  value={formPlato.descripcion}
                  onChange={(e) => setFormPlato((f) => ({ ...f, descripcion: e.target.value }))}
                  className="w-full rounded-xl border border-resto-acero/20 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-resto-oliva"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="platoPrecio" className="block text-sm font-semibold mb-1.5">Precio (opcional)</label>
                  <input
                    id="platoPrecio"
                    type="number"
                    min="0"
                    step="any"
                    value={formPlato.precio}
                    onChange={(e) => setFormPlato((f) => ({ ...f, precio: e.target.value }))}
                    className="w-full rounded-xl border border-resto-acero/20 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-resto-oliva"
                  />
                </div>
                <div>
                  <label htmlFor="platoActivo" className="block text-sm font-semibold mb-1.5">Estado</label>
                  <select
                    id="platoActivo"
                    value={formPlato.activo ? 'true' : 'false'}
                    onChange={(e) => setFormPlato((f) => ({ ...f, activo: e.target.value === 'true' }))}
                    className="w-full rounded-xl border border-resto-acero/20 px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-resto-oliva"
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
              </div>

              {/* INGREDIENTES */}
              <div className="rounded-2xl border border-resto-ciruela/10 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold">Ingredientes</p>
                  <button
                    type="button"
                    onClick={agregarLinea}
                    disabled={insumos.length === 0}
                    className="rounded-lg border border-resto-oliva/40 px-3 py-1.5 text-xs font-bold text-resto-oliva hover:bg-resto-oliva/10 disabled:opacity-40"
                  >
                    + Agregar ingrediente
                  </button>
                </div>
                {insumos.length === 0 ? (
                  <p className="text-sm text-resto-acero italic">
                    No hay insumos en el local. Cargá inventario primero (en /inventario o /registro).
                  </p>
                ) : lineas.length === 0 ? (
                  <p className="text-sm text-resto-acero italic">Sin ingredientes. Agregá al menos uno para poder preparar.</p>
                ) : (
                  <div className="space-y-2">
                    {lineas.map((linea, index) => {
                      const insumo = insumos.find((i) => i.id === linea.insumoId);
                      return (
                        <div key={index} className="flex items-center gap-2">
                          <select
                            value={linea.insumoId}
                            onChange={(e) => setLineas((actuales) => actuales.map((l, i) => i === index ? { ...l, insumoId: Number(e.target.value) } : l))}
                            className="flex-1 rounded-xl border border-resto-acero/20 px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-resto-oliva"
                          >
                            {insumos.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.icono || '📦'} {i.nombre} ({formatearCantidad(i.cantidad)} {etiquetaUnidad(i.unidadMedida)})
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={linea.cantidad}
                            onChange={(e) => setLineas((actuales) => actuales.map((l, i) => i === index ? { ...l, cantidad: e.target.value } : l))}
                            className="w-24 rounded-xl border border-resto-acero/20 px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-resto-oliva"
                          />
                          <span className="text-xs text-resto-acero w-20 truncate">{etiquetaUnidad(insumo?.unidadMedida)}</span>
                          <button
                            type="button"
                            onClick={() => setLineas((actuales) => actuales.filter((_, i) => i !== index))}
                            aria-label="Quitar ingrediente"
                            className="w-9 h-9 shrink-0 rounded-lg border border-resto-ciruela/10 text-resto-acero hover:border-resto-dorado hover:text-resto-canela"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="text-[11px] text-resto-acero mt-3">
                  Al preparar, el stock se descuenta FIFO por vencimiento entre todas las filas del mismo nombre.
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="submit"
                disabled={guardando}
                className="rounded-xl bg-resto-oliva px-5 py-3 text-sm font-bold text-resto-manteca hover:bg-resto-dorado hover:text-resto-ciruela disabled:opacity-60"
              >
                {guardando ? 'Guardando...' : editandoId != null ? 'Guardar cambios' : 'Crear plato'}
              </button>
              <button type="button" onClick={cerrarModalPlato} className="rounded-xl border border-resto-ciruela/15 px-5 py-3 text-sm font-bold">
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL PREPARAR */}
      {platoAPreparar && (
        <Modal
          ariaLabel={`Preparar ${platoAPreparar.nombre}`}
          onClose={cerrarPreparar}
        >
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-6 md:p-8 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-black">Preparar {platoAPreparar.nombre}</h3>
            <p className="text-sm text-resto-acero mt-2">
              Elegí cuántas unidades y para qué mesa. Se descuenta el stock de los ingredientes.
            </p>

            {errorPreparar && (
              <div className="mt-4 rounded-xl border border-resto-dorado/40 bg-resto-dorado/10 px-4 py-3 text-sm" role="alert">
                {errorPreparar}
              </div>
            )}

            {resultado ? (
              <div className="mt-6">
                <div className="rounded-2xl border border-resto-oliva/40 bg-resto-oliva/10 p-5">
                  <p className="font-bold text-resto-oliva">
                    ✓ {resultado.platoNombre} x{formatearCantidad(resultado.cantidad)} preparado
                    {resultado.mesaNombre ? ` para ${resultado.mesaNombre}` : ' (sin mesa)'}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-resto-acero mt-4 mb-2">Stock restante</p>
                  <ul className="space-y-1 text-sm">
                    {resultado.stockRestante.map((s) => (
                      <li key={s.nombre} className="flex justify-between">
                        <span>{s.nombre}</span>
                        <span className="font-bold">{formatearCantidad(s.cantidadRestante)} {etiquetaUnidad(s.unidadMedida)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button type="button" onClick={cerrarPreparar} className="mt-6 w-full rounded-xl bg-resto-oliva px-5 py-3 text-sm font-bold text-resto-manteca hover:bg-resto-dorado hover:text-resto-ciruela">
                  Listo
                </button>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <div>
                  <label htmlFor="prepCantidad" className="block text-sm font-semibold mb-1.5">Cantidad</label>
                  <input
                    id="prepCantidad"
                    type="number"
                    min="1"
                    step="any"
                    value={cantidadPreparar}
                    onChange={(e) => setCantidadPreparar(e.target.value)}
                    className="w-full rounded-xl border border-resto-acero/20 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-resto-oliva"
                  />
                </div>
                <div>
                  <label htmlFor="prepMesa" className="block text-sm font-semibold mb-1.5">Mesa</label>
                  <select
                    id="prepMesa"
                    value={mesaIdPreparar}
                    onChange={(e) => setMesaIdPreparar(e.target.value)}
                    className="w-full rounded-xl border border-resto-acero/20 px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-resto-oliva"
                  >
                    <option value="">Sin mesa (para llevar)</option>
                    {mesas.map((mesa) => (
                      <option key={mesa.id} value={mesa.id}>
                        {mesa.nombre} · {mesa.estado}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label htmlFor="nuevaMesa" className="block text-xs font-semibold text-resto-acero mb-1.5">Crear mesa rápida</label>
                    <input
                      id="nuevaMesa"
                      value={nuevaMesa}
                      onChange={(e) => setNuevaMesa(e.target.value)}
                      placeholder="Ej: Mesa 5"
                      className="w-full rounded-xl border border-resto-acero/20 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-resto-oliva"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void crearMesaRapida()}
                    disabled={creandoMesa || nuevaMesa.trim() === ''}
                    className="rounded-xl border border-resto-oliva/40 px-4 py-2.5 text-sm font-bold text-resto-oliva hover:bg-resto-oliva/10 disabled:opacity-40"
                  >
                    {creandoMesa ? 'Creando...' : '+ Mesa'}
                  </button>
                </div>

                <div className="mt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => void confirmarPreparar()}
                    disabled={preparando}
                    className="rounded-xl bg-resto-oliva px-5 py-3 text-sm font-bold text-resto-manteca hover:bg-resto-dorado hover:text-resto-ciruela disabled:opacity-60"
                  >
                    {preparando ? 'Preparando...' : '🍳 Confirmar preparación'}
                  </button>
                  <button type="button" onClick={cerrarPreparar} className="rounded-xl border border-resto-ciruela/15 px-5 py-3 text-sm font-bold">
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {platoAEliminar && (
        <ConfirmDialog
          titulo="Eliminar plato"
          mensaje={`¿Eliminar "${platoAEliminar.nombre}" del menú? Esta acción no se puede deshacer.`}
          onCancel={() => setPlatoAEliminar(null)}
          onConfirm={() => {
            const plato = platoAEliminar;
            setPlatoAEliminar(null);
            void eliminarPlato(plato);
          }}
        />
      )}

      {/* FOOTER */}
      <footer className="border-t border-resto-ciruela/10 mt-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-resto-acero">© 2026 RestoSync. Todos los derechos reservados.</p>
          <p className="text-xs text-resto-acero">Gestión inteligente de tu cocina.</p>
        </div>
      </footer>
    </main>
  );
}
'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { apiUrl, authHeaders } from '@/lib/api';
import { formatearCantidad, redondearCantidad } from '@/lib/numero';
import {
  CATEGORIAS_BASE,
  TIPOS_UNIDAD,
  UNIDADES_POR_TIPO,
  etiquetaUnidad,
  normalizarUnidad,
  tipoDeUnidad,
  unidadPorDefecto,
  iconoParaInsumo,
  type TipoUnidad,
} from '@/lib/insumos';
import { useAuthSession } from '@/lib/use-auth-session';
import AppHeader from '@/components/app-header';
import Modal from '@/components/modal';
import ConfirmDialog from '@/components/confirm-dialog';

type Producto = {
  id: number;
  nombre: string;
  categoria: string;
  icono?: string;
  vencimiento: string | null;
  diasRestantes: number;
  estado: 'Cerrado' | 'Abierto';
  stock: number;
  unidad: string;
};

type InsumoApi = {
  id: number;
  nombre: string;
  categoria?: string | null;
  icono?: string | null;
  vencimiento?: string | null;
  diasRestantes?: number;
  estado?: string;
  cantidad?: number | null;
  unidadMedida?: string;
};

type FormularioInsumo = {
  nombre: string;
  categoria: string;
  cantidad: string;
  unidadMedida: string;
  diasRestantes: string;
  estado: 'Cerrado' | 'Abierto';
};

const formVacio: FormularioInsumo = {
  nombre: '',
  categoria: 'Almacén',
  cantidad: '1',
  unidadMedida: 'unidad',
  diasRestantes: '30',
  estado: 'Cerrado',
};

export default function InventarioPage() {
  const {
    token,
    checking,
    logout,
    sesion,
    localActivoId,
    setLocalActivoId,
  } = useAuthSession();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [filtroCategoria, setFiltroCategoria] = useState<string>('Todas');
  // Las filas que quedan en 0 tras preparar un plato se ocultan por defecto
  // (siguen en la base: las recetas las referencian); el toggle las muestra.
  const [mostrarAgotados, setMostrarAgotados] = useState(false);

  // CRUD correctivo: modal compartido para alta manual (auxiliar) y edición.
  const [modal, setModal] = useState<'alta' | 'editar' | null>(null);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState<FormularioInsumo>(formVacio);
  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState('');

  // Confirmación de eliminación (reemplaza al confirm() nativo).
  const [productoAEliminar, setProductoAEliminar] = useState<Producto | null>(null);

  useEffect(() => {
    if (checking || !token) return;

    if (localActivoId == null) {
      setLoading(false);
      setProductos([]);
      setError('Creá un local para gestionar el inventario.');
      return;
    }

    let active = true;
    const cargarProductos = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(apiUrl('/api/v1/insumos'), {
          headers: authHeaders(token, localActivoId),
        });
        if (!response.ok) throw new Error('No se pudo cargar el inventario.');

        const insumos: InsumoApi[] = await response.json();
        if (active) {
          setProductos(insumos.map((insumo) => ({
            id: insumo.id,
            nombre: insumo.nombre,
            categoria: insumo.categoria || 'Almacén',
            icono: insumo.icono || '📦',
            vencimiento: insumo.vencimiento ?? null,
            diasRestantes: insumo.diasRestantes ?? 0,
            estado: insumo.estado === 'Abierto' ? 'Abierto' : 'Cerrado',
            stock: redondearCantidad(insumo.cantidad),
            unidad: normalizarUnidad(insumo.unidadMedida),
          })));
        }
      } catch (loadError: unknown) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Error de conexión con el backend.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void cargarProductos();
    return () => {
      active = false;
    };
  }, [checking, retryCount, token, localActivoId]);

  // Por defecto se ocultan las filas agotadas (stock 0); el toggle las vuelve a mostrar.
  const agotados = productos.filter((producto) => producto.stock <= 0);
  const productosVisibles = mostrarAgotados ? productos : productos.filter((producto) => producto.stock > 0);

  const categorias = ['Todas', ...new Set(productosVisibles.map((producto) => producto.categoria))];

  // Opciones del selector de categoría: las de la IA + las ya presentes en el inventario
  // + la actual del formulario (por si es una categoría legacy que no está en la base).
  const opcionesCategoria = Array.from(new Set([
    ...CATEGORIAS_BASE,
    ...productos.map((producto) => producto.categoria),
    form.categoria,
  ]));

  // Selector de unidad en dos niveles: la magnitud se deriva de la unidad guardada y
  // el segundo selector ofrece solo sus unidades de precisión (kg/g/mg, l/ml, unidad).
  // La actual se mantiene como opción extra si es legacy y aun no migró (no perderla).
  const tipoUnidadSeleccionado = tipoDeUnidad(form.unidadMedida);
  const opcionesUnidad = Array.from(new Set([
    ...UNIDADES_POR_TIPO[tipoUnidadSeleccionado],
    form.unidadMedida,
  ])).filter(Boolean);

  const productosFiltrados = filtroCategoria === 'Todas'
    ? productosVisibles
    : productosVisibles.filter(p => p.categoria === filtroCategoria);

  const abrirAlta = () => {
    setEditandoId(null);
    setForm(formVacio);
    setErrorModal('');
    setModal('alta');
  };

  const abrirEdicion = (producto: Producto) => {
    setEditandoId(producto.id);
    setForm({
      nombre: producto.nombre,
      categoria: producto.categoria,
      cantidad: formatearCantidad(producto.stock),
      unidadMedida: producto.unidad,
      diasRestantes: String(Math.max(producto.diasRestantes, 0)),
      estado: producto.estado,
    });
    setErrorModal('');
    setModal('editar');
  };

  const cerrarModal = () => {
    if (guardando) return;
    setModal(null);
    setEditandoId(null);
    setErrorModal('');
  };

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const nombre = form.nombre.trim();
    const cantidad = Number(form.cantidad);
    const diasRestantes = Number(form.diasRestantes);
    if (!nombre) {
      setErrorModal('El nombre es obligatorio.');
      return;
    }
    if (!Number.isFinite(cantidad) || cantidad < 0 || (modal === 'alta' && cantidad <= 0)) {
      setErrorModal('La cantidad debe ser un número mayor a cero.');
      return;
    }
    if (!Number.isInteger(diasRestantes) || diasRestantes < 0) {
      setErrorModal('Los días restantes deben ser un número entero positivo o cero.');
      return;
    }

    setGuardando(true);
    setErrorModal('');
    try {
      const payload = {
        nombre,
        categoria: form.categoria.trim() || 'Almacén',
        cantidad,
        unidadMedida: form.unidadMedida.trim() || 'unidad',
        diasRestantes,
        estado: form.estado,
      };
      const response = await fetch(
        apiUrl(modal === 'editar' && editandoId != null
          ? `/api/v1/insumos/${editandoId}`
          : '/api/v1/insumos'),
        {
          method: modal === 'editar' ? 'PUT' : 'POST',
          headers: authHeaders(token, localActivoId),
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || data?.error || 'No se pudo guardar el insumo');
      }
      setModal(null);
      setEditandoId(null);
      setRetryCount((count) => count + 1);
    } catch (err: unknown) {
      setErrorModal(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (producto: Producto) => {
    if (!token) return;

    setError('');
    try {
      const response = await fetch(apiUrl(`/api/v1/insumos/${producto.id}`), {
        method: 'DELETE',
        headers: authHeaders(token, localActivoId),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || data?.error || 'No se pudo eliminar el insumo');
      }
      setRetryCount((count) => count + 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
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
        activePage="inventario"
        onLogout={logout}
        rol={sesion?.rol}
        locales={sesion?.locales ?? []}
        localActivoId={localActivoId}
        onLocalChange={setLocalActivoId}
      />

      {/* CONTENIDO */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-10">

        {/* ENCABEZADO */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-resto-dorado/10 border border-resto-dorado/20 text-resto-canela text-xs font-bold uppercase tracking-wider mb-4">
              <span className="w-2 h-2 rounded-full bg-resto-dorado" />
              Gestión total
            </div>
            <h2 className="text-4xl md:text-5xl font-black leading-tight">
              Inventario <span className="text-resto-oliva">Maestro.</span>
            </h2>
            <p className="mt-4 text-resto-acero max-w-xl leading-relaxed">
              La carga principal es con IA (ticket o dictado). Usá la edición y la carga manual
              para corregir cantidades, vencimientos o errores puntuales.
            </p>
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={abrirAlta}
              className="px-6 py-3.5 rounded-xl border border-resto-oliva/40 text-resto-oliva font-bold hover:bg-resto-oliva/10 transition-all"
            >
              Carga manual
            </button>
            <Link href="/registro?modo=ticket" className="px-6 py-3.5 rounded-xl bg-resto-oliva text-resto-manteca font-bold hover:bg-resto-dorado hover:text-resto-ciruela transition-all shadow-lg shadow-resto-oliva/20 text-center">
              + Nuevo producto con IA
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-resto-dorado/40 bg-resto-dorado/10 px-4 py-3 text-sm" role="alert">
            {error}
          </div>
        )}

        {/* FILTROS */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
          {categorias.map(cat => (
            <button
              key={cat}
              onClick={() => setFiltroCategoria(cat)}
              className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                filtroCategoria === cat
                  ? 'bg-resto-ciruela text-resto-manteca shadow-md'
                  : 'bg-white border border-resto-ciruela/10 text-resto-ciruela hover:border-resto-oliva hover:bg-resto-oliva/5'
              }`}
            >
              {cat}
            </button>
          ))}
          {agotados.length > 0 && (
            <button
              type="button"
              onClick={() => setMostrarAgotados((valor) => !valor)}
              aria-pressed={mostrarAgotados}
              title={mostrarAgotados ? 'Ocultar los insumos sin stock' : 'Mostrar los insumos que quedaron en cero'}
              className={`ml-auto px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all border ${
                mostrarAgotados
                  ? 'bg-resto-dorado/20 border-resto-dorado/40 text-resto-canela'
                  : 'bg-white border-resto-ciruela/10 text-resto-acero hover:border-resto-dorado hover:text-resto-canela'
              }`}
            >
              {mostrarAgotados ? 'Ocultar agotados' : `Agotados (${agotados.length})`}
            </button>
          )}
        </div>

        {/* TABLA DE INVENTARIO */}
        <div className="bg-white rounded-[2rem] border border-resto-ciruela/10 overflow-hidden shadow-sm">
          {loading ? (
            <div className="py-20 text-center" role="status">
              <div className="w-10 h-10 mx-auto mb-4 rounded-full border-4 border-resto-oliva/20 border-t-resto-oliva animate-spin" />
              <p className="text-resto-acero font-semibold">Cargando tu almacén...</p>
            </div>
          ) : error && productos.length === 0 ? (
            <div className="py-16 text-center" role="alert">
              <p className="text-red-700">{error}</p>
              <button
                type="button"
                onClick={() => setRetryCount((count) => count + 1)}
                className="mt-4 rounded-lg bg-resto-oliva px-4 py-2 text-sm font-bold text-resto-manteca"
              >
                Reintentar
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-resto-manteca/50 border-b border-resto-ciruela/10 text-xs uppercase tracking-wider font-bold text-resto-acero">
                    <th className="p-5 font-bold">Producto</th>
                    <th className="p-5 font-bold">Stock</th>
                    <th className="p-5 font-bold">Vencimiento</th>
                    <th className="p-5 font-bold">Estado</th>
                    <th className="p-5 font-bold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-resto-ciruela/5">
                  {productosFiltrados.map((prod) => (
                    <tr key={prod.id} className={`hover:bg-resto-manteca/30 transition-colors group ${prod.stock <= 0 ? 'opacity-60' : ''}`}>
                      <td className="p-5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-resto-oliva/10 flex items-center justify-center text-2xl shrink-0">
                            {prod.icono}
                          </div>
                          <div>
                            <p className="font-bold text-base">{prod.nombre}</p>
                            <p className="text-xs text-resto-acero mt-0.5">{prod.categoria}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-5">
                        <p className="font-black text-lg">
                          {formatearCantidad(prod.stock)} <span className="text-sm font-semibold text-resto-acero">{etiquetaUnidad(prod.unidad)}</span>
                        </p>
                      </td>
                      <td className="p-5">
                        <div className="flex items-center gap-2">
                          {prod.stock <= 0 ? (
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-resto-acero/15 text-resto-acero">
                              Agotado
                            </span>
                          ) : (
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                              prod.diasRestantes <= 3 ? 'bg-resto-dorado/20 text-resto-canela' : 'bg-resto-oliva/10 text-resto-oliva'
                            }`}>
                              {prod.diasRestantes < 0 ? 'Vencido' : `En ${prod.diasRestantes} días`}
                            </span>
                          )}
                          {prod.stock > 0 && prod.vencimiento && <span className="text-sm text-resto-acero hidden sm:inline-block">({prod.vencimiento})</span>}
                        </div>
                      </td>
                      <td className="p-5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${
                          prod.estado === 'Abierto'
                            ? 'bg-resto-ciruela/5 border-resto-ciruela/20 text-resto-ciruela'
                            : 'bg-resto-manteca border-resto-acero/20 text-resto-acero'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${prod.estado === 'Abierto' ? 'bg-resto-ciruela' : 'bg-resto-acero'}`} />
                          {prod.estado}
                        </span>
                      </td>
                      <td className="p-5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => abrirEdicion(prod)}
                          title={`Corregir ${prod.nombre}`}
                          aria-label={`Editar ${prod.nombre}`}
                          className="w-9 h-9 rounded-lg border border-resto-ciruela/10 text-resto-acero hover:border-resto-oliva hover:text-resto-oliva transition-colors"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          onClick={() => setProductoAEliminar(prod)}
                          title={`Eliminar ${prod.nombre}`}
                          aria-label={`Eliminar ${prod.nombre}`}
                          className="ml-2 w-9 h-9 rounded-lg border border-resto-ciruela/10 text-resto-acero hover:border-resto-dorado hover:text-resto-canela transition-colors"
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {productosFiltrados.length === 0 && (
                <div className="py-16 text-center">
                  <div className="text-4xl mb-4">📭</div>
                  <h3 className="text-lg font-bold">No hay productos aquí</h3>
                  <p className="text-resto-acero text-sm mt-1">Probá cambiando el filtro de categoría.</p>
                </div>
              )}
            </div>
          )}
        </div>

      </section>

      {/* MODAL ALTA / EDICIÓN */}
      {modal && (
        <Modal
          ariaLabel={modal === 'editar' ? 'Corregir insumo' : 'Carga manual de insumo'}
          onClose={cerrarModal}
        >
          <form
            onSubmit={guardar}
            className="w-full max-w-lg rounded-[2rem] bg-white p-6 md:p-8 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-2xl font-black">
              {modal === 'editar' ? 'Corregir insumo' : 'Carga manual'}
            </h3>
            <p className="text-sm text-resto-acero mt-2">
              {modal === 'editar'
                ? 'Ajustá cantidad o vencimiento si la IA los detectó mal. El stock se corrige sobre los lotes existentes.'
                : 'Vía auxiliar: si el insumo ya existe con el mismo vencimiento, la cantidad se suma al stock actual.'}
            </p>

            {errorModal && (
              <div className="mt-4 rounded-xl border border-resto-dorado/40 bg-resto-dorado/10 px-4 py-3 text-sm" role="alert">
                {errorModal}
              </div>
            )}

            <div className="mt-6 space-y-4">
              <div>
                <label htmlFor="insumoNombre" className="block text-sm font-semibold mb-1.5">
                  Nombre
                  <span className="ml-2 text-lg align-middle" title="Ícono automático según nombre y categoría">
                    {iconoParaInsumo(form.nombre, form.categoria)}
                  </span>
                </label>
                <input
                  id="insumoNombre"
                  required
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  className="w-full rounded-xl border border-resto-acero/20 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-resto-oliva"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="insumoCategoria" className="block text-sm font-semibold mb-1.5">Categoría</label>
                  <select
                    id="insumoCategoria"
                    value={form.categoria}
                    onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
                    className="w-full rounded-xl border border-resto-acero/20 px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-resto-oliva"
                  >
                    {opcionesCategoria.map((categoria) => (
                      <option key={categoria} value={categoria}>{categoria}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="insumoTipoUnidad" className="block text-sm font-semibold mb-1.5">Tipo de medida</label>
                  <select
                    id="insumoTipoUnidad"
                    value={tipoUnidadSeleccionado}
                    onChange={(e) => setForm((f) => ({ ...f, unidadMedida: unidadPorDefecto(e.target.value as TipoUnidad) }))}
                    className="w-full rounded-xl border border-resto-acero/20 px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-resto-oliva"
                  >
                    {TIPOS_UNIDAD.map((tipo) => (
                      <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="insumoUnidad" className="block text-sm font-semibold mb-1.5">Unidad</label>
                  <select
                    id="insumoUnidad"
                    value={form.unidadMedida}
                    onChange={(e) => setForm((f) => ({ ...f, unidadMedida: e.target.value }))}
                    className="w-full rounded-xl border border-resto-acero/20 px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-resto-oliva"
                  >
                    {opcionesUnidad.map((unidad) => (
                      <option key={unidad} value={unidad}>{etiquetaUnidad(unidad)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="insumoCantidad" className="block text-sm font-semibold mb-1.5">Cantidad</label>
                  <input
                    id="insumoCantidad"
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={form.cantidad}
                    onChange={(e) => setForm((f) => ({ ...f, cantidad: e.target.value }))}
                    className="w-full rounded-xl border border-resto-acero/20 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-resto-oliva"
                  />
                </div>
                <div>
                  <label htmlFor="insumoDias" className="block text-sm font-semibold mb-1.5">Días restantes</label>
                  <input
                    id="insumoDias"
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={form.diasRestantes}
                    onChange={(e) => setForm((f) => ({ ...f, diasRestantes: e.target.value }))}
                    className="w-full rounded-xl border border-resto-acero/20 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-resto-oliva"
                  />
                </div>
                <div>
                  <label htmlFor="insumoEstado" className="block text-sm font-semibold mb-1.5">Estado</label>
                  <select
                    id="insumoEstado"
                    value={form.estado}
                    onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value as FormularioInsumo['estado'] }))}
                    className="w-full rounded-xl border border-resto-acero/20 px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-resto-oliva"
                  >
                    <option value="Cerrado">Cerrado</option>
                    <option value="Abierto">Abierto</option>
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
                {guardando ? 'Guardando...' : modal === 'editar' ? 'Guardar corrección' : 'Agregar al inventario'}
              </button>
              <button
                type="button"
                onClick={cerrarModal}
                className="rounded-xl border border-resto-ciruela/15 px-5 py-3 text-sm font-bold"
              >
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {productoAEliminar && (
        <ConfirmDialog
          titulo="Eliminar insumo"
          mensaje={`¿Eliminar "${productoAEliminar.nombre}" del inventario? Se borran también sus lotes.`}
          onCancel={() => setProductoAEliminar(null)}
          onConfirm={() => {
            const producto = productoAEliminar;
            setProductoAEliminar(null);
            void eliminar(producto);
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
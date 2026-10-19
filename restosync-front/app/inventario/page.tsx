'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiUrl } from '@/lib/api';
import { useAuthSession } from '@/lib/use-auth-session';
import AppNavigation from '@/components/app-navigation';

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

export default function InventarioPage() {
  const { token, checking, logout } = useAuthSession();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [filtroCategoria, setFiltroCategoria] = useState<string>('Todas');

  useEffect(() => {
    if (checking || !token) return;

    let active = true;
    const cargarProductos = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(apiUrl('/api/v1/insumos'), {
          headers: { Authorization: `Bearer ${token}` },
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
            stock: insumo.cantidad ?? 0,
            unidad: insumo.unidadMedida || 'Unidades',
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
  }, [checking, retryCount, token]);

  const categorias = ['Todas', ...new Set(productos.map((producto) => producto.categoria))];

  const productosFiltrados = filtroCategoria === 'Todas' 
    ? productos 
    : productos.filter(p => p.categoria === filtroCategoria);

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

          <AppNavigation activePage="inventario" onLogout={logout} />
        </div>
      </header>

      {/* CONTENIDO */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-10">
        
        {/* ENCABEZADO */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-resto-dorado/10 border border-resto-dorado/20 text-resto-dorado text-xs font-bold uppercase tracking-wider mb-4">
              <span className="w-2 h-2 rounded-full bg-resto-dorado" />
              Gestión total
            </div>
            <h2 className="text-4xl md:text-5xl font-black leading-tight">
              Inventario <span className="text-resto-oliva">Maestro.</span>
            </h2>
            <p className="mt-4 text-resto-acero max-w-xl leading-relaxed">
              Controla el stock exacto, gestiona los lotes abiertos y evita mermas filtrando por productos próximos a vencer.
            </p>
          </div>
          
          <Link href="/registro?modo=ticket" className="shrink-0 px-6 py-3.5 rounded-xl bg-resto-oliva text-resto-manteca font-bold hover:bg-resto-dorado hover:text-resto-ciruela transition-all shadow-lg shadow-resto-oliva/20">
            + Nuevo producto
          </Link>
        </div>

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
        </div>

        {/* TABLA DE INVENTARIO */}
        <div className="bg-white rounded-[2rem] border border-resto-ciruela/10 overflow-hidden shadow-sm">
          {loading ? (
            <div className="py-20 text-center">
              <div className="w-10 h-10 mx-auto mb-4 rounded-full border-4 border-resto-oliva/20 border-t-resto-oliva animate-spin" />
              <p className="text-resto-acero font-semibold">Cargando tu almacén...</p>
            </div>
          ) : error ? (
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
                    <tr key={prod.id} className="hover:bg-resto-manteca/30 transition-colors group">
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
                          {prod.stock} <span className="text-sm font-semibold text-resto-acero">{prod.unidad}</span>
                        </p>
                      </td>
                      <td className="p-5">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                            prod.diasRestantes <= 3 ? 'bg-resto-dorado/20 text-resto-dorado' : 'bg-resto-oliva/10 text-resto-oliva'
                          }`}>
                            En {prod.diasRestantes} días
                          </span>
                          {prod.vencimiento && <span className="text-sm text-resto-acero hidden sm:inline-block">({prod.vencimiento})</span>}
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
                      <td className="p-5 text-right">
                        <button disabled title="La edición todavía no está disponible" aria-label={`Editar ${prod.nombre} (no disponible)`} className="w-9 h-9 rounded-lg border border-resto-ciruela/10 text-resto-acero opacity-40 cursor-not-allowed">
                          ✎
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
                  <p className="text-resto-acero text-sm mt-1">Prueba cambiando el filtro de categoría.</p>
                </div>
              )}
            </div>
          )}
        </div>

      </section>

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

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Producto = {
  id: number;
  nombre: string;
  categoria: string;
  icono?: string;
  vencimiento: string;
  diasRestantes: number;
  estado: 'Cerrado' | 'Abierto';
  stock: number;
  unidad: string;
};

export default function InventarioPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState<string>('Todas');

  useEffect(() => {
    // Simulando fetch de base de datos con timeout para efecto de carga
    setTimeout(() => {
      setProductos([
        { id: 1, nombre: 'Leche Larga Vida 1L', categoria: 'Lácteos', icono: '🥛', vencimiento: '20/12/2026', diasRestantes: 74, estado: 'Cerrado', stock: 15, unidad: 'Unidades' },
        { id: 2, nombre: 'Queso Cheddar', categoria: 'Lácteos', icono: '🧀', vencimiento: '15/10/2026', diasRestantes: 8, estado: 'Abierto', stock: 2.5, unidad: 'Kg' },
        { id: 3, nombre: 'Tomates Perita', categoria: 'Verduras', icono: '🍅', vencimiento: '10/10/2026', diasRestantes: 3, estado: 'Cerrado', stock: 10, unidad: 'Kg' },
        { id: 4, nombre: 'Carne Picada', categoria: 'Carnes', icono: '🥩', vencimiento: '08/10/2026', diasRestantes: 1, estado: 'Abierto', stock: 5, unidad: 'Kg' },
        { id: 5, nombre: 'Levadura Fresca', categoria: 'Almacén', icono: '🍞', vencimiento: '30/10/2026', diasRestantes: 23, estado: 'Cerrado', stock: 1, unidad: 'Unidades' },
        { id: 6, nombre: 'Cebollas', categoria: 'Verduras', icono: '🧅', vencimiento: '15/11/2026', diasRestantes: 39, estado: 'Cerrado', stock: 20, unidad: 'Kg' },
      ]);
      setLoading(false);
    }, 800);
  }, []);

  const categorias = ['Todas', 'Lácteos', 'Verduras', 'Carnes', 'Almacén', 'Bebidas'];

  const productosFiltrados = filtroCategoria === 'Todas' 
    ? productos 
    : productos.filter(p => p.categoria === filtroCategoria);

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
            <Link href="/inventario" className="px-4 py-2 rounded-xl bg-resto-ciruela text-resto-manteca text-sm font-semibold">Inventario</Link>
            <Link href="/registro?modo=ticket" className="px-4 py-2 rounded-xl text-resto-ciruela text-sm font-semibold hover:bg-resto-oliva/10 transition-colors">Agregar compra</Link>
            <Link href="/analitica" className="px-4 py-2 rounded-xl text-resto-ciruela text-sm font-semibold hover:bg-resto-oliva/10 transition-colors">Analítica</Link>
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-3 px-4 py-2 rounded-xl border border-resto-ciruela/10">
              <div className="w-8 h-8 rounded-full bg-resto-oliva text-resto-manteca flex items-center justify-center font-bold">M</div>
              <div>
                <p className="text-xs font-bold">Mi cocina</p>
                <p className="text-[10px] text-resto-acero">Cuenta activa</p>
              </div>
            </div>
            <Link href="/login" className="text-xs font-bold text-resto-ciruela px-3 py-2 rounded-lg hover:bg-resto-ciruela hover:text-resto-manteca transition-all">Salir</Link>
          </div>
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
                          <span className="text-sm text-resto-acero hidden sm:inline-block">({prod.vencimiento})</span>
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
                        <button className="w-9 h-9 rounded-lg border border-resto-ciruela/10 text-resto-acero hover:bg-resto-oliva hover:text-resto-manteca hover:border-transparent transition-all">
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

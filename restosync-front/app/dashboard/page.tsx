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
};

export default function DashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loadingProductos, setLoadingProductos] = useState(true);
  const [mostrarAgregar, setMostrarAgregar] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');

    if (!storedToken) {
      window.location.href = '/login';
      return;
    }

    setToken(storedToken);

    const fetchProductos = async () => {
      try {
        const response = await fetch(
          'http://localhost:8080/api/v1/insumos',
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${storedToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          console.error(
            'No se pudieron obtener los productos de la base de datos'
          );
          return;
        }

        const data = await response.json();

        setProductos(data);
      } catch (error) {
        console.error(
          'Error de conexión con el backend:',
          error
        );
      } finally {
        setLoadingProductos(false);
      }
    };

    fetchProductos();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };


  const totalProductos = productos.length;

  const productosProximosAVencer = productos.filter(
    (producto) => producto.diasRestantes <= 3
  ).length;

  const productosAbiertos = productos.filter(
    (producto) => producto.estado === 'Abierto'
  ).length;

  // Ordenamos por urgencia
  const productosOrdenados = [...productos].sort(
    (a, b) => a.diasRestantes - b.diasRestantes
  );



  if (!token) {
    return (
      <main className="min-h-screen bg-resto-manteca flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 mx-auto mb-4 rounded-full border-4 border-resto-oliva/20 border-t-resto-oliva animate-spin" />

          <p className="text-resto-ciruela font-semibold">
            Cargando tu cocina...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-resto-manteca text-resto-ciruela">

      {/* =========================
          NAVBAR
      ========================= */}
      <header className="sticky top-0 z-50 border-b border-resto-ciruela/10 bg-resto-manteca/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-20 flex items-center justify-between">

          {/* LOGO */}
          <Link href="/dashboard" className="shrink-0">
            <h1 className="text-2xl font-black tracking-tight">
              Resto<span className="text-resto-dorado">Sync.</span>
            </h1>

            <p className="text-[10px] uppercase tracking-[0.2em] text-resto-acero">
              Tu cocina sincronizada
            </p>
          </Link>

          {/* NAVEGACIÓN */}
          <nav className="hidden md:flex items-center gap-2">

            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-xl bg-resto-ciruela text-resto-manteca text-sm font-semibold"
            >
              Inicio
            </Link>

            <Link
              href="/inventario"
              className="px-4 py-2 rounded-xl text-resto-ciruela text-sm font-semibold hover:bg-resto-oliva/10 transition-colors"
            >
              Inventario
            </Link>

            <button
              type="button"
              onClick={() => setMostrarAgregar(true)}
              className="px-4 py-2 rounded-xl text-resto-ciruela text-sm font-semibold hover:bg-resto-oliva/10 transition-colors"
            >
              Agregar compra
            </button>

            <Link
              href="/analitica"
              className="px-4 py-2 rounded-xl text-resto-ciruela text-sm font-semibold hover:bg-resto-oliva/10 transition-colors"
            >
              Analítica
            </Link>

          </nav>

          {/* USUARIO */}
          <div className="flex items-center gap-3">

            <div className="hidden lg:flex items-center gap-3 px-4 py-2 rounded-xl border border-resto-ciruela/10">

              <div className="w-8 h-8 rounded-full bg-resto-oliva text-resto-manteca flex items-center justify-center font-bold">
                M
              </div>

              <div>
                <p className="text-xs font-bold">
                  Mi cocina
                </p>

                <p className="text-[10px] text-resto-acero">
                  Cuenta activa
                </p>
              </div>

            </div>

            <button
              onClick={handleLogout}
              className="text-xs font-bold text-resto-ciruela px-3 py-2 rounded-lg hover:bg-resto-ciruela hover:text-resto-manteca transition-all"
            >
              Salir
            </button>

          </div>

        </div>
      </header>


      {/* =========================
          CONTENIDO
      ========================= */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-10">

        {/* HERO */}
        <div className="relative overflow-hidden rounded-[2rem] bg-resto-ciruela text-resto-manteca p-8 md:p-10 mb-8">

          <div className="relative z-10 max-w-2xl">

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-resto-dorado/10 border border-resto-dorado/20 text-resto-dorado text-xs font-bold uppercase tracking-wider mb-5">
              <span className="w-2 h-2 rounded-full bg-resto-dorado" />
              Resumen de hoy
            </div>

            <h2 className="text-4xl md:text-5xl font-black leading-tight">
              Tu cocina,
              <span className="block text-resto-dorado">
                bajo control.
              </span>
            </h2>

            <p className="mt-4 text-resto-manteca/70 max-w-xl leading-relaxed">
              Revisá rápidamente qué productos necesitan
              atención y mantené tu inventario actualizado
              desde la base de datos.
            </p>

          </div>

          {/* DECORACIÓN */}
          <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full border border-resto-dorado/10" />
          <div className="absolute -right-10 -bottom-32 w-64 h-64 rounded-full bg-resto-oliva/20" />

        </div>


        {/* =========================
            ALERTAS PRINCIPALES
        ========================= */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">

          {/* PRÓXIMOS A VENCER */}
          <div className="rounded-2xl border border-resto-dorado/30 bg-resto-dorado/10 p-5">

            <div className="flex items-center justify-between">
              <span className="text-2xl">
                ⚠️
              </span>

              <span className="text-xs font-bold text-resto-dorado uppercase tracking-wide">
                Atención
              </span>
            </div>

            <p className="text-3xl font-black mt-4">
              {productosProximosAVencer}
            </p>

            <p className="text-sm font-semibold mt-1">
              productos vencen pronto
            </p>

            <p className="text-xs text-resto-acero mt-2">
              Próximos 3 días
            </p>

          </div>


          {/* ABIERTOS */}
          <div className="rounded-2xl border border-resto-oliva/20 bg-resto-oliva/10 p-5">

            <div className="flex items-center justify-between">
              <span className="text-2xl">
                🫙
              </span>

              <span className="text-xs font-bold text-resto-oliva uppercase tracking-wide">
                Estado
              </span>
            </div>

            <p className="text-3xl font-black mt-4">
              {productosAbiertos}
            </p>

            <p className="text-sm font-semibold mt-1">
              productos abiertos
            </p>

            <p className="text-xs text-resto-acero mt-2">
              En uso actual
            </p>

          </div>


          {/* TOTAL */}
          <div className="rounded-2xl border border-resto-acero/20 bg-resto-acero/10 p-5">

            <div className="flex items-center justify-between">
              <span className="text-2xl">
                📦
              </span>

              <span className="text-xs font-bold text-resto-acero uppercase tracking-wide">
                Inventario
              </span>
            </div>

            <p className="text-3xl font-black mt-4">
              {totalProductos}
            </p>

            <p className="text-sm font-semibold mt-1">
              productos registrados
            </p>

            <p className="text-xs text-resto-acero mt-2">
              Total en base de datos
            </p>

          </div>

        </div>


        {/* =========================
            SECCIÓN PRINCIPAL
        ========================= */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-8">

          {/* PRODUCTOS */}
          <section className="rounded-[2rem] border border-resto-ciruela/10 bg-resto-manteca p-6 md:p-8">

            <div className="flex items-center justify-between mb-6">

              <div>
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-resto-oliva">
                  Prioridad
                </span>

                <h3 className="text-2xl font-black mt-1">
                  Inventario en tiempo real
                </h3>
              </div>

              <Link
                href="/inventario"
                className="text-sm font-bold text-resto-oliva hover:text-resto-dorado transition-colors"
              >
                Ver todo →
              </Link>

            </div>


            {/* CARGANDO */}
            {loadingProductos && (
              <div className="py-14 text-center">

                <div className="w-9 h-9 mx-auto mb-4 rounded-full border-4 border-resto-oliva/20 border-t-resto-oliva animate-spin" />

                <p className="text-sm text-resto-acero">
                  Cargando datos desde la base de datos...
                </p>

              </div>
            )}


            {/* SIN PRODUCTOS */}
            {!loadingProductos && productos.length === 0 && (
              <div className="py-12 text-center">

                <div className="text-5xl mb-4">
                  📭
                </div>

                <h4 className="text-lg font-bold">
                  Aún no hay productos
                </h4>

                <p className="text-sm text-resto-acero max-w-sm mx-auto mt-2 leading-relaxed">
                  Empezá registrando tu primera compra para
                  verla reflejada acá.
                </p>

                <button
                  type="button"
                  onClick={() => setMostrarAgregar(true)}
                  className="mt-6 bg-resto-oliva text-resto-manteca text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-resto-dorado hover:text-resto-ciruela transition-colors"
                >
                  + Agregar primer producto
                </button>

              </div>
            )}


            {/* PRODUCTOS */}
            {!loadingProductos && productos.length > 0 && (
              <div className="space-y-3">

                {productosOrdenados.slice(0, 6).map((producto) => (

                  <div
                    key={producto.id}
                    className="flex items-center gap-4 p-4 rounded-2xl border border-resto-ciruela/10 hover:border-resto-oliva/30 transition-colors"
                  >

                    {/* ICONO */}
                    <div className="w-12 h-12 shrink-0 rounded-xl bg-resto-oliva/10 flex items-center justify-center text-2xl">
                      {producto.icono || '📦'}
                    </div>


                    {/* INFORMACIÓN */}
                    <div className="flex-1 min-w-0">

                      <div className="flex items-center gap-2 flex-wrap">

                        <h4 className="font-bold truncate">
                          {producto.nombre}
                        </h4>

                        <span
                          className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                            producto.diasRestantes <= 3
                              ? 'bg-resto-dorado/20 text-resto-dorado'
                              : 'bg-resto-oliva/10 text-resto-oliva'
                          }`}
                        >
                          {producto.diasRestantes} días
                        </span>

                      </div>

                      <p className="text-xs text-resto-acero mt-1">
                        {producto.categoria}
                      </p>

                    </div>


                    {/* VENCIMIENTO */}
                    <div className="text-right hidden sm:block">

                      <p className="text-xs text-resto-acero">
                        Vence
                      </p>

                      <p className="text-sm font-bold">
                        {producto.vencimiento}
                      </p>

                    </div>

                  </div>

                ))}

              </div>
            )}

          </section>


          {/* =========================
              SISTEMA ACTIVO
          ========================= */}
          <section className="rounded-[2rem] bg-resto-ciruela text-resto-manteca p-6 md:p-8 relative overflow-hidden">

            <div className="relative z-10">

              <div className="flex items-center gap-2 text-resto-dorado text-xs font-bold uppercase tracking-[0.18em]">
                <span className="w-2 h-2 rounded-full bg-resto-dorado animate-pulse" />
                Sistema activo
              </div>

              <h3 className="text-2xl font-black mt-3">
                Todo sincronizado.
              </h3>

              <p className="text-sm text-resto-manteca/60 mt-3 leading-relaxed">
                Tu inventario se encuentra conectado con
                RestoSync y listo para registrar nuevos productos.
              </p>


              {/* ACCIONES */}
              <div className="mt-8 space-y-3">

                <button
                  type="button"
                  onClick={() => setMostrarAgregar(true)}
                  className="w-full flex items-center justify-between rounded-xl bg-resto-oliva px-4 py-3 hover:bg-resto-dorado hover:text-resto-ciruela transition-all"
                >

                  <span className="flex items-center gap-3">

                    <span className="text-xl">
                      +
                    </span>

                    <span className="text-sm font-bold">
                      Agregar compra
                    </span>

                  </span>

                  <span>
                    →
                  </span>

                </button>


                <Link
                  href="/inventario"
                  className="w-full flex items-center justify-between rounded-xl border border-resto-manteca/10 px-4 py-3 hover:bg-resto-manteca/10 transition-all"
                >

                  <span className="flex items-center gap-3">

                    <span className="text-xl">
                      📦
                    </span>

                    <span className="text-sm font-bold">
                      Ver inventario
                    </span>

                  </span>

                  <span>
                    →
                  </span>

                </Link>


                <Link
                  href="/analitica"
                  className="w-full flex items-center justify-between rounded-xl border border-resto-manteca/10 px-4 py-3 hover:bg-resto-manteca/10 transition-all"
                >

                  <span className="flex items-center gap-3">

                    <span className="text-xl">
                      📊
                    </span>

                    <span className="text-sm font-bold">
                      Ver analítica
                    </span>

                  </span>

                  <span>
                    →
                  </span>

                </Link>

              </div>

            </div>


            {/* DECORACIÓN */}
            <div className="absolute -right-20 -top-20 w-56 h-56 rounded-full border border-resto-dorado/15" />

            <div className="absolute -right-10 -bottom-20 w-48 h-48 rounded-full bg-resto-oliva/20" />

          </section>

        </div>

      </section>


      {/* =========================
          BOTÓN FLOTANTE
      ========================= */}
      <button
        type="button"
        onClick={() => setMostrarAgregar(true)}
        className="fixed bottom-7 right-7 z-40 group flex items-center gap-3 px-5 py-4 rounded-2xl bg-resto-oliva text-resto-manteca font-bold shadow-xl hover:bg-resto-dorado hover:text-resto-ciruela transition-all duration-300"
      >

        <span className="text-2xl group-hover:rotate-90 transition-transform">
          +
        </span>

        <span className="hidden sm:inline">
          Agregar compra
        </span>

      </button>


      {/* =========================
          MODAL AGREGAR COMPRA
      ========================= */}
      {mostrarAgregar && (
        <div
          className="fixed inset-0 z-50 bg-resto-ciruela/60 backdrop-blur-sm flex items-center justify-center p-5"
          onClick={() => setMostrarAgregar(false)}
        >

          <div
            className="w-full max-w-lg rounded-[2rem] bg-resto-manteca p-7 md:p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >

            {/* HEADER */}
            <div className="flex items-start justify-between mb-8">

              <div>
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-resto-oliva">
                  Nueva compra
                </span>

                <h3 className="text-3xl font-black mt-1">
                  ¿Cómo querés cargarla?
                </h3>

                <p className="text-sm text-resto-acero mt-2">
                  Elegí la forma más rápida de registrar tus productos.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMostrarAgregar(false)}
                className="w-10 h-10 rounded-xl border border-resto-ciruela/10 text-resto-ciruela hover:bg-resto-ciruela hover:text-resto-manteca transition-all"
              >
                ×
              </button>

            </div>


            {/* OPCIONES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <Link
                href="/registro?modo=audio"
                onClick={() => setMostrarAgregar(false)}
                className="group rounded-2xl bg-resto-ciruela text-resto-manteca p-6 hover:-translate-y-1 transition-all"
              >

                <div className="text-4xl mb-5">
                  🎙️
                </div>

                <h4 className="text-xl font-black">
                  Dictar compra
                </h4>

                <p className="text-sm text-resto-manteca/60 mt-2 leading-relaxed">
                  Hablá y registrá los productos sin escribirlos uno por uno.
                </p>

                <span className="inline-block mt-5 text-resto-dorado font-bold text-sm">
                  Usar micrófono →
                </span>

              </Link>


              <Link
                href="/registro?modo=ticket"
                onClick={() => setMostrarAgregar(false)}
                className="group rounded-2xl border border-resto-oliva/20 bg-resto-oliva/10 p-6 hover:-translate-y-1 transition-all"
              >

                <div className="text-4xl mb-5">
                  📷
                </div>

                <h4 className="text-xl font-black">
                  Escanear ticket
                </h4>

                <p className="text-sm text-resto-acero mt-2 leading-relaxed">
                  Sacale una foto al ticket y detectá los productos automáticamente.
                </p>

                <span className="inline-block mt-5 text-resto-oliva font-bold text-sm">
                  Usar cámara →
                </span>

              </Link>

            </div>

          </div>

        </div>
      )}


      {/* =========================
          FOOTER
      ========================= */}
      <footer className="border-t border-resto-ciruela/10 mt-8">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">

          <p className="text-xs text-resto-acero">
            © 2026 RestoSync. Todos los derechos reservados.
          </p>

          <p className="text-xs text-resto-acero">
            Gestión inteligente de tu cocina.
          </p>

        </div>
      </footer>

    </main>
  );
}
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function AnaliticaPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Timeout para simular la carga de los reportes
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  }, []);

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
            <Link href="/inventario" className="px-4 py-2 rounded-xl text-resto-ciruela text-sm font-semibold hover:bg-resto-oliva/10 transition-colors">Inventario</Link>
            <Link href="/registro?modo=ticket" className="px-4 py-2 rounded-xl text-resto-ciruela text-sm font-semibold hover:bg-resto-oliva/10 transition-colors">Agregar compra</Link>
            <Link href="/analitica" className="px-4 py-2 rounded-xl bg-resto-ciruela text-resto-manteca text-sm font-semibold">Analítica</Link>
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
        <div className="mb-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-resto-dorado/10 border border-resto-dorado/20 text-resto-dorado text-xs font-bold uppercase tracking-wider mb-4">
            <span className="w-2 h-2 rounded-full bg-resto-dorado" />
            Inteligencia de Negocio
          </div>
          <h2 className="text-4xl md:text-5xl font-black leading-tight">
            Analítica y <span className="text-resto-dorado">Predicciones.</span>
          </h2>
          <p className="mt-4 text-resto-acero text-lg leading-relaxed">
            Descubre en qué estás gastando más, minimiza los desperdicios y deja que la Inteligencia Artificial te sugiera tus próximas compras.
          </p>
        </div>

        {loading ? (
          <div className="py-32 text-center">
            <div className="w-12 h-12 mx-auto mb-6 rounded-full border-4 border-resto-dorado/20 border-t-resto-dorado animate-spin" />
            <p className="text-resto-ciruela text-lg font-bold">Analizando datos y tickets de compra...</p>
            <p className="text-resto-acero text-sm mt-2">Nuestra IA está calculando predicciones.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* CARD: GASTOS */}
            <div className="lg:col-span-2 bg-white rounded-[2rem] border border-resto-ciruela/10 p-8 shadow-sm">
              <h3 className="text-xl font-black mb-1">Gastos del mes</h3>
              <p className="text-sm text-resto-acero mb-8">Distribución por categorías basada en tus últimos tickets escaneados.</p>
              
              <div className="flex items-center gap-8">
                {/* Simulación de un gráfico circular sencillo con CSS */}
                <div className="w-48 h-48 rounded-full border-[1.5rem] border-resto-oliva border-r-resto-dorado border-b-resto-dorado border-l-resto-ciruela shrink-0 relative shadow-inner">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-black">$450k</span>
                  </div>
                </div>
                
                <div className="space-y-4 flex-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full bg-resto-oliva" />
                      <span className="font-bold text-sm">Carnes</span>
                    </div>
                    <span className="font-bold">45%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full bg-resto-ciruela" />
                      <span className="font-bold text-sm">Bebidas</span>
                    </div>
                    <span className="font-bold">30%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full bg-resto-dorado" />
                      <span className="font-bold text-sm">Lácteos y Verduras</span>
                    </div>
                    <span className="font-bold">25%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD: MERMAS */}
            <div className="bg-resto-ciruela text-resto-manteca rounded-[2rem] p-8 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="relative z-10">
                <div className="text-3xl mb-4">📉</div>
                <h3 className="text-xl font-black mb-2">Reporte de Mermas</h3>
                <p className="text-sm text-resto-manteca/70 leading-relaxed mb-6">
                  Dinero estimado perdido en productos que vencieron antes de ser utilizados este mes.
                </p>
                <div className="text-4xl font-black text-resto-dorado">
                  $12.500
                </div>
                <p className="text-xs font-bold text-resto-oliva mt-2">↓ 15% menos que el mes pasado</p>
              </div>
              
              {/* Decoración */}
              <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-resto-dorado/10 rounded-full blur-2xl" />
            </div>

            {/* CARD: PREDICCIÓN DE COMPRAS (IA) */}
            <div className="lg:col-span-3 bg-resto-dorado/10 border border-resto-dorado/30 rounded-[2rem] p-8 mt-4">
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                <div className="w-16 h-16 rounded-2xl bg-resto-dorado/20 flex items-center justify-center text-3xl shrink-0">
                  🤖
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-resto-dorado">Asistente IA</span>
                    <span className="px-2 py-0.5 rounded-full bg-resto-ciruela text-resto-manteca text-[10px] font-bold">BETA</span>
                  </div>
                  <h3 className="text-2xl font-black mb-3">Sugerencia de compras para esta semana</h3>
                  <p className="text-resto-ciruela/80 leading-relaxed max-w-4xl">
                    Basado en la rotación de tus insumos durante los últimos 3 fines de semana, te recomendamos reabastecer los siguientes productos antes del <strong>jueves</strong> para evitar quiebres de stock.
                  </p>
                  
                  <div className="mt-6 flex flex-wrap gap-3">
                    <div className="px-4 py-2.5 bg-white border border-resto-dorado/20 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm">
                      🥛 Leche Larga Vida <span className="text-resto-acero font-medium">x 24 L</span>
                    </div>
                    <div className="px-4 py-2.5 bg-white border border-resto-dorado/20 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm">
                      🍅 Tomates <span className="text-resto-acero font-medium">x 15 Kg</span>
                    </div>
                    <div className="px-4 py-2.5 bg-white border border-resto-dorado/20 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm">
                      🥔 Papas <span className="text-resto-acero font-medium">x 30 Kg</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

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

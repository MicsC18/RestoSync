'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { RolUsuario } from '@/lib/use-auth-session';

type ActivePage =
  | 'dashboard'
  | 'inventario'
  | 'menu'
  | 'mesas'
  | 'analitica'
  | 'prediccion'
  | 'sistema'
  | 'locales'
  | 'cuentas';

type Enlace = {
  href: string;
  label: string;
  page: ActivePage | null;
};

type Grupo = {
  id: string;
  label: string;
  enlaces: Enlace[];
  adminOnly?: boolean;
};

// Agrupación del nav: pocos ítems sueltos + submenús por sección de la app.
const GRUPOS: Grupo[] = [
  {
    id: 'operacion',
    label: 'Operación',
    enlaces: [
      { href: '/inventario', label: 'Inventario', page: 'inventario' },
      { href: '/menu', label: 'Menú', page: 'menu' },
      { href: '/mesas', label: 'Mesas', page: 'mesas' },
      { href: '/registro?modo=ticket', label: 'Agregar compra', page: null },
    ],
  },
  {
    id: 'analisis',
    label: 'Análisis',
    enlaces: [
      { href: '/analitica', label: 'Analítica', page: 'analitica' },
      { href: '/prediccion', label: 'IA Predictiva', page: 'prediccion' },
    ],
  },
  {
    id: 'administracion',
    label: 'Administración',
    adminOnly: true,
    enlaces: [
      { href: '/locales', label: 'Locales', page: 'locales' },
      { href: '/cuentas', label: 'Cuentas', page: 'cuentas' },
    ],
  },
];

const ENLACE_INICIO: Enlace = { href: '/dashboard', label: 'Inicio', page: 'dashboard' };
const ENLACE_SISTEMA: Enlace = { href: '/sistema', label: 'Sistema', page: 'sistema' };

type AppNavigationProps = {
  activePage: ActivePage;
  onLogout: () => void;
  rol?: RolUsuario | null;
};

const BASE_LINK =
  'block rounded-xl px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resto-oliva';

export default function AppNavigation({
  activePage,
  onLogout,
  rol,
}: AppNavigationProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const esAdmin = rol === 'ADMIN_RESTAURANTE';
  const grupos = GRUPOS.filter((grupo) => !grupo.adminOnly || esAdmin);

  const enlaceClass = (page: ActivePage | null) =>
    `${BASE_LINK} ${
      page !== null && page === activePage
        ? 'bg-resto-ciruela text-resto-manteca'
        : 'text-resto-ciruela hover:bg-resto-oliva/10'
    }`;

  return (
    <div className="flex items-center">
      {/* Barra de escritorio: Inicio · submenús · Sistema · Salir */}
      <nav aria-label="Navegación principal" className="hidden lg:flex items-center gap-1">
        <Link
          href={ENLACE_INICIO.href}
          aria-current={ENLACE_INICIO.page === activePage ? 'page' : undefined}
          className={enlaceClass(ENLACE_INICIO.page)}
        >
          {ENLACE_INICIO.label}
        </Link>

        {grupos.map((grupo) => (
          <GrupoMenu key={grupo.id} grupo={grupo} activePage={activePage} enlaceClass={enlaceClass} />
        ))}

        <Link
          href={ENLACE_SISTEMA.href}
          aria-current={ENLACE_SISTEMA.page === activePage ? 'page' : undefined}
          className={enlaceClass(ENLACE_SISTEMA.page)}
        >
          {ENLACE_SISTEMA.label}
        </Link>

        <button
          type="button"
          onClick={onLogout}
          className="ml-3 rounded-xl px-4 py-3 text-sm font-bold text-resto-ciruela transition-colors hover:bg-resto-ciruela hover:text-resto-manteca focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resto-oliva"
        >
          Salir
        </button>
      </nav>

      {/* Botón hamburguesa (mobile) */}
      <div className="lg:hidden">
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-controls="mobile-app-navigation"
          aria-label={menuOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
          onClick={() => setMenuOpen((open) => !open)}
          className="rounded-xl border border-resto-ciruela/20 px-4 py-2 text-sm font-bold text-resto-ciruela focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resto-oliva"
        >
          {menuOpen ? 'Cerrar' : 'Menú'}
        </button>
      </div>

      {/* Menú desplegable mobile: enlaces planos con títulos de sección */}
      {menuOpen && (
        <nav
          id="mobile-app-navigation"
          aria-label="Navegación principal"
          className="absolute left-0 right-0 top-full border-b border-resto-ciruela/10 bg-resto-manteca p-4 shadow-lg lg:hidden"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-1">
            <Link
              href={ENLACE_INICIO.href}
              aria-current={ENLACE_INICIO.page === activePage ? 'page' : undefined}
              onClick={() => setMenuOpen(false)}
              className={enlaceClass(ENLACE_INICIO.page)}
            >
              {ENLACE_INICIO.label}
            </Link>

            {grupos.map((grupo) => (
              <div key={grupo.id}>
                <p className="mt-3 mb-1 px-4 text-xs font-black uppercase tracking-wider text-resto-acero">
                  {grupo.label}
                </p>
                {grupo.enlaces.map((enlace) => (
                  <Link
                    key={enlace.href}
                    href={enlace.href}
                    aria-current={enlace.page !== null && enlace.page === activePage ? 'page' : undefined}
                    onClick={() => setMenuOpen(false)}
                    className={enlaceClass(enlace.page)}
                  >
                    {enlace.label}
                  </Link>
                ))}
              </div>
            ))}

            <div>
              <p className="mt-3 mb-1 px-4 text-xs font-black uppercase tracking-wider text-resto-acero">
                Cuenta
              </p>
              <Link
                href={ENLACE_SISTEMA.href}
                aria-current={ENLACE_SISTEMA.page === activePage ? 'page' : undefined}
                onClick={() => setMenuOpen(false)}
                className={enlaceClass(ENLACE_SISTEMA.page)}
              >
                {ENLACE_SISTEMA.label}
              </Link>
            </div>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onLogout();
              }}
              className="rounded-xl px-4 py-3 text-left text-sm font-bold text-resto-ciruela transition-colors hover:bg-resto-ciruela hover:text-resto-manteca focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resto-oliva"
            >
              Salir
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

function GrupoMenu({
  grupo,
  activePage,
  enlaceClass,
}: {
  grupo: Grupo;
  activePage: ActivePage;
  enlaceClass: (page: ActivePage | null) => string;
}) {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);

  // Cerrar con Escape (devolviendo el foco al botón) o al hacer click fuera.
  useEffect(() => {
    if (!abierto) return;

    const onKey = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        setAbierto(false);
        botonRef.current?.focus();
      }
    };
    const onPointerDown = (evento: PointerEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(evento.target as Node)) {
        setAbierto(false);
      }
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [abierto]);

  const contieneActivo = grupo.enlaces.some(
    (enlace) => enlace.page !== null && enlace.page === activePage,
  );

  return (
    <div ref={contenedorRef} className="relative">
      <button
        ref={botonRef}
        type="button"
        aria-expanded={abierto}
        aria-controls={`submenu-${grupo.id}`}
        onClick={() => setAbierto((valor) => !valor)}
        className={`${BASE_LINK} flex items-center gap-1.5 ${
          contieneActivo
            ? 'bg-resto-ciruela text-resto-manteca'
            : `text-resto-ciruela hover:bg-resto-oliva/10 ${abierto ? 'bg-resto-oliva/10' : ''}`
        }`}
      >
        {grupo.label}
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          className={`h-3 w-3 transition-transform ${abierto ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {abierto && (
        <div
          id={`submenu-${grupo.id}`}
          className="absolute left-0 top-full z-[70] mt-2 min-w-56 rounded-2xl border border-resto-ciruela/10 bg-white p-2 shadow-xl"
        >
          {grupo.enlaces.map((enlace) => (
            <Link
              key={enlace.href}
              href={enlace.href}
              aria-current={enlace.page !== null && enlace.page === activePage ? 'page' : undefined}
              onClick={() => setAbierto(false)}
              className={enlaceClass(enlace.page)}
            >
              {enlace.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

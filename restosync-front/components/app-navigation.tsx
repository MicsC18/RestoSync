'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { RolUsuario } from '@/lib/use-auth-session';

type ActivePage =
  | 'dashboard'
  | 'inventario'
  | 'menu'
  | 'mesas'
  | 'analitica'
  | 'opciones'
  | 'locales'
  | 'cuentas';

const linksBase = [
  { href: '/dashboard', label: 'Inicio', page: 'dashboard' as const, adminOnly: false },
  { href: '/inventario', label: 'Inventario', page: 'inventario' as const, adminOnly: false },
  { href: '/menu', label: 'Menú', page: 'menu' as const, adminOnly: false },
  { href: '/mesas', label: 'Mesas', page: 'mesas' as const, adminOnly: false },
  { href: '/registro?modo=ticket', label: 'Agregar compra', page: null, adminOnly: false },
  { href: '/analitica', label: 'Analítica', page: 'analitica' as const, adminOnly: false },
  { href: '/locales', label: 'Locales', page: 'locales' as const, adminOnly: true },
  { href: '/cuentas', label: 'Cuentas', page: 'cuentas' as const, adminOnly: true },
  { href: '/opciones', label: 'Configuración', page: 'opciones' as const, adminOnly: false },
];

type AppNavigationProps = {
  activePage: ActivePage;
  onLogout: () => void;
  rol?: RolUsuario | null;
};

export default function AppNavigation({
  activePage,
  onLogout,
  rol,
}: AppNavigationProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const esAdmin = rol === 'ADMIN_RESTAURANTE';
  const links = linksBase.filter((link) => !link.adminOnly || esAdmin);

  const linkClass = (page: string | null) =>
    `block rounded-xl px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resto-oliva ${
      page === activePage
        ? 'bg-resto-ciruela text-resto-manteca'
        : 'text-resto-ciruela hover:bg-resto-oliva/10'
    }`;

  return (
    <div className="flex items-center">
      <nav aria-label="Navegación principal" className="hidden lg:flex items-center gap-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={link.page === activePage ? 'page' : undefined}
            className={linkClass(link.page)}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="hidden lg:block ml-3">
        <button
          type="button"
          onClick={onLogout}
          className="rounded-xl px-4 py-3 text-sm font-bold text-resto-ciruela transition-colors hover:bg-resto-ciruela hover:text-resto-manteca focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resto-oliva"
        >
          Salir
        </button>
      </div>

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

      {menuOpen && (
        <nav
          id="mobile-app-navigation"
          aria-label="Navegación principal"
          className="absolute left-0 right-0 top-full border-b border-resto-ciruela/10 bg-resto-manteca p-4 shadow-lg lg:hidden"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={link.page === activePage ? 'page' : undefined}
                onClick={() => setMenuOpen(false)}
                className={linkClass(link.page)}
              >
                {link.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={onLogout}
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

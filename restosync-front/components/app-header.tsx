'use client';

import Link from 'next/link';
import AppNavigation from '@/components/app-navigation';
import SelectorLocal from '@/components/selector-local';
import type { LocalInfo, RolUsuario } from '@/lib/use-auth-session';

type ActivePage =
  | 'dashboard'
  | 'inventario'
  | 'menu'
  | 'mesas'
  | 'analitica'
  | 'opciones'
  | 'locales'
  | 'cuentas';

type AppHeaderProps = {
  activePage: ActivePage;
  onLogout: () => void;
  rol?: RolUsuario | null;
  locales: LocalInfo[];
  localActivoId: number | null;
  onLocalChange: (id: number) => void;
};

export default function AppHeader({
  activePage,
  onLogout,
  rol,
  locales,
  localActivoId,
  onLocalChange,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-resto-ciruela/10 bg-resto-manteca/95 backdrop-blur-md">
      <div className="relative max-w-7xl mx-auto px-6 lg:px-10 h-20 flex items-center justify-between gap-3">
        <Link href="/dashboard" className="shrink-0">
          <h1 className="text-2xl font-black tracking-tight">
            Resto<span className="text-resto-dorado">Sync.</span>
          </h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-resto-acero">
            Tu cocina sincronizada
          </p>
        </Link>

        <div className="flex items-center gap-3 min-w-0">
          <SelectorLocal
            rol={rol}
            locales={locales}
            localActivoId={localActivoId}
            onChange={onLocalChange}
          />
          <AppNavigation
            activePage={activePage}
            onLogout={onLogout}
            rol={rol}
          />
        </div>
      </div>
    </header>
  );
}

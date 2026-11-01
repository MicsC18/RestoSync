'use client';

import type { LocalInfo, RolUsuario } from '@/lib/use-auth-session';

type SelectorLocalProps = {
  rol?: RolUsuario | null;
  locales: LocalInfo[];
  localActivoId: number | null;
  onChange: (id: number) => void;
};

export default function SelectorLocal({
  rol,
  locales,
  localActivoId,
  onChange,
}: SelectorLocalProps) {
  if (rol !== 'ADMIN_RESTAURANTE') {
    const nombre =
      locales.find((local) => local.id === localActivoId)?.nombre ??
      locales[0]?.nombre;
    if (!nombre) return null;
    return (
      <div className="hidden sm:flex items-center gap-2 rounded-xl border border-resto-ciruela/10 bg-white px-3 py-2 text-xs font-semibold text-resto-acero">
        <span className="text-resto-oliva">Local</span>
        <span className="text-resto-ciruela">{nombre}</span>
      </div>
    );
  }

  if (locales.length === 0) {
    return (
      <div className="rounded-xl border border-resto-dorado/30 bg-resto-dorado/10 px-3 py-2 text-xs font-semibold text-resto-ciruela">
        Sin locales — creá uno
      </div>
    );
  }

  return (
    <label className="flex items-center gap-2 text-xs font-semibold text-resto-acero">
      <span className="hidden sm:inline">Local</span>
      <select
        value={localActivoId ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
        className="max-w-[10rem] sm:max-w-[14rem] rounded-xl border border-resto-ciruela/15 bg-white px-3 py-2 text-sm font-bold text-resto-ciruela focus:outline-none focus:ring-2 focus:ring-resto-oliva"
        aria-label="Seleccionar local activo"
      >
        {locales.map((local) => (
          <option key={local.id} value={local.id}>
            {local.nombre}
            {!local.activo ? ' (inactivo)' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

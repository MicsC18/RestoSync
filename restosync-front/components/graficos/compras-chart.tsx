'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CompraItem, PrioridadCompra } from '@/lib/prediccion';
import { formatearCantidad } from '@/lib/numero';

// Colores por prioridad con la paleta existente (Plan-IA §4.2).
const COLOR_PRIORIDAD: Record<PrioridadCompra, string> = {
  ALTA: '#3A1124', // resto-ciruela
  MEDIA: '#E0A96D', // resto-dorado
  BAJA: '#54718E', // resto-acero
};

type TooltipItem = {
  payload?: CompraItem;
  value?: string | number;
};

function acortar(nombre: string) {
  return nombre.length > 20 ? `${nombre.slice(0, 19)}…` : nombre;
}

/**
 * Compras sugeridas (Plan-IA §4.2): barras horizontales con la cantidad
 * sugerida del top 8, coloreadas por prioridad, tooltip con el motivo.
 */
export default function ComprasChart({ compras }: { compras: CompraItem[] }) {
  const datos = compras.slice(0, 8);

  if (datos.length === 0) {
    return (
      <p className="text-sm text-resto-acero py-10 text-center">
        Las reglas no detectan faltantes para este horizonte. ¡Buen trabajo!
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, datos.length * 44)}>
      <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#3A11241A" />
        <XAxis type="number" tick={{ fontSize: 12, fill: '#54718E' }} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="nombre"
          width={130}
          tick={{ fontSize: 12, fill: '#3A1124' }}
          tickFormatter={acortar}
          interval={0}
        />
        <Tooltip content={<ComprasTooltip />} cursor={{ fill: '#E0A96D1A' }} />
        <Bar dataKey="cantidadSugerida" radius={[0, 10, 10, 0]} maxBarSize={22}>
          {datos.map((compra) => (
            <Cell key={compra.insumoId} fill={COLOR_PRIORIDAD[compra.prioridad]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function ComprasTooltip({ active, payload }: { active?: boolean; payload?: TooltipItem[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const compra = payload[0]?.payload;
  if (!compra) return null;
  return (
    <div className="bg-white border border-resto-ciruela/15 rounded-xl shadow-lg px-4 py-3 text-xs max-w-72">
      <p className="font-black mb-1">
        {compra.icono ?? '📦'} {compra.nombre}: <span className="text-resto-canela">{formatearCantidad(compra.cantidadSugerida)}</span>{' '}
        {compra.unidadMedida}
      </p>
      <p className="text-resto-acero font-bold mb-1">Prioridad {compra.prioridad.toLowerCase()}</p>
      <p className="text-resto-acero">{compra.motivo}</p>
    </div>
  );
}

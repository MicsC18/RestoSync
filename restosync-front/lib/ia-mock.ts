export type ItemEscaneadoMock = {
  nombre: string;
  categoria: string;
  icono: string;
  cantidad: number;
  diasRestantes: number;
  estado: 'Cerrado' | 'Abierto';
};

export type RespuestaEscaneoMock = {
  itemsEncontrados: ItemEscaneadoMock[];
};

const ITEMS_EJEMPLO: ItemEscaneadoMock[] = [
  {
    nombre: 'Leche entera',
    categoria: 'Lácteos',
    icono: '🥛',
    cantidad: 2,
    diasRestantes: 7,
    estado: 'Cerrado',
  },
  {
    nombre: 'Tomate perita',
    categoria: 'Frutas y verduras',
    icono: '🍅',
    cantidad: 6,
    diasRestantes: 4,
    estado: 'Cerrado',
  },
  {
    nombre: 'Aceite de girasol',
    categoria: 'Almacén',
    icono: '🫙',
    cantidad: 1,
    diasRestantes: 120,
    estado: 'Cerrado',
  },
  {
    nombre: 'Pechuga de pollo',
    categoria: 'Carnes',
    icono: '🍗',
    cantidad: 3,
    diasRestantes: 3,
    estado: 'Cerrado',
  },
];

/** Simula el escaneo de ticket sin llamar a restosync-ia. */
export async function escanearTicketMock(
  _archivo?: File | null
): Promise<RespuestaEscaneoMock> {
  await new Promise((resolve) => setTimeout(resolve, 700));
  return { itemsEncontrados: ITEMS_EJEMPLO.map((item) => ({ ...item })) };
}

export function usarMockIa(): boolean {
  return process.env.NEXT_PUBLIC_USE_IA_MOCK !== 'false';
}

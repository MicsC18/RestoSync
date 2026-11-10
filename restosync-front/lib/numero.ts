/**
 * Números del dominio (cantidades, stocks, unidades) sin ruido de punto flotante.
 *
 * El backend ya normaliza a dos decimales antes de persistir, pero el front recibe
 * JSON de servicios y datos que pueden venir contaminados (`9.200000000000003`), así
 * que la capa de presentación se defiende sola: nunca se muestra un `Double` crudo.
 */

/** Acierta a dos decimales el valor que llega de la API. */
export function redondearCantidad(valor: number | null | undefined): number {
  if (valor == null || !Number.isFinite(valor)) return 0;
  return Math.round(valor * 100) / 100;
}

/**
 * Cantidad para leer: `2` en vez de `2.0`, y `9.2` en vez de `9.200000000000003`.
 * `null`/`undefined` se muestran como `0` (es un stock que no existe todavía).
 */
export function formatearCantidad(valor: number | null | undefined): string {
  const limpio = redondearCantidad(valor);
  if (Number.isInteger(limpio)) return String(limpio);
  return limpio.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

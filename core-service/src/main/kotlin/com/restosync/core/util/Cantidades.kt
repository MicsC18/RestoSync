package com.restosync.core.util

import kotlin.math.floor

/**
 * Precisión de trabajo del dominio: **dos decimales**.
 *
 * Las cantidades son `Double`, y el dominio las acumula restando lotes y sumando filas
 * homónimas (`12.3 - 3.1 = 9.200000000000001`, `0.1 * 3 = 0.30000000000000004`). Sin una
 * normalización ese ruido **se persiste** en `lotes.cantidad` / `insumos.cantidad` y termina
 * en pantalla (`9.200000000000003 Kilos`) o en un mensaje de error. Todo número que se guarda
 * o que sale en el JSON pasa por acá: es la misma regla que ya aplicaba `AnaliticaService`
 * en su capa de lectura.
 *
 * Con dos decimales alcanza para el dominio (medio kilo = `0.5`), y comparar contra el valor
 * redondeado evita además el falso "No hay stock suficiente" cuando el disponible virtualmente
 * es igual al requerido (`9.199999999999999 < 9.2`).
 */
fun redondear(valor: Double): Double = Math.round(valor * 100.0) / 100.0

/**
 * Cantidad para leer: `2` en vez de `2.0`, y `9.2` en vez de `9.200000000000003`.
 * Se usa en los mensajes de error y en el texto del motivo de cada movimiento.
 */
fun cantidadLegible(valor: Double): String {
    val limpio = redondear(valor)
    return if (limpio == floor(limpio) && !limpio.isInfinite()) {
        limpio.toLong().toString()
    } else {
        limpio.toString()
    }
}

/**
 * `true` cuando el valor guarda ruido de punto flotante respecto de su versión a dos decimales.
 * Las migraciones de limpieza la usan para tocar solo las filas realmente afectadas
 * (una migración idempotente no debe reescribir datos sanos).
 */
fun tieneRuidoPuntoFlotante(valor: Double): Boolean = valor != redondear(valor)

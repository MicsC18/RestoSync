package com.restosync.core.dto

/**
 * Contratos de `GET /api/v1/analitica/historial` (§1.1 del Plan-IA).
 * Fechas siempre en formato `yyyy-MM-dd` (strings, sin dependencia del
 * serializador de `LocalDate`) para que el front y la IA las consuman tal cual.
 */

/** Lote vigente del insumo (cantidad > 0), ordenado por vencimiento ascendente. */
data class LoteHistorialDto(
    val cantidad: Double,
    val fechaVencimiento: String
)

/** Insumo del local con su stock actual y sus lotes vigentes. */
data class InsumoHistorialDto(
    val id: Long,
    val nombre: String,
    val categoria: String?,
    val icono: String?,
    val unidadMedida: String,
    val stockActual: Double,
    val stockMinimo: Double?,
    val lotes: List<LoteHistorialDto>
)

/**
 * Fila dispersa de la serie histórica: solo combinaciones (fecha, insumo) con
 * al menos un movimiento en la ventana. La IA rellena con ceros los días sin actividad.
 */
data class SerieDiariaDto(
    val fecha: String,
    val insumoId: Long,
    /** Suma de PRODUCCION + SALIDA del día (AJUSTE se ignora). */
    val consumo: Double,
    /** Suma de ENTRADA del día. */
    val entradas: Double,
    /** Suma de MERMA del día. */
    val mermas: Double
)

/** Producciones del día agrupadas por (fecha, platoNombre) — usa el snapshot. */
data class ProduccionDiariaDto(
    val fecha: String,
    val platoNombre: String,
    val cantidad: Double
)

/** Respuesta completa del historial agregado de un local (contrato §1.1). */
data class HistorialResponse(
    val localId: Long,
    val dias: Int,
    val desde: String,
    val hasta: String,
    val insumos: List<InsumoHistorialDto>,
    val series: List<SerieDiariaDto>,
    val producciones: List<ProduccionDiariaDto>
)

package com.restosync.core.dto

/** Línea de receta que envía el front: referencia una fila de insumo del local. */
data class LineaRecetaRequest(
    val insumoId: Long = 0,
    val cantidad: Double = 0.0
)

/**
 * Alta/edición de un plato. En el PUT, si `ingredientes` viene null no se toca la receta;
 * si viene una lista (aunque vacía) se reemplaza por completo.
 */
data class PlatoRequest(
    val nombre: String = "",
    val descripcion: String? = null,
    val precio: Double? = null,
    val activo: Boolean? = null,
    val ingredientes: List<LineaRecetaRequest>? = null
)

/** Vista de una línea de receta (evita serializar la entidad completa con proxies). */
data class RecetaLineaDto(
    val id: Long,
    val insumoId: Long,
    val insumoNombre: String,
    val icono: String?,
    val unidadMedida: String,
    val cantidad: Double
)

/** Detalle de un plato con su receta. */
data class PlatoDetalleDto(
    val id: Long,
    val nombre: String,
    val descripcion: String?,
    val precio: Double?,
    val activo: Boolean,
    val ingredientes: List<RecetaLineaDto>
)

/** Preparar un plato: cantidad opcional (default 1) y mesa destino opcional. */
data class PrepararRequest(
    val cantidad: Double? = null,
    val mesaId: Long? = null
)

/** Stock restante de un ingrediente tras preparar (agrupado por nombre). */
data class StockRestanteDto(
    val nombre: String,
    val unidadMedida: String,
    val cantidadRestante: Double
)

/** Resultado de preparar un plato. */
data class PreparacionResponse(
    val produccionId: Long?,
    val platoId: Long,
    val platoNombre: String,
    val cantidad: Double,
    val mesaId: Long?,
    val mesaNombre: String?,
    val fechaHora: String,
    val stockRestante: List<StockRestanteDto>
)

/** Historial de producción: un plato preparado para una mesa. */
data class ProduccionDto(
    val id: Long?,
    val platoId: Long?,
    val platoNombre: String,
    val cantidad: Double,
    val mesaId: Long?,
    val mesaNombre: String?,
    val fechaHora: String,
    val usuarioEmail: String?
)

/** Alta/edición de mesa (en el PUT solo se corrige lo informado). */
data class MesaRequest(
    val nombre: String = "",
    val capacidad: Int? = null,
    val posicionX: Double? = null,
    val posicionY: Double? = null,
    val estado: String? = null
)
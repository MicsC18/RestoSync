package com.restosync.core.dto

import java.time.LocalDate

/**
 * Alta/edición de insumos. Reemplaza el bind directo de la entidad para que el cliente
 * no pueda fijar `id`, `local` ni `restaurante` desde el payload.
 * En el PUT todos los campos son opcionales: solo se corrige lo que venga informado.
 */
data class InsumoRequest(
    val nombre: String = "",
    val categoria: String? = null,
    val icono: String? = null,
    val unidadMedida: String? = null,
    val stockMinimo: Double? = null,
    val cantidad: Double? = null,
    val diasRestantes: Int? = null,
    val estado: String? = null
)

/** Corrección puntual de un lote (cantidad y/o vencimiento). */
data class LoteRequest(
    val cantidad: Double? = null,
    val fechaVencimiento: LocalDate? = null
)

/** Vista de auditoría de movimientos; evita serializar proxies lazy. */
data class MovimientoDto(
    val id: Long?,
    val tipo: String,
    val cantidad: Double,
    val fechaHora: String,
    val motivo: String?,
    val insumoId: Long?,
    val loteId: Long?,
    val usuarioEmail: String?
)
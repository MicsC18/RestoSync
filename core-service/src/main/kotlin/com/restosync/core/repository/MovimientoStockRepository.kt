package com.restosync.core.repository

import com.restosync.core.model.MovimientoStock
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.time.LocalDateTime

@Repository
interface MovimientoStockRepository : JpaRepository<MovimientoStock, Long> {
    fun findByInsumoIdOrderByFechaHoraDesc(insumoId: Long): List<MovimientoStock>
    fun findByLoteId(loteId: Long): List<MovimientoStock>

    /** Auditoría de una fila concreta: al fusionar filas se reengancha a la fila que sobrevive. */
    fun findByInsumoId(insumoId: Long): List<MovimientoStock>
    fun deleteByInsumoId(insumoId: Long)
    fun countByUsuarioId(usuarioId: Long): Long

    /** Ventana de movimientos del local para la serie histórica. */
    fun findByLocalIdAndFechaHoraBetweenOrderByFechaHoraAsc(
        localId: Long,
        desde: LocalDateTime,
        hasta: LocalDateTime
    ): List<MovimientoStock>

    /** Guarda de idempotencia del seed histórico. */
    fun existsByLocalIdAndMotivo(localId: Long, motivo: String): Boolean
}
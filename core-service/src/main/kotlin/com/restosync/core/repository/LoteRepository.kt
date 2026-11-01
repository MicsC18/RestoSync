package com.restosync.core.repository

import com.restosync.core.model.Lote
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.time.LocalDate

@Repository
interface LoteRepository : JpaRepository<Lote, Long> {

    fun findByInsumoIdOrderByFechaVencimientoAsc(insumoId: Long): List<Lote>

    fun findByInsumoId(insumoId: Long): List<Lote>

    /** Lote exacto para el merge por vencimiento (§4.5). */
    fun findByInsumoIdAndFechaVencimiento(insumoId: Long, fechaVencimiento: LocalDate): Lote?

    fun existsByInsumoId(insumoId: Long): Boolean
}
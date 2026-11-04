package com.restosync.core.repository

import com.restosync.core.model.MovimientoStock
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface MovimientoStockRepository : JpaRepository<MovimientoStock, Long> {
    fun findByInsumoIdOrderByFechaHoraDesc(insumoId: Long): List<MovimientoStock>
    fun findByLoteId(loteId: Long): List<MovimientoStock>
    fun deleteByInsumoId(insumoId: Long)
    fun countByUsuarioId(usuarioId: Long): Long
}
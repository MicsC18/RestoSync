package com.restosync.core.repository

import com.restosync.core.model.Lote
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface LoteRepository : JpaRepository <Lote,Long > {
    
    fun findByInsumoIdOrderByFechaVencimientoAsc(insumoId: Long): List < Lote >
    
}
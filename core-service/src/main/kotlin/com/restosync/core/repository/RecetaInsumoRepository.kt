package com.restosync.core.repository

import com.restosync.core.model.RecetaInsumo
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface RecetaInsumoRepository : JpaRepository<RecetaInsumo, Long> {
    fun findByPlatoId(platoId: Long): List<RecetaInsumo>
    fun deleteByPlatoId(platoId: Long)

    /** Integridad: un insumo que es ingrediente de un plato no se puede eliminar. */
    fun existsByInsumoId(insumoId: Long): Boolean
    fun countByInsumoId(insumoId: Long): Long
}
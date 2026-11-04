package com.restosync.core.repository

import com.restosync.core.model.Plato
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface PlatoRepository : JpaRepository<Plato, Long> {
    fun findByLocalIdOrderByNombreAsc(localId: Long): List<Plato>
    fun countByLocalId(localId: Long): Long
}
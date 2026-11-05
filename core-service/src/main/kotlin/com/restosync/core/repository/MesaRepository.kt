package com.restosync.core.repository

import com.restosync.core.model.Mesa
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface MesaRepository : JpaRepository<Mesa, Long> {
    fun findByLocalIdOrderByNombreAsc(localId: Long): List<Mesa>
    fun countByLocalId(localId: Long): Long
}
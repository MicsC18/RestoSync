package com.restosync.core.repository

import com.restosync.core.model.Local
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface LocalRepository : JpaRepository<Local, Long> {
    fun findByRestauranteId(restauranteId: Long): List<Local>
    fun findByRestauranteIdAndId(restauranteId: Long, id: Long): Local?
}

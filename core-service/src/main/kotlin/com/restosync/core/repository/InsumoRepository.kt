package com.restosync.core.repository

import com.restosync.core.model.Insumo
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface InsumoRepository : JpaRepository <Insumo,Long> {
    
    fun findByRestauranteId(restauranteId: Long):List <Insumo>
    
}
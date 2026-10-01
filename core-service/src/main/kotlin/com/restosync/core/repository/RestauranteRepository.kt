package com.restosync.core.repository

import com.restosync.core.model.Restaurante
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface RestauranteRepository : JpaRepository<Restaurante, Long>
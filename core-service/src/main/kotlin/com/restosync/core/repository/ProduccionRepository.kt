package com.restosync.core.repository

import com.restosync.core.model.Produccion
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.time.LocalDateTime

@Repository
interface ProduccionRepository : JpaRepository<Produccion, Long> {
    fun findByLocalIdOrderByFechaHoraDesc(localId: Long): List<Produccion>
    fun findByLocalIdAndMesaIdOrderByFechaHoraDesc(localId: Long, mesaId: Long): List<Produccion>
    fun findByPlatoId(platoId: Long): List<Produccion>
    fun findByMesaId(mesaId: Long): List<Produccion>
    fun countByUsuarioId(usuarioId: Long): Long

    /** Producciones de la ventana histórica del local para la analítica (§1.1 del Plan-IA). */
    fun findByLocalIdAndFechaHoraBetween(
        localId: Long,
        desde: LocalDateTime,
        hasta: LocalDateTime
    ): List<Produccion>
}
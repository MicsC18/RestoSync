package com.restosync.core.repository

import com.restosync.core.model.Insumo
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface InsumoRepository : JpaRepository<Insumo, Long> {
    fun findByLocalId(localId: Long): List<Insumo>
    fun findByLocalIsNull(): List<Insumo>

    /**
     * Filas homónimas del local. Puede haber varias: una por cada vencimiento distinto.
     * El merge busca entre ellas la que tenga un lote con la fecha exacta.
     */
    fun findByLocalIdAndNombreIgnoreCase(localId: Long, nombre: String): List<Insumo>
    fun countByLocalId(localId: Long): Long
}
